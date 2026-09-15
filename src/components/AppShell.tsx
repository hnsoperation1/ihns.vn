'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth'
import { BottomNav, BOTTOM_NAV_PATHS } from './BottomNav'
import { DesktopNotice } from './DesktopNotice'
import { PullToRefresh } from './PullToRefresh'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  useEffect(() => {
    if (loading) return
    // Giữ lại đường dẫn định vào ban đầu (vd trang xác nhận đăng nhập QR mở
    // từ link quét) — không phải lúc nào đăng nhập xong cũng nên về Trang chủ.
    // Đọc thẳng window.location thay vì useSearchParams() để khỏi phải bọc
    // Suspense cho MỌI trang tĩnh trong app (AppShell nằm ở layout gốc).
    if (!user && !isLoginPage) router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    if (user && isLoginPage) {
      const next = new URLSearchParams(window.location.search).get('next')
      router.replace(next || '/')
    }
  }, [user, loading, isLoginPage, pathname, router])

  if (loading || (!user && !isLoginPage)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="font-black text-2xl tracking-wide">
            <span className="text-brand-600">i</span>
            <span className="text-accent-500">HNS</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-brand-400"
                style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (isLoginPage) return <>{children}</>

  // /quan-li-cham-cong là khu quản trị THUẦN DESKTOP (bảng/modal, không tối
  // ưu cho di động) — bỏ hẳn khung mobile (banner nhắc dùng web.ihns.vn,
  // PullToRefresh, thanh điều hướng dưới đáy), tự lo layout riêng.
  if (pathname.startsWith('/quan-li-cham-cong')) return <>{children}</>

  // Thanh điều hướng dưới đáy CHỈ hiện ở các màn cấp 1 (trong BOTTOM_NAV_PATHS)
  // — giống app di động thật (MISA...): vào màn con thì thanh này tự biến
  // mất, nhường chỗ cho header riêng (PageHeader) của màn con đó tự quyết
  // định hiển thị gì, không phải khung cố định bất biến toàn app.
  const showBottomNav = BOTTOM_NAV_PATHS.includes(pathname)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      <DesktopNotice />
      <PullToRefresh className={`flex-1 overflow-y-auto ${showBottomNav ? 'pb-[calc(env(safe-area-inset-bottom)+80px)]' : ''}`}>
        {children}
      </PullToRefresh>
      {showBottomNav && <BottomNav />}
    </div>
  )
}
