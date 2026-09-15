'use client'

import Link from 'next/link'
import { ChevronRight, ScanFace, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'

function Row({ href, label, Icon }: { href: string; label: string; Icon: LucideIcon }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50">
      <Icon size={18} className="shrink-0 text-brand-500" />
      <span className="flex-1 text-sm font-medium text-gray-700">{label}</span>
      <ChevronRight size={16} className="shrink-0 text-gray-300" />
    </Link>
  )
}

// Màn "Cài đặt" — gom các trang cấu hình CỦA CHÍNH NHÂN VIÊN (khuôn mặt...).
// Không còn nằm trên thanh điều hướng dưới đáy nữa — giờ là màn con, vào từ
// mục "Cài đặt" trong Tài khoản. Đăng xuất cũng đã chuyển sang Tài khoản,
// không lặp lại ở đây nữa. Cấu hình dành cho ADMIN (địa điểm, ca làm việc,
// yêu cầu theo nhân viên...) đã chuyển hết sang /quan-li-cham-cong (vào từ
// Menu), không còn ở đây nữa.
export default function CaiDatPage() {
  return (
    <div>
      <PageHeader title="Cài đặt" />
      <div className="mx-auto max-w-md space-y-6 px-4 py-6">
        <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <Row href="/dang-ky-khuon-mat" label="Khuôn mặt" Icon={ScanFace} />
        </div>
      </div>
    </div>
  )
}
