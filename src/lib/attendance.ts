import { haversineDistanceMeters } from './geo'

type WorkLocationRow = {
  id: string
  name: string
  lat: number
  lng: number
  radius_m: number
  office_ip: string | null
}

/**
 * Tính điều kiện GPS + IP văn phòng cho 1 toạ độ — dùng chung giữa route
 * check-in thật và route precheck (kiểm tra nhanh trước khi mở camera).
 * KHÔNG xử lý khuôn mặt (tách riêng, cần embedding từ FaceCapture).
 *
 * `assignedLocationId`: nếu admin đã gán CỐ ĐỊNH 1 địa điểm cho nhân viên
 * này (bảng hrm_employee_requirements), dùng ĐÚNG địa điểm đó để tính GPS/IP
 * — không tự động chọn địa điểm gần nhất nữa. `null`/`undefined` = giữ hành
 * vi cũ (tự động lấy địa điểm gần nhất trong số các địa điểm đang bật).
 *
 * `supabase` cố tình gõ kiểu `any` — kiểu thật của client (`@supabase/supabase-js`)
 * quá phức tạp/đệ quy, ép TypeScript so khớp cấu trúc với 1 interface tự viết
 * gây lỗi "Type instantiation is excessively deep". Hàm dùng nội bộ, không
 * lộ ra API công khai nên chấp nhận đánh đổi này.
 */
export async function evaluateLocation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  lat: number,
  lng: number,
  requestIp: string | null,
  assignedLocationId?: string | null,
) {
  const { data: locations } = (await supabase
    .from('hrm_work_locations')
    .select('id, name, lat, lng, radius_m, office_ip')
    .eq('is_active', true)) as { data: WorkLocationRow[] | null }

  let nearest: { id: string; name: string; distance: number; radius_m: number; office_ip: string | null } | null = null

  if (assignedLocationId) {
    // Nhân viên đã được gán cố định 1 địa điểm — chỉ tính theo đúng địa điểm
    // đó, kể cả khi có địa điểm khác gần hơn về mặt toạ độ. Nếu địa điểm được
    // gán đã bị tắt/xoá, `nearest` sẽ là null → mọi điều kiện GPS/IP tự động
    // fail (hợp lý: cấu hình đang trỏ tới 1 địa điểm không còn hiệu lực).
    const assigned = (locations ?? []).find((l) => l.id === assignedLocationId)
    if (assigned) {
      const distance = haversineDistanceMeters(lat, lng, assigned.lat, assigned.lng)
      nearest = { id: assigned.id, name: assigned.name, distance, radius_m: assigned.radius_m, office_ip: assigned.office_ip }
    }
  } else {
    for (const loc of locations ?? []) {
      const distance = haversineDistanceMeters(lat, lng, loc.lat, loc.lng)
      if (!nearest || distance < nearest.distance) {
        nearest = { id: loc.id, name: loc.name, distance, radius_m: loc.radius_m, office_ip: loc.office_ip }
      }
    }
  }

  const isWithinRadius = nearest ? nearest.distance <= nearest.radius_m : false

  let ipMatchedLocationName: string | null = null
  if (requestIp) {
    for (const loc of locations ?? []) {
      if (!loc.office_ip) continue
      const validIps = loc.office_ip.split(',').map((ip: string) => ip.trim())
      if (validIps.includes(requestIp)) {
        ipMatchedLocationName = loc.name
        break
      }
    }
  }
  const isIpVerified = ipMatchedLocationName !== null

  // Chỉ ràng buộc IP theo địa điểm đang xét (gần nhất, hoặc địa điểm được
  // gán cố định) — địa điểm không khai office_ip thì coi như không yêu cầu
  // IP, tránh khoá chấm công ở nơi cố tình không có mạng cố định.
  const nearestRequiresIp = !!nearest?.office_ip
  const nearestIpOk =
    !nearestRequiresIp ||
    (requestIp !== null && nearest!.office_ip!.split(',').map((ip) => ip.trim()).includes(requestIp))

  // Tên các địa điểm có cấu hình IP văn phòng — hiện cho nhân viên biết đang
  // có những văn phòng nào để đối chiếu khi bước Wi-Fi thất bại. Chỉ lộ TÊN,
  // không lộ IP thật (không cần thiết để nhân viên tự "gõ" IP giả).
  const officeLocationNames = (locations ?? []).filter((l) => l.office_ip).map((l) => l.name)

  return { nearest, isWithinRadius, isIpVerified, ipMatchedLocationName, nearestIpOk, officeLocationNames }
}

export type EmployeeRequirements = {
  requireGps: boolean
  requireWifi: boolean
  requireFace: boolean
  locationId: string | null
}

/**
 * Đọc cấu hình riêng của 1 nhân viên — điều kiện nào bắt buộc + có bị gán
 * cố định 1 địa điểm hay không. Mặc định cả 3 điều kiện bắt buộc và KHÔNG
 * gán địa điểm cố định (tự động lấy gần nhất) nếu admin chưa cấu hình gì.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getEmployeeRequirements(supabase: any, userId: string): Promise<EmployeeRequirements> {
  const { data } = await supabase
    .from('hrm_employee_requirements')
    .select('require_gps, require_wifi, require_face, location_id')
    .eq('user_id', userId)
    .maybeSingle()

  return {
    requireGps: data?.require_gps ?? true,
    requireWifi: data?.require_wifi ?? true,
    requireFace: data?.require_face ?? true,
    locationId: data?.location_id ?? null,
  }
}

// Ngưỡng mặc định nếu vì lý do gì đó chưa có dòng cấu hình nào trong DB
// (chưa chạy migration, hoặc lỡ bị xoá) — giữ đúng giá trị đã chốt trước khi
// có bảng cấu hình này.
const DEFAULT_FACE_MATCH_THRESHOLD = 0.3

/**
 * Đọc ngưỡng khớp khuôn mặt hiện tại (admin chỉnh ở /admin/yeu-cau-cham-cong) —
 * dùng chung cho route check-in thật sự thực thi so khớp.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getFaceMatchThreshold(supabase: any): Promise<number> {
  const { data } = await supabase.from('hrm_app_settings').select('face_match_threshold').eq('id', 1).maybeSingle()
  return typeof data?.face_match_threshold === 'number' ? data.face_match_threshold : DEFAULT_FACE_MATCH_THRESHOLD
}
