import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/auth'

// Bảng công của 1 NHÂN VIÊN BẤT KỲ (?userId=uuid) — dùng cho admin xem Bảng
// công của người khác (trang /quan-li-cham-cong/nhan-vien). Y HỆT công thức
// của /api/attendance/timesheet (tính cho chính người gọi), chỉ khác đối
// tượng — giữ nguyên logic đủ/thiếu công/OT/nghỉ, không viết lại.
const VN_OFFSET_MS = 7 * 3600 * 1000

function vnParts(iso: string) {
  const d = new Date(new Date(iso).getTime() + VN_OFFSET_MS)
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, day: d.getUTCDate(), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() }
}

function dayKey(y: number, mo: number, day: number) {
  return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToLabel(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function parseVNDateToKey(s: unknown): string | null {
  if (typeof s !== 'string') return null
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim())
  if (!m) return null
  return dayKey(Number(m[3]), Number(m[2]), Number(m[1]))
}

type DayStatus = 'du_cong' | 'thieu_cong' | 'nghi' | 'none'

export async function GET(req: NextRequest) {
  const { supabase, unauthorized } = await requireAdminUser()
  if (unauthorized) return unauthorized

  const targetUserId = req.nextUrl.searchParams.get('userId')
  if (!targetUserId) return NextResponse.json({ error: 'Thiếu userId' }, { status: 400 })

  const monthParam = req.nextUrl.searchParams.get('month') // "YYYY-MM"
  const now = new Date(Date.now() + VN_OFFSET_MS)
  const year = monthParam ? Number(monthParam.slice(0, 4)) : now.getUTCFullYear()
  const month = monthParam ? Number(monthParam.slice(5, 7)) : now.getUTCMonth() + 1
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'month không hợp lệ, dùng dạng YYYY-MM' }, { status: 400 })
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const startUtc = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - VN_OFFSET_MS)
  const endUtc = new Date(Date.UTC(year, month, 1, 0, 0, 0) - VN_OFFSET_MS)

  const [{ data: reqRow }, { data: rawLogs }, { data: approvedLeaves }] = await Promise.all([
    supabase.from('hrm_employee_requirements').select('shift_id, misa_employee_code').eq('user_id', targetUserId).maybeSingle(),
    supabase
      .from('hrm_attendance_logs')
      .select('type, created_at, channel')
      .eq('user_id', targetUserId)
      .eq('is_success', true)
      .gte('created_at', startUtc.toISOString())
      .lt('created_at', endUtc.toISOString())
      .order('created_at', { ascending: true }),
    supabase.from('hrm_leave_requests').select('fields').eq('requester_id', targetUserId).eq('type', 'nghi_phep').eq('status', 'approved'),
  ])

  // Nhân viên đã có mã MISA -> MISA là dữ liệu chuẩn cho Bảng công, chấm công
  // qua web/app của người này chỉ để test, không tính vào công thật.
  const isMisaAuthoritative = !!reqRow?.misa_employee_code
  const logs = isMisaAuthoritative ? (rawLogs ?? []).filter((l) => l.channel === 'misa') : rawLogs

  let shift = reqRow?.shift_id
    ? (await supabase.from('hrm_shifts').select('*').eq('id', reqRow.shift_id).maybeSingle()).data
    : null
  if (!shift) shift = (await supabase.from('hrm_shifts').select('*').eq('is_default', true).maybeSingle()).data
  const noShiftConfigured = !shift

  const nghiDayKeys = new Set<string>()
  for (const leave of approvedLeaves ?? []) {
    const fields = leave.fields as Record<string, string>
    const fromKey = parseVNDateToKey(fields?.tu_ngay)
    const toKey = parseVNDateToKey(fields?.den_ngay) ?? fromKey
    if (!fromKey) continue
    const cursor = new Date(`${fromKey}T00:00:00Z`)
    const end = new Date(`${toKey}T00:00:00Z`)
    while (cursor <= end) {
      nghiDayKeys.add(cursor.toISOString().slice(0, 10))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  }

  const byDay = new Map<string, { checkInMin: number | null; checkOutMin: number | null }>()
  for (const log of logs ?? []) {
    const { y, mo, day, minutes } = vnParts(log.created_at)
    const key = dayKey(y, mo, day)
    const entry = byDay.get(key) ?? { checkInMin: null, checkOutMin: null }
    if (log.type === 'check_in' && entry.checkInMin === null) entry.checkInMin = minutes
    if (log.type === 'check_out') entry.checkOutMin = minutes
    byDay.set(key, entry)
  }

  const standardStart = shift ? timeToMinutes(shift.start_time) : null
  const standardEnd = shift ? timeToMinutes(shift.end_time) : null
  const breakMinutes = shift?.break_minutes ?? 0
  const standardMinutes = standardStart !== null && standardEnd !== null ? standardEnd - standardStart - breakMinutes : null

  const todayKey = dayKey(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())

  const days: {
    date: string
    status: DayStatus
    checkIn: string | null
    checkOut: string | null
    isLate: boolean
    isEarly: boolean
    otHours: number
  }[] = []

  let tongCongDays = 0
  let otHoursTotal = 0
  let lateEarlyCount = 0
  let nghiDays = 0

  for (let d = 1; d <= daysInMonth; d++) {
    const key = dayKey(year, month, d)
    const entry = byDay.get(key)
    const isFuture = key > todayKey

    if (entry && (entry.checkInMin !== null || entry.checkOutMin !== null)) {
      tongCongDays++
      const checkIn = entry.checkInMin
      const checkOut = entry.checkOutMin
      let isLate = false
      let isEarly = false
      let otHours = 0
      let status: DayStatus = 'thieu_cong'

      if (checkIn !== null && checkOut !== null && standardStart !== null && standardEnd !== null && standardMinutes !== null) {
        isLate = checkIn > standardStart
        isEarly = checkOut < standardEnd
        const workedMinutes = checkOut - checkIn
        otHours = checkOut > standardEnd ? (checkOut - standardEnd) / 60 : 0
        status = !isLate && !isEarly && workedMinutes >= standardMinutes ? 'du_cong' : 'thieu_cong'
      } else if (noShiftConfigured) {
        status = 'du_cong'
      }

      if (isLate) lateEarlyCount++
      if (isEarly) lateEarlyCount++
      otHoursTotal += otHours

      days.push({
        date: key,
        status,
        checkIn: checkIn !== null ? minutesToLabel(checkIn) : null,
        checkOut: checkOut !== null ? minutesToLabel(checkOut) : null,
        isLate,
        isEarly,
        otHours: Math.round(otHours * 100) / 100,
      })
      continue
    }

    if (nghiDayKeys.has(key)) {
      nghiDays++
      days.push({ date: key, status: 'nghi', checkIn: null, checkOut: null, isLate: false, isEarly: false, otHours: 0 })
      continue
    }

    if (isFuture) {
      days.push({ date: key, status: 'none', checkIn: null, checkOut: null, isLate: false, isEarly: false, otHours: 0 })
      continue
    }

    days.push({ date: key, status: 'thieu_cong', checkIn: null, checkOut: null, isLate: false, isEarly: false, otHours: 0 })
  }

  return NextResponse.json({
    shift: shift ? { name: shift.name, start_time: shift.start_time, end_time: shift.end_time } : null,
    noShiftConfigured,
    isMisaAuthoritative,
    days,
    stats: {
      tongCongDays,
      otHours: Math.round(otHoursTotal * 100) / 100,
      lateEarlyCount,
      nghiDays,
    },
  })
}
