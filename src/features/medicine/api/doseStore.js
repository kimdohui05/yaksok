// "먹었어요" (복용 완료) 기록
// 로그인 → 서버(/api/doses)에 저장해서 다른 기기에서도 보이고, 먼저 먹은 약은 서버가 알림을 보내지 않음
// 화면을 바로 그리기 위해 날짜별 localStorage(doneMeds_YYYY-MM-DD)에도 같이 저장 (캐시)
import client from '../../../api/client'
import { isLoggedIn } from './medicationStore'

// Date → "YYYY-MM-DD" (기기 시간 기준)
export const toDateStr = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const localKey = (date) => `doneMeds_${toDateStr(date)}`

// 캐시에서 바로 읽기 → Set<string id>
export const loadDoneCached = (date = new Date()) => {
  try { return new Set(JSON.parse(localStorage.getItem(localKey(date)) || '[]')) }
  catch { return new Set() }
}

const saveCache = (date, set) => {
  try { localStorage.setItem(localKey(date), JSON.stringify([...set])) } catch {}
}

// 서버에서 그날 먹은 약 목록 → Set<string id> (실패하면 캐시)
export async function fetchDone(date = new Date()) {
  if (!isLoggedIn()) return loadDoneCached(date)
  try {
    const res = await client.get('/api/doses', { params: { date: toDateStr(date) } })
    const set = new Set((res.data || []).map(String))
    saveCache(date, set)
    return set
  } catch {
    return loadDoneCached(date)
  }
}

// 먹었어요 / 취소. 실패하면 예외를 던짐 (화면에서 되돌리기)
export async function setDone(medicationId, done, date = new Date()) {
  const set = loadDoneCached(date)
  const key = String(medicationId)
  if (done) set.add(key)
  else set.delete(key)
  saveCache(date, set)

  if (!isLoggedIn()) return
  const params = { date: toDateStr(date) }
  try {
    if (done) await client.put(`/api/doses/${medicationId}`, null, { params })
    else await client.delete(`/api/doses/${medicationId}`, { params })
  } catch (err) {
    // 서버 저장 실패 → 캐시도 되돌림
    if (done) set.delete(key)
    else set.add(key)
    saveCache(date, set)
    throw err
  }
}
