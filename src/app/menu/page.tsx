'use client'

import Link from 'next/link'
import { Fingerprint, MessageSquareText, MonitorCog, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/contexts/auth'

function Tile({ href, label, Icon, color }: { href: string; label: string; Icon: LucideIcon; color: string }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-2 text-center">
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
      <span className="text-xs font-medium text-gray-700">{label}</span>
    </Link>
  )
}

// Màn "Menu" — gom các TÍNH NĂNG phụ (không phải cấu hình/settings) mà nhân
// viên/admin thỉnh thoảng mới dùng tới, thay vì liệt kê hết ra thanh điều
// hướng dưới đáy (chỉ giữ đúng 3 mục cố định: Trang chủ / Menu / Cài đặt).
// "Chấm công" có mặt ở đây như 1 lối vào thứ 2 tới Trang chủ (song song với
// nút bong bóng nổi ở đó) — "Khuôn mặt" đã chuyển sang Cài đặt.
//
// "Quản lý chấm công" gộp toàn bộ 5 mục admin cũ (Báo cáo, Đơn từ quản trị,
// Quản trị dữ liệu, Địa điểm, Ca làm việc...) vào 1 khu THUẦN DESKTOP riêng ở
// /quan-li-cham-cong (xem AppShell.tsx) — thay cho việc rải rác nhiều tile.
export default function MenuPage() {
  const { user } = useAuth()
  const isAdmin = user?.is_super_admin || user?.is_boss

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-5 text-lg font-bold text-gray-800">Menu</h1>
      <div className="grid grid-cols-4 gap-4">
        <Tile href="/" label="Chấm công" Icon={Fingerprint} color="bg-brand-500" />
        <Tile href="/don-tu" label="Đơn từ" Icon={MessageSquareText} color="bg-accent-500" />
        {isAdmin && (
          <Tile href="/quan-li-cham-cong" label="Quản lý chấm công" Icon={MonitorCog} color="bg-red-500" />
        )}
      </div>
    </div>
  )
}
