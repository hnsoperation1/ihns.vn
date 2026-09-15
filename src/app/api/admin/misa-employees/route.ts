import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/auth'
import { fetchMisaEmployees } from '@/lib/misa'

// Danh sách nhân viên bên MISA — dùng cho picker khớp mã ở
// /quan-li-cham-cong/yeu-cau (thay ô nhập tay dễ gõ sai).
export async function GET() {
  const { unauthorized } = await requireAdminUser()
  if (unauthorized) return unauthorized

  try {
    const employees = await fetchMisaEmployees()
    return NextResponse.json({ employees })
  } catch (e) {
    console.error('[misa-employees]', e)
    return NextResponse.json({ error: 'Không tải được danh sách nhân viên MISA' }, { status: 502 })
  }
}
