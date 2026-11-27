// 서버 복약 알림 관련 API
//   GET  /api/notifications              → [{ id, title, body, alarmAt, read }] (최근 50개, 최신순)
//   GET  /api/notifications/unread-count → { count }
//   POST /api/notifications/read-all
//   GET  /api/user/profile               → { name, email, alarmEnabled }
//   PUT  /api/user/settings              ← { alarmEnabled }
import client from '../../api/client'

const ALARM_KEY = 'alarmEnabled' // 화면을 바로 그리기 위한 캐시

export const getAlarmEnabledCached = () => localStorage.getItem(ALARM_KEY) !== 'false'

// 서버 값으로 캐시 갱신 (프로필을 받아온 화면에서 호출)
export const cacheAlarmEnabled = (enabled) => {
  try { localStorage.setItem(ALARM_KEY, String(enabled !== false)) } catch {}
}

// 복약 알림 켜기/끄기 (서버가 메일·PC 알림을 보낼지 결정). 실패하면 예외
export async function saveAlarmEnabled(enabled) {
  const res = await client.put('/api/user/settings', { alarmEnabled: enabled })
  cacheAlarmEnabled(res.data?.alarmEnabled ?? enabled)
  return res.data?.alarmEnabled ?? enabled
}

export async function listNotifications() {
  const res = await client.get('/api/notifications')
  return res.data || []
}

export async function getUnreadCount() {
  const res = await client.get('/api/notifications/unread-count')
  return Number(res.data?.count) || 0
}

export async function readAllNotifications() {
  await client.post('/api/notifications/read-all')
}
