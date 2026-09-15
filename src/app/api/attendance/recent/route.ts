import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'

// Lịch sử chấm công gần đây của CHÍNH nhân viên đang gọi — dùng chung cho
// card "Dữ liệu chấm công" ở trang chủ (mặc định 3 ngày) và trang xem đầy đủ
// /lich-su-cham-cong (?days lớn hơn), cùng 1 API khác tham số days.
export async function GET(req: NextRequest) {
  const { user, supabase, unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const daysParam = Number(req.nextUrl.searchParams.get('days'))
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 3

  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  since.setHours(0, 0, 0, 0)

  const { data: logs, error } = await supabase
    .from('hrm_attendance_logs')
    .select(
      'id, type, created_at, channel, is_within_radius, is_ip_verified, is_face_verified, is_success, distance_m, face_distance, hrm_work_locations(name)',
    )
    .eq('user_id', user!.id)
    // Chỉ lấy lượt chấm công THÀNH CÔNG — đây là màn xem lại lịch sử cho
    // nhân viên tự đối chiếu công, không phải log audit đầy đủ (đã có riêng
    // ở /quan-li-cham-cong/bao-cao cho admin), nên không cần lẫn các lượt thất bại vào.
    .eq('is_success', true)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Không tải được dữ liệu' }, { status: 500 })
  return NextResponse.json({ logs: logs ?? [] })
}
