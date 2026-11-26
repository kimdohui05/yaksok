import client from '../../../api/client'

// 비교용: 공백 제거 + 소문자
const normalize = (name) => (name || '').replace(/\s/g, '').toLowerCase()

// 용량/괄호 앞까지만 (예: 타이레놀정500mg → 타이레놀정)
const baseName = (name) => normalize(name).replace(/[\d(].*$/, '')

// GET /api/dur/check → 해당 약과 병용금기인 약 목록 (실패하면 빈 배열)
// 같은 약을 여러 번 조회하지 않도록 화면이 열려 있는 동안 결과를 기억 (실패한 조회는 기억하지 않음)
const tabooCache = new Map()
const fetchTaboo = (itemName) => {
  if (tabooCache.has(itemName)) return tabooCache.get(itemName)
  const req = client.get('/api/dur/check', { params: { itemName } })
    .then(res => (Array.isArray(res.data) ? res.data : []))
    .catch(() => { tabooCache.delete(itemName); return [] })
  tabooCache.set(itemName, req)
  return req
}

// 병용금기 상대 약 이름(MIXTURE_ITEM_NAME)에 target 약 이름이 들어 있는지
const mentions = (item, target) => {
  const t = baseName(target)
  return t.length >= 2 && normalize(item.MIXTURE_ITEM_NAME).includes(t)
}

// 새로 등록할 약과 이미 등록된 약들 사이의 병용금기 찾기
// 백엔드가 최대 50건만 돌려주므로 양방향으로 조회
// → [{ name: '메토트렉세이트', reasons: ['혈액학적 독성'] }]
export async function checkInteractions(newName, myMedicines) {
  const newBase = baseName(newName)
  const myNames = [...new Set(myMedicines.map(m => m.medicineName))]
    .filter(n => baseName(n) && baseName(n) !== newBase)
  if (myNames.length === 0) return []

  const [newTaboo, ...myTaboos] = await Promise.all([newName, ...myNames].map(fetchTaboo))

  return myNames
    .map((name, i) => {
      const hits = [
        ...newTaboo.filter(item => mentions(item, name)),
        ...myTaboos[i].filter(item => mentions(item, newName)),
      ]
      const reasons = [...new Set(hits.map(h => h.PROHBT_CONTENT?.trim()).filter(Boolean))]
      return hits.length > 0 ? { name, reasons } : null
    })
    .filter(Boolean)
}
