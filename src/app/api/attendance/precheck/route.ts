import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { getClientIp } from '@/lib/geo'
import { evaluateLocation, getEmployeeRequirements } from '@/lib/attendance'

// Kiểm tra nhanh GPS + IP văn phòng NGAY SAU khi lấy toạ độ, TRƯỚC khi mở
// camera xin khuôn mặt — sai vị trí/mạng thì báo luôn, đỡ bắt nhân viên
// chụp ảnh vô ích. Không ghi log (chỉ là bước kiểm tra sơ bộ), lượt chấm
// công thật sự vẫn qua /api/attendance/check-in như cũ.
export async function POST(req: NextRequest) {
  const { user, supabase, unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  const lat = body?.lat
  const lng = body?.lng

  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: 'Dữ liệu vị trí không hợp lệ' }, { status: 400 })
  }

  const requirements = await getEmployeeRequirements(supabase, user!.id)
  const requestIp = getClientIp(req.headers)
  const { nearest, isWithinRadius, nearestIpOk, officeLocationNames } = await evaluateLocation(
    supabase,
    lat,
    lng,
    requestIp,
    requirements.locationId,
  )

  const gpsOk = !requirements.requireGps || isWithinRadius
  const wifiOk = !requirements.requireWifi || nearestIpOk

  const reasons: string[] = []
  if (!gpsOk) reasons.push('ngoài khu vực GPS cho phép')
  if (!wifiOk) reasons.push('sai mạng văn phòng')

  return NextResponse.json({
    ok: gpsOk && wifiOk,
    // Tách riêng từng điều kiện (thay vì chỉ có `ok` gộp) để wizard chấm công
    // hiện được kết quả TỪNG BƯỚC (Wi-Fi, vị trí) độc lập với nhau.
    gpsOk,
    wifiOk,
    nearestLocationName: nearest?.name ?? null,
    distanceM: nearest ? Math.round(nearest.distance) : null,
    failReason: reasons.length > 0 ? reasons.join(', ') : null,
    officeLocationNames,
  })
}
