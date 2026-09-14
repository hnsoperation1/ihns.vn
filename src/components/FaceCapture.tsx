'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, ScanFace, X } from 'lucide-react'
import { loadFaceModels, quickDetectFace, extractFaceEmbedding } from '@/lib/face'

// Số lần liên tiếp phải thấy mặt trước khi tự chụp — tránh chụp nhầm lúc
// khuôn mặt mới thoáng qua khung hình (rung tay, đưa điện thoại lên).
const STABLE_DETECTIONS_REQUIRED = 3
const POLL_INTERVAL_MS = 350
// Nghỉ 1 nhịp giữa các mẫu khi chụp nhiều ảnh (đăng ký) — đủ thời gian đọc
// hướng dẫn tư thế tiếp theo trước khi hệ thống bắt đầu tìm mặt lại.
const PAUSE_BETWEEN_SAMPLES_MS = 900

// Thứ tự tư thế yêu cầu khi đăng ký nhiều mẫu — mỗi mẫu 1 góc mặt khác nhau
// thay vì chụp liên tiếp gần như y hệt nhau, giúp so khớp chính xác hơn với
// các góc chấm công thực tế sau này.
const POSE_INSTRUCTIONS = [
  'Nhìn thẳng vào camera',
  'Xoay mặt sang trái',
  'Xoay mặt sang phải',
  'Ngẩng mặt lên',
  'Cúi mặt xuống',
]

function poseLabelFor(index: number): string {
  return POSE_INSTRUCTIONS[index] ?? POSE_INSTRUCTIONS[POSE_INSTRUCTIONS.length - 1]
}

/** 1 mẫu chụp = 1 embedding (để so khớp) + 1 ảnh JPEG dạng dataURL (để admin
 * xem lại bằng mắt, xác minh nhân viên đăng ký đúng khuôn mặt của mình). */
export type FaceSample = { embedding: number[]; image: string }

type Props = {
  /** Nhận đủ số mẫu yêu cầu — luôn là mảng, kể cả khi sampleCount = 1. */
  onCapture: (samples: FaceSample[]) => void
  onCancel: () => void
  title?: string
  /** Số ảnh mẫu cần chụp — mặc định 1 (dùng lúc chấm công). Đăng ký khuôn
   * mặt nên truyền số lớn hơn (vd 5) để tăng độ chính xác so khớp sau này. */
  sampleCount?: number
}

/** Chụp lại khung hình hiện tại thành ảnh vuông JPEG nhỏ gọn (đủ để admin
 * xem lại, không cần giữ nguyên độ phân giải camera gốc). Lật ngang cho khớp
 * chiều hiển thị gương (-scale-x-100) mà nhân viên nhìn thấy lúc chụp. */
function captureSnapshot(video: HTMLVideoElement): string {
  const size = 240
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.translate(size, 0)
  ctx.scale(-1, 1)
  const vw = video.videoWidth
  const vh = video.videoHeight
  const side = Math.min(vw, vh)
  ctx.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, size, size)
  return canvas.toDataURL('image/jpeg', 0.8)
}

