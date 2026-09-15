// Toàn bộ file này CHỈ chạy phía client (trình duyệt) — face-api.js dùng
// TensorFlow.js backend WebGL/WASM, không chạy được trên server Next.js.

let modelsLoadedPromise: Promise<void> | null = null

/** Tải model 1 lần (cache lại) — tổng cộng ~7MB, trình duyệt tự cache cho
 * các lần sau. Bắt buộc gọi trước khi dùng extractFaceEmbedding(). */
export function loadFaceModels(): Promise<void> {
  if (!modelsLoadedPromise) {
    modelsLoadedPromise = (async () => {
      const faceapi = await import('face-api.js')
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models')
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models')
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models')
    })()
  }
  return modelsLoadedPromise
}

/** Phát hiện nhanh có khuôn mặt trong khung hình không — dùng để polling
 * liên tục trong lúc chờ nhân viên đưa mặt vào camera, KHÔNG trích embedding
 * (rẻ hơn nhiều so với full pipeline có landmark+recognition). */
export async function quickDetectFace(input: HTMLVideoElement): Promise<boolean> {
  const faceapi = await import('face-api.js')
  const result = await faceapi.detectSingleFace(input, new faceapi.TinyFaceDetectorOptions())
  return !!result
}

/** Trích embedding đầy đủ (128 số) — nặng hơn quickDetectFace, chỉ gọi 1 lần
 * khi đã chắc chắn có mặt trong khung hình (sau quickDetectFace liên tục
 * trả về true vài lần liên tiếp). */
export async function extractFaceEmbedding(input: HTMLVideoElement): Promise<number[] | null> {
  const faceapi = await import('face-api.js')
  const result = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor()
  return result ? Array.from(result.descriptor) : null
}

// Ngưỡng khớp mặt giờ cấu hình động ở DB (bảng hrm_app_settings, admin chỉnh
// tại /quan-li-cham-cong/yeu-cau) — xem getFaceMatchThreshold() trong
// lib/attendance.ts, không còn hard-code cố định ở đây nữa.

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum)
}
