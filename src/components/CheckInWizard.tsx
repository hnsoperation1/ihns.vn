'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronLeft, Loader2, MapPin, Wifi, XCircle, type LucideIcon } from 'lucide-react'
import { FaceCapture, type FaceSample } from './FaceCapture'

type StepKind = 'wifi' | 'gps' | 'face'

type PrecheckResult = {
  gpsOk: boolean
  wifiOk: boolean
  nearestLocationName: string | null
  distanceM: number | null
  officeLocationNames: string[]
}

export type CheckInWizardResult = {
  nearestLocationName: string | null
  distanceM: number | null
  radiusM: number | null
  isWithinRadius: boolean
  isIpVerified: boolean
  ipMatchedLocationName: string | null
  isSuccess: boolean
  failReason: string | null
  isFaceVerified: boolean
  faceDistance: number | null
}

type Props = {
  type: 'check_in' | 'check_out'
  onCancel: () => void
  onComplete: (result: CheckInWizardResult) => void
}

const STEP_META: Record<Exclude<StepKind, 'face'>, { title: string; Icon: LucideIcon; checkingLabel: string }> = {
  wifi: { title: 'Xác thực Wi-Fi', Icon: Wifi, checkingLabel: 'Đang kiểm tra mạng Wi-Fi văn phòng...' },
  gps: { title: 'Xác thực vị trí', Icon: MapPin, checkingLabel: 'Đang xác định vị trí...' },
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Trình duyệt không hỗ trợ định vị'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    })
  })
}

function Shell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-gray-100 px-2 py-3">
        <button type="button" onClick={onBack} className="p-1.5 text-gray-500 hover:text-gray-700">
          <ChevronLeft size={22} />
        </button>
        <h1 className="flex-1 pr-8 text-center text-base font-bold text-gray-800">{title}</h1>
      </div>
      {children}
    </div>
  )
}

/**
 * Chấm công theo TỪNG BƯỚC riêng biệt (Wi-Fi văn phòng → vị trí GPS → khuôn
 * mặt) thay vì gộp hết vào 1 lần bấm — mỗi bước hiện rõ kết quả trước khi
 * cho qua bước tiếp theo. Bước nào không bị bắt buộc (admin tắt ở
 * /admin/yeu-cau-cham-cong) thì tự động BỎ QUA, không hiện ra.
 *
 * QUAN TRỌNG: vào Bước 1 là hiện NGAY (không có màn "đang tải" trung gian
 * trước khi thấy số bước) — quá trình xin GPS + gọi API kiểm tra Wi-Fi/vị
 * trí chạy NGẦM ngay bên trong màn Bước 1, tự chuyển từ spinner "đang kiểm
 * tra" sang kết quả thành công/thất bại tại chỗ. Trước đây gộp chờ cả 2 điều
 * kiện xong xuôi ở 1 màn hình riêng rồi mới vào Bước 1 — sai vì người dùng
 * không thấy Bước 1 "đang chạy", chỉ thấy kết quả có sẵn.
 *
 * Lưu ý: trình duyệt KHÔNG có API đọc tên mạng Wi-Fi thật — bước "Wi-Fi" ở
 * đây kiểm tra bằng địa chỉ IP công cộng so với danh sách IP văn phòng đã
 * cấu hình, không phải đọc SSID thật như app native.
 */