export function FaceCapture({
  onCapture,
  onCancel,
  title = 'Đưa khuôn mặt vào khung hình',
  sampleCount = 1,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const stableCountRef = useRef(0)
  const busyRef = useRef(false)
  const samplesRef = useRef<FaceSample[]>([])
  // Sau khi chụp xong 1 mẫu (đăng ký nhiều mẫu), CHỜ thấy mặt biến mất khỏi
  // khung hình ít nhất 1 lần (tức nhân viên đã thực sự xoay đầu theo hướng
  // dẫn) rồi mới tính lại số lần phát hiện ổn định — nếu không, hệ thống chụp
  // liền tấm tiếp theo gần như giống hệt tấm trước vì họ chưa kịp đổi tư thế.
  const awaitingPoseChangeRef = useRef(false)
  // 'error' ở đây CHỈ dùng cho lỗi camera/model không có đường lùi (không mở
  // được camera) — thất bại khi trích đặc trưng chỉ là hint tạm thời, vòng
  // quét vẫn tiếp tục chạy ngầm để tự thử lại, không được để chết hẳn.
  const [status, setStatus] = useState<'loading' | 'searching' | 'found' | 'processing' | 'error'>('loading')
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [captured, setCaptured] = useState(0)

  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let hintTimer: ReturnType<typeof setTimeout> | null = null
    let pauseTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    async function init() {
      try {
        await loadFaceModels()
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStatus('searching')

        pollTimer = setInterval(async () => {
          if (busyRef.current || !videoRef.current) return
          const found = await quickDetectFace(videoRef.current)
          if (cancelled) return

          if (awaitingPoseChangeRef.current) {
            if (!found) awaitingPoseChangeRef.current = false
            setStatus('searching')
            return
          }

          if (found) {
            stableCountRef.current += 1
            setStatus('found')
            if (stableCountRef.current >= STABLE_DETECTIONS_REQUIRED) {
              busyRef.current = true
              setStatus('processing')
              const embedding = videoRef.current ? await extractFaceEmbedding(videoRef.current) : null
              if (cancelled) return
              if (embedding) {
                const image = captureSnapshot(videoRef.current!)
                samplesRef.current.push({ embedding, image })
                setCaptured(samplesRef.current.length)
                if (samplesRef.current.length >= sampleCount) {
                  if (pollTimer) clearInterval(pollTimer)
                  onCapture(samplesRef.current)
                } else {
                  // Còn thiếu mẫu — nghỉ 1 nhịp cho kịp đọc hướng dẫn tư thế
                  // mới, rồi bắt buộc phải THẤY MẶT BIẾN MẤT ít nhất 1 lần
                  // (xoay đầu ra khỏi góc cũ) trước khi tìm mặt ổn định lại.
                  stableCountRef.current = 0
                  setStatus('searching')
                  if (sampleCount > 1) awaitingPoseChangeRef.current = true
                  pauseTimer = setTimeout(() => {
                    busyRef.current = false
                  }, PAUSE_BETWEEN_SAMPLES_MS)
                }
              } else {
                // Thất bại thì quay lại tìm mặt tiếp, KHÔNG dừng vòng quét —
                // trước đây dừng hẳn ở đây khiến cả camera bị "đứng hình".
                setHint('Không trích được đặc trưng khuôn mặt, đang thử lại...')
                setStatus('searching')
                stableCountRef.current = 0
                busyRef.current = false
                if (hintTimer) clearTimeout(hintTimer)
                hintTimer = setTimeout(() => setHint(''), 2500)
              }
            }
          } else {
            stableCountRef.current = 0
            setStatus('searching')
          }
        }, POLL_INTERVAL_MS)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không mở được camera')
        setStatus('error')
      }
    }

    init()

    return () => {
      cancelled = true
      if (pollTimer) clearInterval(pollTimer)
      if (hintTimer) clearTimeout(hintTimer)
      if (pauseTimer) clearTimeout(pauseTimer)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleCancel() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    onCancel()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white text-center">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
        <button type="button" onClick={handleCancel} className="text-gray-400 hover:text-gray-600 p-1">
          <X size={18} />
        </button>
      </div>

      {sampleCount > 1 && (status === 'searching' || status === 'found' || status === 'processing') && (
        <div className="bg-brand-50 px-4 py-3 text-center">
          <p className="text-base font-bold text-brand-700">{poseLabelFor(Math.min(captured, sampleCount - 1))}</p>
          <p className="mt-0.5 text-xs text-brand-400">
            Ảnh {Math.min(captured + 1, sampleCount)}/{sampleCount}
          </p>
        </div>
      )}

      {/* Ép khung luôn vuông bằng kỹ thuật "padding-top 100%" thay vì
          `aspect-square` (CSS aspect-ratio) — aspect-ratio trong flexbox bị
          Safari/WebKit tính sai chiều cao ở 1 số viewport (thấy rõ trên
          iPhone độ phân giải cao, khung bị kéo dài ngang). Padding phần trăm
          luôn tính theo CHIỀU RỘNG của khối cha bất kể ngữ cảnh flex/grid nên
          không bị lỗi tương tự. */}
      <div className="relative w-full overflow-hidden bg-gray-900">
        <div className="pt-[100%]" />
        <div className="absolute inset-0">
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover -scale-x-100" />
          {status !== 'error' && (
            <div
              className={`pointer-events-none absolute inset-6 rounded-full border-4 transition-colors ${
                status === 'found' || status === 'processing' ? 'border-green-400' : 'border-white/50'
              }`}
            />
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-3">
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600 min-h-[20px]">
          {status === 'loading' && (
            <>
              <Loader2 size={15} className="animate-spin" /> Đang chuẩn bị nhận diện khuôn mặt...
            </>
          )}
          {status === 'searching' && (
            <>
              <ScanFace size={15} /> {hint || 'Đang tìm khuôn mặt...'}
            </>
          )}
          {status === 'found' && (
            <>
              <ScanFace size={15} className="text-green-500" /> Giữ yên...
            </>
          )}
          {status === 'processing' && (
            <>
              <Loader2 size={15} className="animate-spin" /> Đang xử lý...
            </>
          )}
          {status === 'error' && <span className="text-red-500">{error}</span>}
        </div>

        {status === 'error' && (
          <button
            type="button"
            onClick={handleCancel}
            className="w-full max-w-xs rounded-xl border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Đóng
          </button>
        )}
      </div>
    </div>
  )
}
