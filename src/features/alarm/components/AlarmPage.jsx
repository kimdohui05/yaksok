import { useState, useEffect } from 'react'
import BottomTab from '../../../components/common/BottomTab'
import styles from './AlarmPage.module.css'

// 복약 시간 목록 (추후 백엔드 연동)
const MED_SCHEDULE = [
  { id: 1, medicine: '타이레놀', time: '08:00' },
  { id: 2, medicine: '아스피린', time: '12:00' },
  { id: 3, medicine: '오메가3', time: '18:00' },
]

const DUMMY_ALARMS = [
  { id: 1, medicine: '타이레놀', time: '오전 8:00', read: false, type: 'reminder' },
  { id: 2, medicine: '아스피린', time: '오후 12:00', read: false, type: 'reminder' },
  { id: 3, medicine: '타이레놀 & 아스피린', time: '어제 오후 3:00', read: true, type: 'warning', msg: '상호작용 주의 - 출혈 위험 증가' },
]

// 브라우저 알림 권한 요청
const requestPermission = async () => {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}

// 브라우저 알림 발송
const sendNotification = (title, body) => {
  if (Notification.permission !== 'granted') return
  new Notification(title, {
    body,
    icon: '💊',
    badge: '💊',
  })
}

export default function AlarmPage() {
  const [alarms, setAlarms] = useState(DUMMY_ALARMS)
  const [permission, setPermission] = useState(Notification.permission)
  const [alarmEnabled, setAlarmEnabled] = useState(
    localStorage.getItem('alarmEnabled') !== 'false'
  )
  const unreadCnt = alarms.filter(a => !a.read).length

  // 알림 권한 요청
  useEffect(() => {
    if (alarmEnabled) {
      requestPermission().then(granted => {
        setPermission(granted ? 'granted' : 'denied')
      })
    }
  }, [alarmEnabled])

  // 복약 시간 체크 (1분마다)
  useEffect(() => {
    if (!alarmEnabled || permission !== 'granted') return

    const checkAlarm = () => {
      const now = new Date()
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      const currentTime = `${hh}:${mm}`

      MED_SCHEDULE.forEach(med => {
        if (med.time === currentTime) {
          sendNotification(
            '💊 복약 시간이에요!',
            `${med.medicine} 복용할 시간입니다.`
          )
          // 알림 목록에 추가
          setAlarms(prev => [{
            id: Date.now(),
            medicine: med.medicine,
            time: `오늘 ${now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`,
            read: false,
            type: 'reminder',
          }, ...prev])
        }
      })
    }

    // 즉시 한 번 체크
    checkAlarm()
    // 1분마다 체크
    const interval = setInterval(checkAlarm, 60000)
    return () => clearInterval(interval)
  }, [alarmEnabled, permission])

  const markRead = (id) => setAlarms(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))

  const toggleAlarm = async () => {
    if (!alarmEnabled) {
      const granted = await requestPermission()
      setPermission(granted ? 'granted' : 'denied')
      if (!granted) {
        alert('브라우저 설정에서 알림을 허용해주세요.')
        return
      }
    }
    const next = !alarmEnabled
    setAlarmEnabled(next)
    localStorage.setItem('alarmEnabled', String(next))
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>알림</h1>
        {unreadCnt > 0 && <span className={styles.badge}>{unreadCnt}개 미확인</span>}
      </header>

      {/* 알림 설정 */}
      <div className={styles.settingCard}>
        <div className={styles.settingInfo}>
          <div className={styles.settingTitle}>복약 알림</div>
          <div className={styles.settingDesc}>
            {permission === 'denied'
              ? '⚠️ 브라우저 설정에서 알림을 허용해주세요'
              : alarmEnabled
              ? '✅ 복약 시간마다 알림을 받고 있어요'
              : '🔕 알림이 꺼져 있어요'}
          </div>
        </div>
        <div
          className={`${styles.toggle} ${alarmEnabled ? styles.toggleOn : ''}`}
          onClick={toggleAlarm}
        >
          <div className={styles.toggleThumb} />
        </div>
      </div>

      {/* 복약 일정 */}
      <div className={styles.scheduleCard}>
        <div className={styles.scheduleTitle}>📅 오늘 복약 일정</div>
        {MED_SCHEDULE.map(med => (
          <div key={med.id} className={styles.scheduleItem}>
            <span className={styles.scheduleIcon}>💊</span>
            <span className={styles.scheduleMed}>{med.medicine}</span>
            <span className={styles.scheduleTime}>{med.time}</span>
          </div>
        ))}
      </div>

      {/* 알림 목록 */}
      <div className={styles.sectionTitle}>알림 내역</div>
      <div className={styles.list}>
        {alarms.length === 0 ? (
          <div className={styles.empty}>
            <span>🔔</span>
            <p>알림이 없습니다</p>
          </div>
        ) : (
          alarms.map(a => (
            <div
              key={a.id}
              className={`${styles.alarmItem} ${!a.read ? styles.unread : ''} ${a.type === 'warning' ? styles.warningItem : ''}`}
              onClick={() => markRead(a.id)}
            >
              <div className={styles.alarmIconWrap}>
                <span className={styles.alarmIcon}>{a.type === 'warning' ? '⚠️' : '💊'}</span>
              </div>
              <div className={styles.alarmInfo}>
                <div className={styles.alarmTitle}>
                  {a.type === 'warning' ? `${a.medicine} 상호작용 경고` : `${a.medicine} 복약 시간`}
                </div>
                {a.msg && <div className={styles.alarmMsg}>{a.msg}</div>}
                <div className={styles.alarmTime}>{a.time}</div>
              </div>
              {!a.read && <div className={styles.dot} />}
            </div>
          ))
        )}
      </div>

      <div style={{ height: '80px' }} />
      <BottomTab />
    </div>
  )
}