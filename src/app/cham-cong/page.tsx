'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, ClipboardList, LayoutGrid, Settings, XCircle, Loader2, LogIn, LogOut, MapPin, Wifi, ScanFace, type LucideIcon } from 'lucide-react'
import { CheckInWizard, type CheckInWizardResult } from '@/components/CheckInWizard'
import { formatTime, type AttendanceLog } from '@/components/AttendanceLogRow'
import { useAuth } from '@/contexts/auth'

function NavCard({ href, label, Icon }: { href: string; label: string; Icon: LucideIcon }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
        <Icon size={18} className="text-brand-500" />
      </div>
      <span className="flex-1 text-sm font-bold text-gray-800">{label}</span>
      <ChevronRight size={18} className="shrink-0 text-gray-300" />
    </Link>
  )
}

type StatusResponse = {
  logs: AttendanceLog[]
  nextType: 'check_in' | 'check_out'
  dayComplete: boolean
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 11) return 'Chào buổi sáng'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

export default function ChamCongPage() {
  const { user } = useAuth()
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [lastResult, setLastResult] = useState<CheckInWizardResult | null>(null)
  const [lastSubmittedType, setLastSubmittedType] = useState<'check_in' | 'check_out' | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [showConfirmOut, setShowConfirmOut] = useState(false)
  const [faceEnrolled, setFaceEnrolled] = useState<boolean | null>(null)

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/attendance/status')
    if (res.ok) setStatus(await res.json())
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  // Nhắc đăng ký khuôn mặt NGAY tại màn chấm công nếu chưa có — trước đây
  // phải tự vào Menu mới thấy, nhiều khả năng nhân viên không biết là thiếu
  // bước này cho tới khi chấm công thất bại vì "chưa đăng ký khuôn mặt".
  useEffect(() => {
    fetch('/api/face/enroll')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setFaceEnrolled(data.enrolled)
      })
  }, [])

  // Tự đóng modal thành công sau vài giây, không bắt người dùng phải bấm tay.
  useEffect(() => {
    if (!showSuccessModal) return
    const timer = setTimeout(() => setShowSuccessModal(false), 4000)
    return () => clearTimeout(timer)
  }, [showSuccessModal])

  // Mở wizard chấm công theo từng bước (Wi-Fi → vị trí → khuôn mặt) — toàn
  // bộ logic lấy GPS/kiểm tra điều kiện/chụp mặt/gửi API nằm trong
  // CheckInWizard, trang này chỉ cần biết wizard xong thì cập nhật gì.
  function openWizard() {
    if (!status) return
    setLastSubmittedType(status.nextType)
    setLastResult(null)
    setShowWizard(true)
  }

  async function handleWizardComplete(result: CheckInWizardResult) {
    setShowWizard(false)
    setLastResult(result)
    if (result.isSuccess) setShowSuccessModal(true)
    // Luôn làm mới trạng thái dù thành công hay bị server từ chối (vd đã đủ
    // 1 vào + 1 ra) — tránh giao diện hiện nút cũ dù server đã coi ngày đó
    // là xong, dễ bấm thêm vô ích.
    await loadStatus()
  }

  // Chấm công vào thì bấm là chạy luôn; chấm công RA cần xác nhận lại trước
  // — tránh bấm nhầm lúc đang định bấm "vào" (nút đổi màu/label theo trạng
  // thái, dễ bấm nhầm khi thao tác nhanh), hậu quả "ra" nhầm nặng hơn "vào" nhầm.
  function handleButtonClick() {
    if (!status || status.dayComplete) return
    if (status.nextType === 'check_out') {
      setShowConfirmOut(true)
      return
    }
    openWizard()
  }

  function handleConfirmOut() {
    setShowConfirmOut(false)
    openWizard()
  }

  const isCheckIn = status?.nextType === 'check_in'
  const successCheckIn = status?.logs.find((l) => l.type === 'check_in' && l.is_success) ?? null
  const successCheckOut = status?.logs.find((l) => l.type === 'check_out' && l.is_success) ?? null
  const lastCheckInTime = successCheckIn ? formatTime(successCheckIn.created_at) : null

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <div className="mb-6 px-1">
        <p className="text-lg font-bold text-gray-800">
          {greeting()}
          {user?.full_name ? `, ${user.full_name}` : ''}!
        </p>
        <p className="text-sm text-gray-400">Chúc bạn một ngày làm việc hiệu quả!</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <h2 className="border-b border-gray-100 px-5 py-3 text-sm font-bold text-gray-700">Chấm công hôm nay</h2>

        <div className="p-8 text-center">
          <p className="text-sm text-gray-400 mb-4">
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>

          {/* Check-in/Check-out trong ngày — có gì hiện đó: chưa chấm công
              thì trống hẳn, mới vào thì chỉ hiện "Check-in", xong cả 2 thì
              hiện đủ "Check-in" lẫn "Check-out". */}
          {(successCheckIn || successCheckOut) && (
            <div className="mb-6 space-y-1 text-left">
              {successCheckIn && (
                <p className="flex items-center gap-1.5 text-sm text-gray-700">
                  <LogIn size={14} className="shrink-0 text-brand-500" />
                  <span className="font-semibold">Check-in:</span> {formatTime(successCheckIn.created_at)}
                </p>
              )}
              {successCheckOut && (
                <p className="flex items-center gap-1.5 text-sm text-gray-700">
                  <LogOut size={14} className="shrink-0 text-accent-500" />
                  <span className="font-semibold">Check-out:</span> {formatTime(successCheckOut.created_at)}
                </p>
              )}
            </div>
          )}

          {!status ? (
            // Chưa có dữ liệu thật (status vẫn null lúc đang tải) — hiện
            // "đang tải", KHÔNG đoán isCheckIn để tránh nhấp nháy sai nút
            // (mặc định isCheckIn=false khi status null nên trước đây có lúc
            // hiện lộn "Kết thúc ca" một nhoáng trước khi có data thật).
            <div className="w-full flex items-center justify-center py-4 rounded-2xl bg-gray-50">
              <Loader2 size={18} className="animate-spin text-gray-400" />
            </div>
          ) : (
            !status.dayComplete && (
              <button
                onClick={handleButtonClick}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold text-white transition-colors ${
                  isCheckIn ? 'bg-brand-500 hover:bg-brand-600' : 'bg-accent-500 hover:bg-accent-600'
                }`}
              >
                {isCheckIn ? <LogIn size={18} /> : <LogOut size={18} />}
                {isCheckIn ? 'Bắt đầu ca' : 'Kết thúc ca'}
              </button>
            )
          )}

          {/* Thất bại (thiếu GPS hoặc sai mạng lúc GỬI THẬT, dù wizard đã cho
              qua từng bước) hiện banner cảnh báo tại chỗ — chỉ trường hợp
              THÀNH CÔNG mới bật modal riêng bên dưới. */}
          {lastResult && !lastResult.isSuccess && (
            <div className="mt-4 flex items-start gap-2 text-left text-sm text-red-600 bg-red-50 rounded-xl p-3">
              <XCircle size={16} className="shrink-0 mt-0.5" />
              <span>
                Chấm công KHÔNG hợp lệ — {lastResult.failReason ?? 'không đạt điều kiện'}.
                {lastResult.nearestLocationName && ` (${lastResult.nearestLocationName})`}{' '}
                Lượt này vẫn được lưu lại để quản lý xem xét.
              </span>
            </div>
          )}
        </div>
      </div>

      {faceEnrolled === false && (
        <div className="mt-6 rounded-2xl border border-dashed border-accent-300 bg-accent-50/60 p-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-100">
            <ScanFace size={22} className="text-accent-500" />
          </div>
          <p className="mb-1 text-sm font-bold text-gray-800">Bạn chưa thiết lập dữ liệu khuôn mặt</p>
          <p className="mb-4 text-xs text-gray-500">
            Cần thiết lập dữ liệu khuôn mặt trước để hệ thống xác thực đúng người mỗi lần chấm công.
          </p>
          <Link
            href="/dang-ky-khuon-mat"
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-600"
          >
            <ScanFace size={14} />
            Thiết lập dữ liệu khuôn mặt ngay
          </Link>
        </div>
      )}

      <div className="mt-6 space-y-4">
        <NavCard href="/lich-su-cham-cong" label="Bảng công" Icon={ClipboardList} />
        <NavCard href="/menu" label="Menu" Icon={LayoutGrid} />
        <NavCard href="/cai-dat" label="Cài đặt" Icon={Settings} />
      </div>

      {/* Modal chấm công thành công */}
      {showSuccessModal && lastResult?.isSuccess && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowSuccessModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 size={32} className="text-green-500" />
            </div>
            <h2 className="mb-1 text-lg font-bold text-gray-800">
              {lastSubmittedType === 'check_in' ? 'Chấm công vào thành công!' : 'Chấm công ra thành công!'}
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              {lastResult.nearestLocationName ? ` · ${lastResult.nearestLocationName}` : ''}
            </p>
            {lastResult.isWithinRadius && (
              <div className="mb-2 flex items-center justify-center gap-1.5 rounded-xl bg-brand-50 p-2 text-xs text-brand-600">
                <MapPin size={13} />
                Đúng vị trí{lastResult.nearestLocationName ? ` "${lastResult.nearestLocationName}"` : ''}
              </div>
            )}
            {lastResult.isIpVerified && (
              <div className="mb-2 flex items-center justify-center gap-1.5 rounded-xl bg-brand-50 p-2 text-xs text-brand-600">
                <Wifi size={13} />
                Đúng mạng "{lastResult.ipMatchedLocationName}"
              </div>
            )}
            {lastResult.isFaceVerified && (
              <div className="mb-4 flex items-center justify-center gap-1.5 rounded-xl bg-brand-50 p-2 text-xs text-brand-600">
                <ScanFace size={13} />
                Đã xác thực khuôn mặt
              </div>
            )}
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full rounded-xl bg-accent-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-600"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Xác nhận chấm công ra */}
      {showConfirmOut && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowConfirmOut(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-50">
              <LogOut size={32} className="text-accent-500" />
            </div>
            <h2 className="mb-1 text-lg font-bold text-gray-800">Xác nhận chấm công ra?</h2>
            <p className="mb-6 text-sm text-gray-500">
              {lastCheckInTime ? `Bạn đã chấm công vào lúc ${lastCheckInTime} hôm nay.` : 'Xác nhận bạn muốn kết thúc ca làm hôm nay.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmOut(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleConfirmOut}
                className="flex-1 rounded-xl bg-accent-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-600"
              >
                Chấm công ra
              </button>
            </div>
          </div>
        </div>
      )}

      {showWizard && status && (
        <CheckInWizard
          type={status.nextType}
          onCancel={() => setShowWizard(false)}
          onComplete={handleWizardComplete}
        />
      )}
    </div>
  )
}
