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
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(today)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showYearMonth, setShowYearMonth] = useState(false)
  const [tempYear, setTempYear] = useState(today.getFullYear())
  const [tempMonth, setTempMonth] = useState(today.getMonth())

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(selectedDate)
    d.setDate(selectedDate.getDate() - selectedDate.getDay() + i)
    return d
  })

  const getCalendarDates = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const lastDate = new Date(year, month + 1, 0).getDate()
    const dates = []
    for (let i = 0; i < firstDay; i++) dates.push(null)
    for (let i = 1; i <= lastDate; i++) dates.push(new Date(year, month, i))
    return dates
  }

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))

  const handleDateSelect = (date) => {
    if (!date) return
    setSelectedDate(date)
    setShowCalendar(false)
    setShowYearMonth(false)
  }

  const handleYearMonthConfirm = () => {
    setCurrentMonth(new Date(tempYear, tempMonth, 1))
    setShowYearMonth(false)
  }

  const calendarDates = getCalendarDates()

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>일정 관리</h1>
        <button
          className={styles.monthLabel}
          onClick={() => {
            setShowCalendar(true)
            setShowYearMonth(false)
            setTempYear(currentMonth.getFullYear())
            setTempMonth(currentMonth.getMonth())
          }}
        >
          {selectedDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })} ▾
        </button>
      </header>

      {/* 주간 캘린더 */}
      <div className={styles.weekWrap}>
        <div className={styles.weekRow}>
          {weekDates.map((d, i) => {
            const isToday = d.toDateString() === today.toDateString()
            const isSelected = d.toDateString() === selectedDate.toDateString()
            return (
              <div
                key={i}
                className={`${styles.dayItem} ${isSelected ? styles.selectedDay : ''} ${isToday && !isSelected ? styles.todayDay : ''}`}
                onClick={() => setSelectedDate(new Date(d))}
              >
                <div className={styles.dayLabel}>{DAYS[d.getDay()]}</div>
                <div className={styles.dayNum}>{d.getDate()}</div>
                {isToday && <div className={styles.todayDot} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* 선택된 날짜 표시 */}
      <div className={styles.selectedDateLabel}>
        {selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
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

      {/* 캘린더 모달 */}
      {showCalendar && (
        <div className={styles.modalOverlay} onClick={() => { setShowCalendar(false); setShowYearMonth(false) }}>
          <div className={styles.calendarModal} onClick={e => e.stopPropagation()}>
            <div className={styles.calendarHandle} />

            <div className={styles.calendarHeader}>
              <button className={styles.monthBtn} onClick={prevMonth}>‹</button>
              <button
                className={styles.calendarTitle}
                onClick={() => {
                  setShowYearMonth(!showYearMonth)
                  setTempYear(currentMonth.getFullYear())
                  setTempMonth(currentMonth.getMonth())
                }}
              >
                {currentMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })} ▾
              </button>
              <button className={styles.monthBtn} onClick={nextMonth}>›</button>
            </div>

            {/* 년도/월 선택 */}
            {showYearMonth && (
              <div className={styles.ymPicker}>
                <div className={styles.ymRow}>
                  <button className={styles.ymBtn} onClick={() => setTempYear(tempYear - 1)}>‹</button>
                  <span className={styles.ymLabel}>{tempYear}년</span>
                  <button className={styles.ymBtn} onClick={() => setTempYear(tempYear + 1)}>›</button>
                </div>
                <div className={styles.monthGrid}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <button
                      key={i}
                      className={`${styles.monthChip} ${tempMonth === i ? styles.monthChipActive : ''}`}
                      onClick={() => setTempMonth(i)}
                    >
                      {i + 1}월
                    </button>
                  ))}
                </div>
                <button className={styles.ymConfirmBtn} onClick={handleYearMonthConfirm}>
                  확인
                </button>
              </div>
            )}

            {/* 요일 헤더 */}
            <div className={styles.calDayRow}>
              {DAYS.map(d => (
                <div key={d} className={styles.calDayLabel}>{d}</div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className={styles.calGrid}>
              {calendarDates.map((date, i) => {
                if (!date) return <div key={i} />
                const isToday = date.toDateString() === today.toDateString()
                const isSelected = date.toDateString() === selectedDate.toDateString()
                return (
                  <div
                    key={i}
                    className={`${styles.calDate} ${isToday ? styles.calToday : ''} ${isSelected ? styles.calSelected : ''}`}
                    onClick={() => handleDateSelect(date)}
                  >
                    {date.getDate()}
                  </div>
                )
              })}
            </div>

            <button className={styles.todayBtn} onClick={() => handleDateSelect(new Date(today))}>
              오늘로 이동
            </button>
          </div>
        </div>
      )}
    </div>
  )
}