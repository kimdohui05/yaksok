import client from '../../../api/client'

// 약 이름 연관검색어
// 요청: GET /api/medicines/search?keyword=타이&limit=10   (로그인 없이도 호출 가능해야 함)
// 응답: [{ name: '타이레놀정500mg', company: '한국얀센', ediCode: '...' }, ...]  최대 10개
//       (문자열 배열 ['타이레놀정500mg', ...] 로 와도 처리)
// 실패하거나 아직 API가 없으면 빈 배열 → 화면에서는 후보 목록만 안 보임
export async function searchMedicines(keyword, limit = 10) {
  const q = (keyword || '').trim()
  if (!q) return []
  try {
    const res = await client.get('/api/medicines/search', { params: { keyword: q, limit } })
    const list = Array.isArray(res.data) ? res.data : []
    return list
      .map(item => (typeof item === 'string' ? { name: item } : item))
      .filter(item => item?.name)
      .slice(0, limit)
  } catch {
    return []
  }
}
