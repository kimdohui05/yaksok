import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomTab from '../../../components/common/BottomTab'
import styles from './SchedulePage.module.css'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

// Date → 'YYYY-MM-DD' (toISOString은 UTC 기준이라 날짜가 하루 밀릴 수 있어서 직접 만듦)
const toKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// 서버 연결 전 임시 데이터: 하루 복약 일정
const DAILY_PLAN = [
  {
    time: '08:00', label: '아침 · 식후 30분', alarm: '07:50',
    meds: [{ name: '타이레놀', dose: '500mg · 1정' }],
  },
  {
    time: '12:00', label: '점심 · 식후 바로', alarm: '11:50',
    meds: [{ name: '아스피린', dose: '100mg · 1정' }, { name: '타이레놀', dose: '500mg · 1정' }],
  },
  {
    time: '18:00', label: '저녁 · 식사와 함께', alarm: '17:50',
    meds: [{ name: '오메가3', dose: '1000mg · 1캡슐', warning: '아스피린과 주의' }],
  },
]

// 오늘 기준 며칠 뒤(음수는 며칠 전)에 어떤 시간대 약이 있는지 (숫자 = DAILY_PLAN 순서)
const MOCK_DAYS = {
  '-6': [0], '-5': [0, 2], '-3': [0, 1], '-2': [1], '-1': [0, 2],
  '0': [0, 1, 2], '1': [0, 2], '3': [1], '4': [0, 1, 2],
  '7': [0], '9': [0, 2], '12': [1], '15': [0, 1, 2], '18': [2], '22': [0, 2], '25': [0],
}

// 지난 날은 복용 완료(이틀 전 점심만 놓침), 오늘은 아침 약만 완료
const buildMockSchedule = (today) => {
  const schedule = {}
  for (const [key, slotIdxs] of Object.entries(MOCK_DAYS)) {
    const offset = Number(key)
    const d = new Date(today)
    d.setDate(today.getDate() + offset)
    schedule[toKey(d)] = slotIdxs.map(i => DAILY_PLAN[i]).map(slot => ({
      ...slot,
      meds: slot.meds.map(m => ({
        ...m,
        done: (offset < 0 && !(offset === -2 && slot.time === '12:00'))
          || (offset === 0 && slot.time === '08:00'),
      })),
    }))
  }
  return schedule
}

