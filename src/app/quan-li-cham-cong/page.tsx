'use client'

import Link from 'next/link'
import { Clock, FileBarChart, GitCompare, MapPin, MessageSquareText, ShieldAlert, SlidersHorizontal, UserRound, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/contexts/auth'

function Tile({ href, label, Icon }: { href: string; label: string; Icon: LucideIcon }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-gray-200 bg-white p-5 text-center shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/40"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
        <Icon size={20} />
      </div>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </Link>
  )
}

/**
 * Khu quản trị chấm công THUẦN DESKTOP trên chính ihns.vn — thay thế 8 màn
 * /admin/* cũ (thiết kế mobile). AppShell bỏ qua toàn bộ route này (không
 * banner/PullToRefresh/thanh điều hướng dưới đáy), tự lo layout riêng.
 */
export default function QuanLiChamCongPage() {
  const { user, loading: authLoading } = useAuth()
  const isAdmin = user?.is_super_admin || user?.is_boss

  if (authLoading) return null
  if (!isAdmin) {
    return <div className="p-8 text-center text-sm text-gray-500">Chỉ Super Admin hoặc Boss mới truy cập được trang này.</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="font-black text-lg tracking-wide">
            <span className="text-brand-600">i</span>
            <span className="text-accent-500">HNS</span>
            <span className="ml-2 text-sm font-medium text-gray-400">Quản lý chấm công</span>
          </div>
          <Link href="/" className="text-sm text-gray-400 hover:text-brand-600">
            Về ứng dụng di động
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Quản lý chấm công</h1>
        <p className="text-sm text-gray-400 mb-6">Quản lý toàn bộ cấu hình chấm công — địa điểm, ca làm việc, đơn từ...</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Tile href="/quan-li-cham-cong/dia-diem" label="Địa điểm chấm công" Icon={MapPin} />
          <Tile href="/quan-li-cham-cong/ca-lam-viec" label="Ca làm việc" Icon={Clock} />
          <Tile href="/quan-li-cham-cong/yeu-cau" label="Yêu cầu theo nhân viên" Icon={SlidersHorizontal} />
          <Tile href="/quan-li-cham-cong/nhan-vien" label="Dữ liệu theo nhân viên" Icon={UserRound} />
          <Tile href="/quan-li-cham-cong/duyet-don-tu" label="Duyệt đơn từ" Icon={MessageSquareText} />
          <Tile href="/quan-li-cham-cong/don-tu" label="Đơn từ (xem lại)" Icon={MessageSquareText} />
          <Tile href="/quan-li-cham-cong/bao-cao" label="Báo cáo chấm công" Icon={FileBarChart} />
          <Tile href="/quan-li-cham-cong/doi-chieu-misa" label="Đối chiếu MISA" Icon={GitCompare} />
          <Tile href="/quan-li-cham-cong/quan-tri" label="Quản trị dữ liệu / MISA" Icon={ShieldAlert} />
        </div>
      </div>
    </div>
  )
}
