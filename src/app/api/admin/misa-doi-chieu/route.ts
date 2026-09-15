import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/auth'
import { fetchMisaTimesheetSummary, fetchMisaTimesheetSummaryDetail } from '@/lib/misa'
import { GET as getTimesheet } from '../timesheet/route'

// Đối chiếu bảng công MISA tự tính (get-data-timesheet-summary(-detail))
// với bảng công iHNS tự tính, theo từng nhân viên đã khớp mã MISA
// (hrm_employee_requirements.misa_employee_code). CHỈ so 2 chỉ số cùng đơn
// vị (giờ làm thêm, số lần đi muộn/về sớm) — MISA trả tổng công theo GIỜ
// còn iHNS trả theo SỐ NGÀY, không ép so những thứ khác đơn vị.
//
// Tái dùng NGUYÊN VẸN công thức tính công iHNS bằng cách gọi thẳng handler
// GET của /api/admin/timesheet (đã có sẵn) cho từng nhân viên/tháng, KHÔNG
// viết lại công thức ở đây.
export async function GET(req: NextRequest) {
  const { supabase, unauthorized } = await requireAdminUser()
  if (unauthorized) return unauthorized

  const monthParam = req.nextUrl.searchParams.get('month') // "YYYY-MM"
  const now = new Date(Date.now() + 7 * 3600 * 1000)
  const year = monthParam ? Number(monthParam.slice(0, 4)) : now.getUTCFullYear()
  const month = monthParam ? Number(monthParam.slice(5, 7)) : now.getUTCMonth() + 1
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'month không hợp lệ, dùng dạng YYYY-MM' }, { status: 400 })
  }
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const fromDate = new Date(Date.UTC(year, month - 1, 1))
  const toDate = new Date(Date.UTC(year, month, 0))

  const { data: mapped } = await supabase
    .from('hrm_employee_requirements')
    .select('user_id, misa_employee_code, users:user_id(full_name)')
    .not('misa_employee_code', 'is', null)

  const employees = (mapped ?? []) as unknown as {
    user_id: string
    misa_employee_code: string
    users: { full_name: string } | null
  }[]

  if (employees.length === 0) {
    return NextResponse.json({ month: monthKey, rows: [] })
  }

  try {
    const summaries = await fetchMisaTimesheetSummary(fromDate, toDate)
    const detailByCode = new Map<string, Awaited<ReturnType<typeof fetchMisaTimesheetSummaryDetail>>[number]>()
    for (const s of summaries) {
      const details = await fetchMisaTimesheetSummaryDetail(s.TimeSheetsSummaryID)
      for (const d of details) {
        if (!detailByCode.has(d.EmployeeCode)) detailByCode.set(d.EmployeeCode, d)
      }
    }

    const rows = await Promise.all(
      employees.map(async (emp) => {
        const misa = detailByCode.get(emp.misa_employee_code) ?? null

        const tsRes = await getTimesheet(
          new NextRequest(`http://internal/api/admin/timesheet?userId=${emp.user_id}&month=${monthKey}`)
        )
        const ts = tsRes.ok ? await tsRes.json() : null

        return {
          user_id: emp.user_id,
          full_name: emp.users?.full_name ?? '—',
          misa_employee_code: emp.misa_employee_code,
          misa: misa
            ? {
                totalWorking: misa.TotalWorking,
                totalWorkingActual: misa.TotalWorkingActual,
                totalOverTime: misa.TotalOverTime,
                totalLeave: misa.TotalLeave,
                totalLateOutEarly: misa.TotalLateOutEarly,
              }
            : null,
          ihns: ts
            ? {
                tongCongDays: ts.stats.tongCongDays,
                otHours: ts.stats.otHours,
                lateEarlyCount: ts.stats.lateEarlyCount,
                nghiDays: ts.stats.nghiDays,
              }
            : null,
          otDiff: misa && ts ? Math.round((ts.stats.otHours - misa.TotalOverTime) * 100) / 100 : null,
          lateEarlyDiff: misa && ts ? ts.stats.lateEarlyCount - misa.TotalLateOutEarly : null,
        }
      })
    )

    return NextResponse.json({ month: monthKey, rows })
  } catch (e) {
    console.error('[misa-doi-chieu]', e)
    return NextResponse.json({ error: 'Không đối chiếu được với MISA' }, { status: 502 })
  }
}
