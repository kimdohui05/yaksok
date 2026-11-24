import client from '../../../api/client'

// 약 이름이 실제 약인지 확인
// 일반의약품(e약은요) 또는 병용금기 목록 중 하나라도 있으면 확인된 약
// → true(확인됨) / false(확인되지 않음) / null(서버 오류로 판단 불가 — 경고하지 않음)
export async function verifyMedicineName(name) {
  const itemName = (name || '').trim()
  if (!itemName) return null
  try {
    const params = { itemName }
    const [info, check] = await Promise.all([
      client.get('/api/dur/info', { params }),
      client.get('/api/dur/check', { params }),
    ])
    const found = (res) => Array.isArray(res.data) && res.data.length > 0
    return found(info) || found(check)
  } catch {
    return null
  }
}
