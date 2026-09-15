import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/auth'

// Công tắc bật/tắt tính năng đẩy chấm công iHNS -> MISA (hrm_app_settings,
// bảng singleton id=1) — logic đẩy thật xem pushMisaCheckIn trong
// src/app/api/attendance/check-in/route.ts, route này chỉ đọc/ghi công tắc.
export async function GET() {
  const { supabase, unauthorized } = await requireAdminUser()
  if (unauthorized) return unauthorized

  const { data } = await supabase.from('hrm_app_settings').select('misa_push_enabled').eq('id', 1).maybeSingle()
  return NextResponse.json({ misa_push_enabled: data?.misa_push_enabled ?? false })
}

export async function PATCH(req: NextRequest) {
  const { supabase, unauthorized } = await requireAdminUser()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  if (typeof body?.misa_push_enabled !== 'boolean') {
    return NextResponse.json({ error: 'Thiếu misa_push_enabled' }, { status: 400 })
  }

  const { error } = await supabase
    .from('hrm_app_settings')
    .update({ misa_push_enabled: body.misa_push_enabled, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) return NextResponse.json({ error: 'Không lưu được cấu hình' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
