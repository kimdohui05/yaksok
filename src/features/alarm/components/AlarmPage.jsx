import { useState, useEffect } from 'react'
import { listMedications, isLoggedIn } from '../../medicine/api/medicationStore'
import {
  getAlarmEnabledCached, cacheAlarmEnabled, saveAlarmEnabled,
  listNotifications, readAllNotifications,
} from '../../notification/notificationApi'
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

// "2026-11-27T08:00:00" (또는 [2026, 11, 27, 8, 0]) → "오늘 오전 8:00" / "어제 오후 9:30" / "11월 25일 오전 8:00"
const formatAlarmAt = (alarmAt) => {
  if (!alarmAt) return ''
  const d = Array.isArray(alarmAt)
    ? new Date(alarmAt[0], alarmAt[1] - 1, alarmAt[2], alarmAt[3] || 0, alarmAt[4] || 0)
    : new Date(String(alarmAt))
  if (Number.isNaN(d.getTime())) return ''
  const h = d.getHours()
  const time = `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')}`
  const today = new Date()
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86400000)
  if (diffDays === 0) return `오늘 ${time}`
  if (diffDays === 1) return `어제 ${time}`
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${time}`
}

// 복약 알림은 서버가 보냄 (PC 알림 센터 + 메일). 이 화면은 서버에 기록된 알림 내역과 알림 켜기/끄기만 담당
export default function AlarmPage() {
  const loggedIn = isLoggedIn()
  const [medSchedule, setMedSchedule] = useState([])
  const [alarms, setAlarms] = useState([])
  const [loadingAlarms, setLoadingAlarms] = useState(loggedIn)
  const [alarmEnabled, setAlarmEnabled] = useState(getAlarmEnabledCached)
  const [alarmBusy, setAlarmBusy] = useState(false)
  const unreadCnt = alarms.filter(a => !a.read).length

  // 오늘 복약 일정 (약 목록)
  useEffect(() => {
    listMedications()
      .then(data => {
        setMedSchedule(data
          .map(m => ({ id: m.id, medicine: m.medicineName, time: formatTime(m.alarmTime) }))
          .sort((a, b) => a.time.localeCompare(b.time)))
      })
      .catch(err => console.error('약 목록 불러오기 실패', err))
  }, [])

  // 서버 알림 내역 + 알림 설정. 들어오면 모두 읽음 처리 (화면에는 안 읽었던 표시를 남겨 둠)
  useEffect(() => {
    if (!loggedIn) return
    listNotifications()
      .then(list => {
        setAlarms(list)
        if (list.some(a => !a.read)) readAllNotifications().catch(() => {})
      })
      .catch(err => console.error('알림 내역 불러오기 실패', err))
      .finally(() => setLoadingAlarms(false))

    client.get('/api/user/profile')
      .then(res => {
        if (typeof res.data?.alarmEnabled === 'boolean') {
          setAlarmEnabled(res.data.alarmEnabled)
          cacheAlarmEnabled(res.data.alarmEnabled)
        }
      })
      .catch(() => {})
  }, [loggedIn])

  const markAllRead = () => {
    setAlarms(prev => prev.map(a => ({ ...a, read: true })))
    readAllNotifications().catch(() => {})
  }

  // 복약 알림 켜기/끄기: 서버에 저장 (끄면 서버가 메일·PC 알림을 보내지 않음)
  const toggleAlarm = async () => {
    if (alarmBusy) return
    const next = !alarmEnabled
    setAlarmEnabled(next)
    if (!loggedIn) {
      cacheAlarmEnabled(next)
      return
    }
    setAlarmBusy(true)
    try {
      await saveAlarmEnabled(next)
    } catch {
      setAlarmEnabled(!next)
      alert('알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setAlarmBusy(false)
    }
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
            {alarmEnabled
              ? '복약 시간마다 PC 알림과 메일로 알려드려요'
              : '알림이 꺼져 있어요'}
          </div>
        </div>
        <div
          className={`${styles.toggle} ${alarmEnabled ? styles.toggleOn : ''}`}
          onClick={toggleAlarm}
          role="switch"
          aria-checked={alarmEnabled}
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

      {/* 알림 내역 (서버에서 보낸 복약 알림) */}
      <div className={styles.sectionTitle}>알림 내역</div>
      <div className={styles.list}>
        {loadingAlarms ? (
          <div className={styles.empty}><p>불러오는 중...</p></div>
        ) : alarms.length === 0 ? (
          <div className={styles.empty}>
            <span>🔔</span>
            <p>알림이 없습니다</p>
          </div>
        ) : (
          alarms.map(a => (
            <div key={a.id} className={`${styles.alarmItem} ${!a.read ? styles.unread : ''}`}>
              <div className={styles.alarmIconWrap}>
                <span className={styles.alarmIcon}>💊</span>
              </div>
              <div className={styles.alarmInfo}>
                <div className={styles.alarmTitle}>{a.title}</div>
                {a.body && <div className={styles.alarmMsg}>{a.body}</div>}
                <div className={styles.alarmTime}>{formatAlarmAt(a.alarmAt)}</div>
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
