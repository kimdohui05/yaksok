import client from '../../../api/client'

// 약 이름 확인 (서버 GET /api/drugs/verify — 약 저장 검증과 같은 기준, 식약처 의약품 허가정보: 전문약·일반약 전체)
// → { verified, name, message, category, suggestions } / null(서버 오류로 판단 불가)
//   verified: true  → name 에 확인된 이름 (한 글자 오타는 공식 이름으로 고쳐져서 옴)
//                     category: 식약처 분류로 정한 카테고리 (categories.js 의 key, 모르면 null)
//   verified: false → message("그런 약은 존재하지 않습니다."), suggestions(비슷한 약 이름, 최대 5개)
export async function checkMedicineName(name) {
  const trimmed = (name || '').trim()
  if (!trimmed) return null
  try {
    const { data } = await client.get('/api/drugs/verify', { params: { name: trimmed } })
    return {
      verified: data?.verified === true,
      name: data?.name || trimmed,
      message: data?.message || '그런 약은 존재하지 않습니다.',
      category: data?.category || null,
      suggestions: Array.isArray(data?.suggestions) ? data.suggestions : [],
    }
  } catch {
    return null
  }
}

// true(확인됨) / false(확인되지 않음) / null(서버 오류로 판단 불가)
export async function verifyMedicineName(name) {
  const result = await checkMedicineName(name)
  return result ? result.verified : null
}
