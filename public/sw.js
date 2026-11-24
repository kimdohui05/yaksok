// 약속(YakSok) 웹 푸시 서비스 워커
// 서버가 보낸 푸시를 받아 Windows 알림 센터(OS 알림)에 표시하고, 알림을 누르면 약 목록을 연다.
//
// 서버가 보내는 푸시 내용(JSON):
//   { "title": "복약 시간이에요", "body": "타이레놀정500mg 복용할 시간입니다.", "url": "/medicine", "tag": "med-12-0800" }
//   - url 생략 시 /medicine
//   - tag가 같으면 이전 알림을 새 알림으로 바꿈 (같은 약 알림이 쌓이지 않게)

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // JSON이 아니면 글자 그대로 본문으로
    data = { body: event.data ? event.data.text() : '' }
  }

  const title = data.title || '약속 · 복약 알림'
  const options = {
    body: data.body || '약 먹을 시간이에요.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: data.tag,
    renotify: !!data.tag,
    data: { url: data.url || '/medicine' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// 알림을 누르면 약 목록 페이지 열기 (이미 열린 탭이 있으면 그 탭을 앞으로)
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/medicine', self.location.origin).href

  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const sameOrigin = tabs.find(c => new URL(c.url).origin === self.location.origin)
    if (sameOrigin) {
      await sameOrigin.focus()
      if ('navigate' in sameOrigin) return sameOrigin.navigate(url)
      return
    }
    return self.clients.openWindow(url)
  })())
})
