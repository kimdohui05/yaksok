// 처방전 사진 → AI 분석 관련 유틸
//
// 지금(1단계)은 가짜 결과를 돌려준다.
// 4단계에서 백엔드 API가 생기면 analyzePrescriptionMock 의 "안쪽"만 실제 호출로 바꾸면 된다.
// 반환 형식은 그대로 유지할 것:
// {
//   prescriptionDate: 'YYYY-MM-DD',
//   medicines: [{ name, dose, timesPerDay, days }]
// }

const today = () => new Date().toISOString().split('T')[0]

// _file: 4단계에서 실제 API로 보낼 사진 (지금은 사용 안 함)
export function analyzePrescriptionMock(_file) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        prescriptionDate: today(),
        medicines: [
          { name: '타이레놀정500mg', dose: '1정', timesPerDay: 3, days: 5 },
          { name: '뮤코펙트정30mg', dose: '1정', timesPerDay: 3, days: 5 },
          { name: '가스모틴정5mg', dose: '1정', timesPerDay: 2, days: 5 },
        ],
      })
    }, 1500)
  })
}

// 하루 복용 횟수 → 기본 복용 시간
export function defaultTimes(n) {
  if (n === 1) return ['08:00']
  if (n === 2) return ['08:00', '19:00']
  if (n === 3) return ['08:00', '13:00', '19:00']
  return Array.from({ length: n }, () => '')
}