export function CheckInWizard({ type, onCancel, onComplete }: Props) {
  const [phase, setPhase] = useState<'steps' | 'submitting' | 'error'>('steps')
  const [fatalError, setFatalError] = useState('')
  const [steps, setSteps] = useState<StepKind[] | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [precheck, setPrecheck] = useState<PrecheckResult | null>(null)
  const positionRef = useRef<GeolocationPosition | null>(null)

  // Xin GPS + gọi precheck — chạy NGAY khi Bước 1 đã hiện lên màn hình, không
  // chờ trước ở đâu cả. Dùng cho cả lần đầu vào wizard lẫn bấm "Thử lại".
  const loadChecks = useCallback(async () => {
    setPrecheck(null)
    setFatalError('')
    try {
      const position = await getPosition()
      positionRef.current = position

      const res = await fetch('/api/attendance/precheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: position.coords.latitude, lng: position.coords.longitude }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFatalError(data.error ?? 'Không kiểm tra được vị trí')
        setPhase('error')
        return
      }
      setPrecheck(data)
    } catch (err) {
      const geoErr = err as GeolocationPositionError
      if (typeof geoErr?.code === 'number') {
        setFatalError(
          geoErr.code === geoErr.PERMISSION_DENIED
            ? 'Bạn cần cho phép truy cập vị trí để chấm công'
            : 'Không lấy được vị trí GPS — thử lại ở nơi tín hiệu tốt hơn',
        )
      } else {
        setFatalError(err instanceof Error ? err.message : 'Có lỗi xảy ra')
      }
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const requirements = await fetch('/api/attendance/requirements').then((r) => r.json())
        if (cancelled) return

        const stepList: StepKind[] = []
        if (requirements.requireWifi) stepList.push('wifi')
        if (requirements.requireGps) stepList.push('gps')
        if (requirements.requireFace) stepList.push('face')

        if (stepList.length === 0) {
          // Không bị bắt buộc điều kiện nào cả — chấm công thẳng luôn, không
          // cần hiện bước nào.
          setPhase('submitting')
          const position = await getPosition()
          if (cancelled) return
          positionRef.current = position
          await submitFinal(position, undefined)
          return
        }

        setStepIndex(0)
        setSteps(stepList)
        // Bước 1 hiện ngay, việc kiểm tra Wi-Fi/vị trí chạy ngầm bên trong nó.
        loadChecks()
      } catch (err) {
        if (cancelled) return
        setFatalError(err instanceof Error ? err.message : 'Có lỗi xảy ra')
        setPhase('error')
      }
    }
    init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submitFinal(position: GeolocationPosition, faceEmbedding: number[] | undefined) {
    setPhase('submitting')
    try {
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          type,
          faceEmbedding,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFatalError(data.error ?? 'Chấm công thất bại')
        setPhase('error')
        return
      }
      onComplete(data)
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : 'Có lỗi xảy ra')
      setPhase('error')
    }
  }

  function handleFaceCapture(samples: FaceSample[]) {
    if (!positionRef.current) return
    submitFinal(positionRef.current, samples[0]?.embedding)
  }

  function advanceStep() {
    if (!steps) return
    const next = stepIndex + 1
    if (next >= steps.length) {
      // Hết danh sách bước mà không có bước khuôn mặt — chấm công luôn.
      if (positionRef.current) submitFinal(positionRef.current, undefined)
      return
    }
    setStepIndex(next)
  }

  if (phase === 'submitting') {
    return (
      <Shell title={type === 'check_in' ? 'Chấm công vào' : 'Chấm công ra'} onBack={onCancel}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-gray-500">
          <Loader2 size={28} className="animate-spin" />
          <p className="text-sm">Đang gửi dữ liệu chấm công...</p>
        </div>
      </Shell>
    )
  }

  if (phase === 'error') {
    return (
      <Shell title={type === 'check_in' ? 'Chấm công vào' : 'Chấm công ra'} onBack={onCancel}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <XCircle size={40} className="text-red-500" />
          <p className="text-sm text-gray-600">{fatalError}</p>
          <button
            type="button"
            onClick={onCancel}
            className="mt-2 rounded-xl border border-gray-200 px-6 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50"
          >
            Đóng
          </button>
        </div>
      </Shell>
    )
  }

  // phase === 'steps' — steps chắc chắn đã có giá trị ở đây (đã set trước khi
  // vào phase này), TypeScript chưa suy luận được nên vẫn cần steps!.
  if (!steps) return null
  const currentKind = steps[stepIndex]

  if (currentKind === 'face') {
    return (
      <FaceCapture
        onCapture={handleFaceCapture}
        onCancel={onCancel}
        title={`Bước ${stepIndex + 1}/${steps.length} — Khuôn mặt`}
      />
    )
  }

  const { title, Icon, checkingLabel } = STEP_META[currentKind]
  const checking = precheck === null
  const stepOk = !checking && (currentKind === 'wifi' ? precheck.wifiOk : precheck.gpsOk)

  return (
    <Shell title={type === 'check_in' ? 'Chấm công vào' : 'Chấm công ra'} onBack={onCancel}>
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-base font-bold text-gray-800">{title}</h2>
        <span className="text-sm text-gray-400">
          Bước <span className="font-bold text-gray-700">{stepIndex + 1}</span>/{steps.length}
        </span>
      </div>

      {checking ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-gray-500">
          <Loader2 size={32} className="animate-spin" />
          <p className="text-sm">{checkingLabel}</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-4 px-6 pt-10">
          {/* Icon to gấp 3 (216px thay vì 72px) — nút bấm bám NGAY sau khối
              này theo dòng chảy bình thường, không đẩy xuống giữa màn hình
              nữa (icon đã đủ to để chiếm phần lớn không gian phía trên). */}
          <Icon size={216} className={stepOk ? 'text-green-500' : 'text-red-500'} />
          <div className="flex items-center gap-2 text-sm font-medium">
            {stepOk ? (
              <>
                <CheckCircle2 size={18} className="text-green-500" />
                <span className="text-gray-700">Thành công</span>
              </>
            ) : (
              <>
                <XCircle size={18} className="text-red-500" />
                <span className="text-gray-700">Thất bại</span>
              </>
            )}
          </div>
          {/* Cố tình KHÔNG hiện số mét cụ thể (dù server có tính) — lộ ra là
              nhân viên dò được đúng bán kính cho phép rồi đứng ở rìa (vd
              chân toà nhà) để "lách" thay vì thực sự có mặt. */}
          <p className="text-center text-sm text-gray-500">
            {currentKind === 'wifi'
              ? stepOk
                ? `Đúng mạng văn phòng${precheck.nearestLocationName ? ` "${precheck.nearestLocationName}"` : ''}`
                : 'IP hiện tại không khớp mạng văn phòng nào'
              : stepOk
                ? `Đúng vị trí${precheck.nearestLocationName ? ` — ${precheck.nearestLocationName}` : ''}`
                : 'Sai vị trí — không ở văn phòng'}
          </p>

          {currentKind === 'wifi' && !stepOk && precheck.officeLocationNames.length > 0 && (
            <div className="w-full rounded-xl bg-gray-50 px-4 py-3">
              <p className="text-xs font-bold text-gray-500">Các văn phòng có mạng hợp lệ</p>
              <ul className="mt-1.5 space-y-1">
                {precheck.officeLocationNames.map((name) => (
                  <li key={name} className="flex items-center gap-2 text-sm text-gray-700">
                    <Wifi size={14} className="shrink-0 text-gray-400" />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="w-full pt-2">
            {stepOk ? (
              <button
                type="button"
                onClick={advanceStep}
                className="w-full rounded-xl bg-brand-500 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-600"
              >
                Tiếp theo
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-50"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={loadChecks}
                  className="flex-1 rounded-xl bg-brand-500 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-600"
                >
                  Thử lại
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Shell>
  )
}
