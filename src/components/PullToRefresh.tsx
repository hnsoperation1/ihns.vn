'use client'

import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

const PULL_THRESHOLD = 70 // px cần kéo xuống mới nhả tay là làm mới
const MAX_PULL = 100 // càng kéo càng "nặng tay" (rubber-band), không cho kéo quá xa
const RESISTANCE = 0.45

// Trình duyệt bình thường đã có pull-to-refresh gốc của hệ điều hành/trình
// duyệt, nhưng khi cài ra màn hình chính (PWA, display-mode: standalone) thì
// cơ chế đó bị tắt — vuốt xuống ở đầu trang không có tác dụng gì, người dùng
// không có cách nào làm mới ngoài việc thoát app rồi mở lại. Component này tự
// bắt cử chỉ vuốt xuống mạnh và làm mới, CHỈ bật khi đang chạy standalone để
// khỏi chồng lên pull-to-refresh gốc của trình duyệt.
export function PullToRefresh({ children, className }: { children: React.ReactNode; className?: string }) {
  const mainRef = useRef<HTMLElement>(null)
  const startY = useRef<number | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const isIosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true
    setEnabled(window.matchMedia('(display-mode: standalone)').matches || isIosStandalone)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const el = mainRef.current
    if (!el) return

    function onTouchStart(e: TouchEvent) {
      startY.current = el!.scrollTop <= 0 && !refreshing ? e.touches[0].clientY : null
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null) return
      const delta = e.touches[0].clientY - startY.current
      if (delta <= 0) {
        setPull(0)
        return
      }
      setPull(Math.min(MAX_PULL, delta * RESISTANCE))
      e.preventDefault()
    }

    function onTouchEnd() {
      if (startY.current === null) return
      startY.current = null
      setPull((current) => {
        if (current >= PULL_THRESHOLD) {
          setRefreshing(true)
          window.location.reload()
          return PULL_THRESHOLD
        }
        return 0
      })
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [enabled, refreshing])

  return (
    <main ref={mainRef} className={`relative overscroll-y-contain ${className ?? ''}`}>
      {enabled && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center justify-center gap-1 overflow-hidden transition-[height]"
          style={{ height: pull, transitionDuration: startY.current === null ? '150ms' : '0ms' }}
        >
          <RefreshCw
            size={18}
            className={`text-gray-400 ${refreshing ? 'animate-spin' : ''}`}
            style={refreshing ? undefined : { transform: `rotate(${(pull / PULL_THRESHOLD) * 360}deg)` }}
          />
          <span className="text-[11px] font-medium text-gray-400">{refreshing ? 'Đang tải lại...' : 'Tải lại'}</span>
        </div>
      )}
      <div
        style={
          enabled
            ? {
                // `transform: translateY(0px)` VẪN được tính là "có transform" theo
                // chuẩn CSS — biến div này thành khung chứa mới cho mọi phần tử con
                // `position: fixed` (vd modal xác nhận), khiến chúng bị cuộn theo
                // nội dung thay vì cố định theo màn hình. Chỉ đặt transform thật khi
                // đang kéo (pull > 0), còn lại dùng 'none' để trả lại đúng hành vi
                // `fixed` gốc (neo theo viewport).
                transform: pull > 0 ? `translateY(${pull}px)` : 'none',
                transition: startY.current === null ? 'transform 150ms' : undefined,
              }
            : undefined
        }
      >
        {children}
      </div>
    </main>
  )
}
