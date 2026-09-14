import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/auth'
import { getClientIp } from '@/lib/geo'

// Trả về IP công cộng của chính admin đang gọi — dùng ở trang "Địa điểm chấm
// công" để admin lấy nhanh IP văn phòng đang đứng, khỏi phải mở tay 1 trang
// "what is my ip" khác rồi copy-paste qua.
export async function GET(req: NextRequest) {
  const { unauthorized } = await requireAdminUser()
  if (unauthorized) return unauthorized

  const ip = getClientIp(req.headers)
  if (!ip) return NextResponse.json({ error: 'Không xác định được IP' }, { status: 404 })
  return NextResponse.json({ ip })
}
