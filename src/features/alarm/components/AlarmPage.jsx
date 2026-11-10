import { useState, useEffect } from 'react'
import client from '../../../api/client'
import BottomTab from '../../../components/common/BottomTab'
import styles from './AlarmPage.module.css'

const formatTime = (alarmTime) => {
  if (!alarmTime) return ''
  if (Array.isArray(alarmTime)) {
    const h = String(alarmTime[0]).padStart(2, '0')
    const m = String(alarmTime[1]).padStart(2, '0')
    return `${h}:${m}`
  }
  return String(alarmTime).substring(0, 5)
}

const requestPermission = async () => {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}

const sendNotification = (title, body) => {
  if (Notification.permission !== 'granted') return
  new Notification(title, { body, icon: '💊', badge: '💊' })
}

export default function AlarmPage() {
  const [medSchedule, setMedSchedule] = useState([])
  const [alarms, setAlarms] = useState([])
  const [permission, setPermission] = useState(Notification.permission)
  const [alarmEnabled, setAlarmEnabled] = useState(
    localStorage.getItem('alarmEnabled') !== 'false'
  )
  const unreadCnt = alarms.filter(a => !a.read).length

  // 약 목록 API로 불러오기
  useEffect(() => {
    client.get('/medications')
      .then(res => {
        setMedSchedule(res.data.map(m => ({
          id: m.id,
          medicine: m.medicineName,
          time: formatTime(m.alarmTime),
        })))
      })
      .catch(err => console.error('약 목록 불러오기 실패', err))
  }, [])

  // 알림 페이지 들어오면 즉시 unreadAlarm 읽음 처리
  useEffect(() => {
    localStorage.setItem('unreadAlarm', 'false')
  }, [])

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
    if (!alarmEnabled || permission !== 'granted' || medSchedule.length === 0) return

    const checkAlarm = () => {
      const now = new Date()
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      const currentTime = `${hh}:${mm}`

      medSchedule.forEach(med => {
        if (med.time === currentTime) {
          sendNotification('💊 복약 시간이에요!', `${med.medicine} 복용할 시간입니다.`)
          setAlarms(prev => [{
            id: Date.now(),
            medicine: med.medicine,
            time: `오늘 ${now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`,
            read: false,
            type: 'reminder',
          }, ...prev])
          localStorage.setItem('unreadAlarm', 'true')
        }
      })
    }

    checkAlarm()
    const interval = setInterval(checkAlarm, 60000)
    return () => clearInterval(interval)
  }, [alarmEnabled, permission, medSchedule])

  const markRead = (id) => setAlarms(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))

  const markAllRead = () => {
    setAlarms(prev => prev.map(a => ({ ...a, read: true })))
    localStorage.setItem('unreadAlarm', 'false')
  }

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
        {unreadCnt > 0 && (
          <button className={styles.readAllBtn} onClick={markAllRead}>
            모두 읽음
          </button>
        )}
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
        {medSchedule.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text-sub)', padding: '8px 0' }}>
            등록된 약이 없어요
          </div>
        ) : (
          medSchedule.map(med => (
            <div key={med.id} className={styles.scheduleItem}>
              <span className={styles.scheduleIcon}>💊</span>
              <span className={styles.scheduleMed}>{med.medicine}</span>
              <span className={styles.scheduleTime}>{med.time}</span>
            </div>
          ))
        )}
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