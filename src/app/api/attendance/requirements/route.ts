import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { getEmployeeRequirements } from '@/lib/attendance'

// Cho client biết TRƯỚC những bước nào cần hiện trong wizard chấm công
// (Wi-Fi / vị trí / khuôn mặt) — tránh hiện bước thừa cho nhân viên không bị
// bắt buộc điều kiện đó (admin cấu hình ở /quan-li-cham-cong/yeu-cau).
export async function GET() {
  const { user, supabase, unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const requirements = await getEmployeeRequirements(supabase, user!.id)
  return NextResponse.json(requirements)
}
