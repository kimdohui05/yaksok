// 처방전 사진 → AI 분석 관련 유틸
import client from '../../../api/client'

// 처방전 사진을 백엔드(Gemini)로 보내 분석 결과를 받는다.
// 반환 형식:
// {
//   prescriptionDate: 'YYYY-MM-DD' | null,
//   qualityWarning: 화질 경고 문구 | null,
//   medicines: [{ name, dose, timesPerDay, days, ediCode, verified, suggestedName, originalName }]
// }
// AI가 읽지 못한 값은 null 로 온다.
//
// onStage(stage, percent): 진행 단계 알림
//   'preparing' 사진 줄이는 중 → 'uploading' 업로드 중(percent) → 'analyzing' 서버에서 분석·약 이름 확인 중
export async function analyzePrescription(file, onStage = () => {}) {
  onStage('preparing')
  const small = await shrinkImage(file)
  const formData = new FormData()
  formData.append('image', small)

  onStage('uploading', 0)
  const res = await client.post('/api/prescriptions/analyze', formData, {
    timeout: 60000, // AI 분석은 오래 걸릴 수 있어서 기본 10초 대신 60초
    onUploadProgress: (e) => {
      const percent = e.total ? Math.round((e.loaded / e.total) * 100) : 0
      // 업로드가 끝나면 서버가 분석하는 동안 기다리는 단계
      if (percent >= 100) onStage('analyzing')
      else onStage('uploading', percent)
    },
  })
  return res.data
}

// 사진을 긴 쪽 최대 1200px, JPG로 줄인다. 실패하면 원본을 그대로 쓴다.
// (사진이 작을수록 업로드·분석이 빨라지고, 큰 사진은 Gemini가 붐빌 때 503으로 잘 거절됨)
function shrinkImage(file, maxSize = 1200, quality = 0.85) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob((blob) => {
        // 오히려 커지면 원본 사용
        if (!blob || blob.size >= file.size) return resolve(file)
        resolve(new File([blob], 'prescription.jpg', { type: 'image/jpeg' }))
      }, 'image/jpeg', quality)
    }

    // 브라우저가 못 여는 사진은 원본 그대로
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }
    img.src = url
  })
}

// 하루 복용 횟수 → 기본 복용 시간
export function defaultTimes(n) {
  if (n === 1) return ['08:00']
  if (n === 2) return ['08:00', '19:00']
  if (n === 3) return ['08:00', '13:00', '19:00']
  return Array.from({ length: n }, () => '')
}
