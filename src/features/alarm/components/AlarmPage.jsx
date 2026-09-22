import { useState } from 'react'
import BottomTab from '../../../components/common/BottomTab'
import styles from './AlarmPage.module.css'

const DUMMY_ALARMS = [
  { id: 1, medicine: '타이레놀', time: '오전 8:00', read: false, type: 'reminder' },
  { id: 2, medicine: '아스피린', time: '오후 12:00', read: false, type: 'reminder' },
  { id: 3, medicine: '타이레놀 & 아스피린', time: '어제 오후 3:00', read: true, type: 'warning', msg: '상호작용 주의 - 출혈 위험 증가' },
]

export default function AlarmPage() {
  const [alarms, setAlarms] = useState(DUMMY_ALARMS)
  const markRead = (id) => setAlarms(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))
  const unreadCnt = alarms.filter(a => !a.read).length

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>알림</h1>
        {unreadCnt > 0 && <span className={styles.badge}>{unreadCnt}개 미확인</span>}
      </header>

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