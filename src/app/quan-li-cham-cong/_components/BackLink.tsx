'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// Nút quay về dùng chung cho mọi màn con trong /quan-li-cham-cong — khu vực
// này render NGOÀI khung mobile (AppShell bỏ qua route này, xem AppShell.tsx),
// không có thanh điều hướng nào khác nên cần lối quay lại nhanh.
export function BackLink({ href = '/quan-li-cham-cong', label = 'Quản lý chấm công' }: { href?: string; label?: string }) {
  return (
    <Link href={href} className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600">
      <ArrowLeft size={15} />
      {label}
    </Link>
  )
}
