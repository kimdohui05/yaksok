import { useState } from 'react'
import BottomTab from '../../../components/common/BottomTab'
import styles from './SchedulePage.module.css'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

const SCHEDULE = {
  '08:00': [{ name: '타이레놀', done: true }],
  '12:00': [{ name: '아스피린', done: false }, { name: '타이레놀', done: false }],
  '18:00': [{ name: '오메가3', done: false }],
}

export default function SchedulePage() {
  const today = new Date()
  const [selectedDate, setSelectedDate] = useState(today.getDate())

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - today.getDay() + i)
    return d
  })

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>일정 관리</h1>
        <div className={styles.monthLabel}>
          {today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
        </div>
      </header>

      {/* 주간 캘린더 */}
      <div className={styles.weekWrap}>
        <div className={styles.weekRow}>
          {weekDates.map((d, i) => {
            const isToday = d.toDateString() === today.toDateString()
            const isSelected = d.getDate() === selectedDate
            return (
              <div
                key={i}
                className={`${styles.dayItem} ${isSelected ? styles.selectedDay : ''} ${isToday && !isSelected ? styles.todayDay : ''}`}
                onClick={() => setSelectedDate(d.getDate())}
              >
                <div className={styles.dayLabel}>{DAYS[d.getDay()]}</div>
                <div className={styles.dayNum}>{d.getDate()}</div>
                {isToday && <div className={styles.todayDot} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* 시간대별 일정 */}
      <div className={styles.scheduleList}>
        {Object.entries(SCHEDULE).map(([time, meds]) => (
          <div key={time} className={styles.timeBlock}>
            <div className={styles.timeLabel}>{time}</div>
            <div className={styles.medList}>
              {meds.map((m, i) => (
                <div key={i} className={`${styles.medItem} ${m.done ? styles.done : ''}`}>
                  <div className={`${styles.check} ${m.done ? styles.checked : ''}`}>
                    {m.done && '✓'}
                  </div>
                  <span className={styles.medName}>{m.name}</span>
                  {m.done
                    ? <span className={styles.doneTag}>완료</span>
                    : <span className={styles.pendingTag}>대기</span>
                  }
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.disclaimer}>
        ⚕️ 본 서비스는 의학적 소견을 대체하지 않습니다. 반드시 의사 또는 약사와 상담하세요.
      </div>

      <div style={{ height: '80px' }} />
      <BottomTab />
    </div>
  )
}