export default function SchedulePage() {
  const navigate = useNavigate()
  const today = new Date()
  const todayKey = toKey(today)
  const [schedule, setSchedule] = useState(() => buildMockSchedule(today))
  const [view, setView] = useState('month') // 'week' | 'month'
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(today)
  const [showYearMonth, setShowYearMonth] = useState(false)
  const [tempYear, setTempYear] = useState(today.getFullYear())

  const getMonthDates = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const lastDate = new Date(year, month + 1, 0).getDate()
    const dates = []
    for (let i = 0; i < firstDay; i++) dates.push(null)
    for (let i = 1; i <= lastDate; i++) dates.push(new Date(year, month, i))
    return dates
  }

  // 선택된 날짜가 속한 주 (일~토)
  const getWeekDates = () =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(selectedDate)
      d.setDate(selectedDate.getDate() - selectedDate.getDay() + i)
      return d
    })

  const selectDate = (date) => {
    setSelectedDate(date)
    setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1))
  }

  // 월 보기: 한 달씩 / 주 보기: 한 주씩 이동
  const move = (step) => {
    setShowYearMonth(false)
    if (view === 'month') {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + step, 1))
    } else {
      const d = new Date(selectedDate)
      d.setDate(selectedDate.getDate() + step * 7)
      selectDate(d)
    }
  }

  const toggleYearMonth = () => {
    setShowYearMonth(!showYearMonth)
    setTempYear(currentMonth.getFullYear())
  }

  // 월을 누르면 바로 그 달로 이동
  const handleMonthSelect = (month) => {
    setCurrentMonth(new Date(tempYear, month, 1))
    setShowYearMonth(false)
    setView('month')
  }

  const goToday = () => {
    selectDate(new Date(today))
    setShowYearMonth(false)
  }

  // 체크 버튼으로 복용 완료/취소 (미래 날짜는 체크 불가)
  const toggleDone = (key, slotIdx, medIdx) => {
    if (key > todayKey) return
    setSchedule(prev => ({
      ...prev,
      [key]: prev[key].map((slot, si) => si !== slotIdx ? slot : {
        ...slot,
        meds: slot.meds.map((m, mi) => mi !== medIdx ? m : { ...m, done: !m.done }),
      }),
    }))
  }

  // 이번 달 오늘까지의 복용률
  const monthPrefix = toKey(currentMonth).slice(0, 7)
  const monthMeds = Object.entries(schedule)
    .filter(([key]) => key.startsWith(monthPrefix) && key <= todayKey)
    .flatMap(([, slots]) => slots.flatMap(s => s.meds))
  const monthRate = monthMeds.length
    ? Math.round((monthMeds.filter(m => m.done).length / monthMeds.length) * 100)
    : null

  const selectedKey = toKey(selectedDate)
  const selectedSlots = schedule[selectedKey] || []
  const selectedMeds = selectedSlots.flatMap(s => s.meds)
  const doneCount = selectedMeds.filter(m => m.done).length
  const isFuture = selectedKey > todayKey

  const calendarDates = view === 'month' ? getMonthDates() : getWeekDates()

  return (
    <div className={styles.container}>
      <div className={styles.top}>
        <header className={styles.header}>
          <h1 className={styles.title}>일정</h1>
          <div className={styles.headerRight}>
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn} ${view === 'week' ? styles.viewBtnActive : ''}`}
                onClick={() => setView('week')}
              >주</button>
              <button
                className={`${styles.viewBtn} ${view === 'month' ? styles.viewBtnActive : ''}`}
                onClick={() => { setView('month'); setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)) }}
              >월</button>
            </div>
            <button className={styles.todayBtn} onClick={goToday}>오늘</button>
          </div>
        </header>

        {/* 월 이동 + 복용률 */}
        <div className={styles.monthNav}>
          <div className={styles.monthNavLeft}>
            <button className={styles.navBtn} onClick={() => move(-1)}>‹</button>
            <button className={styles.monthTitle} onClick={toggleYearMonth}>
              {currentMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
            </button>
            <button className={styles.navBtn} onClick={() => move(1)}>›</button>
          </div>
          {monthRate !== null && (
            <div className={styles.rate}>
              복용률 <strong>{monthRate}%</strong>
            </div>
          )}
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
              {Array.from({ length: 12 }, (_, i) => {
                const isCurrent = tempYear === currentMonth.getFullYear() && i === currentMonth.getMonth()
                return (
                  <button
                    key={i}
                    className={`${styles.monthChip} ${isCurrent ? styles.monthChipActive : ''}`}
                    onClick={() => handleMonthSelect(i)}
                  >
                    {i + 1}월
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 요일 헤더 */}
        <div className={styles.calDayRow}>
          {DAYS.map((d, i) => (
            <div key={d} className={`${styles.calDayLabel} ${i === 0 ? styles.sunday : ''}`}>{d}</div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className={styles.calGrid}>
          {calendarDates.map((date, i) => {
            if (!date) return <div key={i} />
            const key = toKey(date)
            const isToday = key === todayKey
            const isSelected = key === selectedKey
            const hasMeds = !!schedule[key]
            return (
              <button key={i} className={styles.calDate} onClick={() => selectDate(date)}>
                <span
                  className={[
                    styles.calNum,
                    date.getDay() === 0 ? styles.sunday : '',
                    isSelected && !isToday ? styles.calSelected : '',
                    isToday ? styles.calToday : '',
                  ].join(' ')}
                >
                  {date.getDate()}
                </span>
                {/* 복용약이 있는 날은 알약 표시 (자리는 항상 차지해서 칸 높이 유지) */}
                <span className={`${styles.pill} ${hasMeds ? '' : styles.pillHidden}`} />
              </button>
            )
          })}
        </div>

        <div className={styles.legend}>
          <span className={styles.pill} /> 복약 예정
        </div>
      </div>

      {/* 선택한 날짜의 복약 일정 */}
      <section className={styles.daySection}>
        <div className={styles.dayHeader}>
          <h2 className={styles.dayTitle}>
            {selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
          </h2>
          {selectedMeds.length > 0 && (
            <span className={styles.dayCount}>{doneCount} / {selectedMeds.length} 복용</span>
          )}
        </div>
        {selectedMeds.length > 0 && (
          <div className={styles.progress}>
            <div className={styles.progressFill} style={{ width: `${(doneCount / selectedMeds.length) * 100}%` }} />
          </div>
        )}

        {selectedSlots.length === 0 ? (
          <div className={styles.empty}>복용할 약이 없어요</div>
        ) : (
          selectedSlots.map((slot, si) => (
            <div key={slot.time} className={styles.slotCard}>
              <div className={styles.slotHeader}>
                <span className={styles.slotTime}>{slot.time}</span>
                <span className={styles.slotLabel}>{slot.label}</span>
                <span className={styles.alarmChip}>알림 {slot.alarm}</span>
              </div>
              {slot.meds.map((m, mi) => (
                <div key={mi} className={`${styles.medRow} ${m.done ? styles.medDone : ''}`}>
                  <button
                    className={`${styles.check} ${m.done ? styles.checked : ''}`}
                    onClick={() => toggleDone(selectedKey, si, mi)}
                    disabled={isFuture}
                    aria-label={m.done ? '복용 취소' : '복용 완료'}
                  >
                    {m.done && '✓'}
                  </button>
                  <div className={styles.medInfo}>
                    <div className={styles.medName}>{m.name}</div>
                    <div className={styles.medDose}>{m.dose}</div>
                  </div>
                  {m.warning && <span className={styles.warningTag}>{m.warning}</span>}
                  {m.done
                    ? <span className={styles.doneTag}>완료</span>
                    : <span className={styles.pendingTag}>대기</span>
                  }
                </div>
              ))}
            </div>
          ))
        )}

        <button className={styles.addBtn} onClick={() => navigate('/medicine/add')}>
          + 복약 시간 추가
        </button>

        <div className={styles.disclaimer}>
          <span className={styles.infoIcon}>i</span>
          본 서비스는 의학적 소견을 대체하지 않습니다. 반드시 의사 또는 약사와 상담하세요.
        </div>
      </section>

      <div style={{ height: '80px' }} />
      <BottomTab />
    </div>
  )
}
