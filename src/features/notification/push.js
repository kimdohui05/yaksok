// PC 알림 센터 알림(웹 푸시)
// HTTPS에서만 동작 (localhost는 예외). 푸시는 계정에 묶이므로 로그인한 사용자만 사용.
//
// 백엔드 API
//   GET  /api/push/public-key   → { publicKey: 'VAPID 공개키(base64url)' }
//        (또는 프론트 .env 의 VITE_VAPID_PUBLIC_KEY 사용)
//   POST /api/push/subscribe    ← { endpoint, expirationTime, keys: { p256dh, auth } }  (PushSubscription.toJSON())
//   POST /api/push/unsubscribe  ← { endpoint }
// 서버가 보내는 푸시 내용 형식은 public/sw.js 맨 위 주석 참고
import client from '../../api/client'

const SW_URL = '/sw.js'

// 브라우저가 웹 푸시를 지원하고, 안전한 주소(HTTPS 또는 localhost)인지
export const isPushSupported = () =>
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

// base64url 공개키 → Uint8Array (subscribe에 필요한 형식)
const toUint8Array = (base64url) => {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

const getPublicKey = async () => {
  const fromEnv = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (fromEnv) return fromEnv
  const res = await client.get('/api/push/public-key')
  if (!res.data?.publicKey) throw new Error('VAPID 공개키가 없습니다.')
  return res.data.publicKey
}

const getRegistration = async () =>
  (await navigator.serviceWorker.getRegistration(SW_URL)) ||
  navigator.serviceWorker.register(SW_URL)

// 지금 이 브라우저가 구독 중인지
export async function isPushSubscribed() {
  if (!isPushSupported()) return false
  const reg = await navigator.serviceWorker.getRegistration(SW_URL)
  const sub = reg && (await reg.pushManager.getSubscription())
  return !!sub && Notification.permission === 'granted'
}

// 알림 켜기: 권한 요청 → 허용하면 구독 → 구독 정보를 백엔드로 전송
// → { ok: true } / { ok: false, reason: 'unsupported' | 'denied' | 'error', message }
export async function enablePush() {
  if (!isPushSupported()) {
    return { ok: false, reason: 'unsupported', message: '이 브라우저(또는 주소)에서는 PC 알림을 쓸 수 없어요. HTTPS 주소에서 다시 시도해 주세요.' }
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied', message: '알림이 차단되어 있어요. 브라우저 주소창 왼쪽 자물쇠 → 알림을 허용으로 바꿔 주세요.' }
  }
  try {
    const reg = await getRegistration()
    await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toUint8Array(await getPublicKey()),
      })
    }
    await client.post('/api/push/subscribe', sub.toJSON())
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: err?.response?.data?.message || 'PC 알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요.',
    }
  }
}

// 알림 끄기: 백엔드에 구독 해제 알리고 브라우저 구독도 해제 (실패해도 브라우저 쪽은 해제)
export async function disablePush() {
  if (!isPushSupported()) return
  const reg = await navigator.serviceWorker.getRegistration(SW_URL)
  const sub = reg && (await reg.pushManager.getSubscription())
  if (!sub) return
  try {
    await client.post('/api/push/unsubscribe', { endpoint: sub.endpoint })
  } catch {}
  await sub.unsubscribe().catch(() => {})
}
