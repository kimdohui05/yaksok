// 약(복약 알람) 저장소
// 로그인 상태 → 서버(/medications), 로그인 전(게스트) → 이 기기의 localStorage
// 화면에서는 로그인 여부를 신경 쓰지 않고 이 함수들만 쓰면 됨
import client from '../../../api/client'

const GUEST_KEY = 'guestMedications'

export const isLoggedIn = () => !!localStorage.getItem('token')

const loadGuest = () => {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY) || '[]') }
  catch { return [] }
}
const saveGuest = (list) => {
  try { localStorage.setItem(GUEST_KEY, JSON.stringify(list)) } catch {}
}

// 게스트 약 id는 서버 id와 겹치지 않게 문자열로
const newGuestId = () => `guest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

// → [{ id, medicineName, alarmTime }]
export async function listMedications() {
  if (isLoggedIn()) {
    const res = await client.get('/medications')
    return res.data || []
  }
  return loadGuest()
}

// body: { medicineName, alarmTime: 'HH:mm:ss' } → 저장된 약
export async function addMedication(body) {
  if (isLoggedIn()) {
    const res = await client.post('/medications', body)
    return res.data
  }
  const med = { id: newGuestId(), ...body }
  saveGuest([...loadGuest(), med])
  return med
}

export async function updateMedication(id, body) {
  if (isLoggedIn()) {
    const res = await client.put(`/medications/${id}`, body)
    return res.data
  }
  const list = loadGuest().map(m => (m.id === id ? { ...m, ...body } : m))
  saveGuest(list)
  return list.find(m => m.id === id)
}

export async function deleteMedication(id) {
  if (isLoggedIn()) {
    await client.delete(`/medications/${id}`)
    return
  }
  saveGuest(loadGuest().filter(m => m.id !== id))
}

export const hasGuestMedications = () => loadGuest().length > 0

// 로그인 직후: 게스트로 등록한 약을 서버로 옮기고, id 기준으로 저장된 처방 정보도 새 id로 옮김
// → 옮긴 개수 (실패한 약은 게스트 목록에 남겨서 다음 로그인 때 다시 시도)
export async function migrateGuestMedications() {
  const guest = loadGuest()
  if (guest.length === 0) return 0

  const read = (key) => {
    try { return JSON.parse(localStorage.getItem(key) || '{}') }
    catch { return {} }
  }
  const startDates = read('medStartDates')
  const prescDays = read('medPrescDays')
  const remaining = []
  let moved = 0

  for (const m of guest) {
    try {
      const res = await client.post('/medications', {
        medicineName: m.medicineName,
        alarmTime: m.alarmTime,
      })
      const newId = res.data?.id
      if (newId != null) {
        if (startDates[m.id]) startDates[String(newId)] = startDates[m.id]
        if (prescDays[m.id]) prescDays[String(newId)] = prescDays[m.id]
      }
      delete startDates[m.id]
      delete prescDays[m.id]
      moved++
    } catch {
      remaining.push(m)
    }
  }

  try {
    localStorage.setItem('medStartDates', JSON.stringify(startDates))
    localStorage.setItem('medPrescDays', JSON.stringify(prescDays))
  } catch {}
  saveGuest(remaining)
  return moved
}
