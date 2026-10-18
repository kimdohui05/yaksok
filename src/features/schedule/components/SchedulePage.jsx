import { useState, useEffect } from 'react'
import client from '../../../api/client'
import BottomTab from '../../../components/common/BottomTab'
import styles from './SchedulePage.module.css'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

// Jackson이 LocalTime을 배열 [H, m, s] 또는 문자열 "HH:mm:ss"로 직렬화할 수 있음
const formatTime = (alarmTime) => {
  if (!alarmTime) return null
  if (Array.isArray(alarmTime)) {
    const [h, m] = alarmTime
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  // "HH:mm:ss" → "HH:mm"
  return String(alarmTime).slice(0, 5)
}

// 복약 완료 여부: localStorage의 doneMeds 키 사용
const getDoneKey = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `doneMeds_${y}-${m}-${d}`
}

const loadDoneSet = (date) => {
  try {
    const raw = localStorage.getItem(getDoneKey(date))
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

const saveDoneSet = (date, set) => {
  try {
    localStorage.setItem(getDoneKey(date), JSON.stringify([...set]))
  } catch {}
}

export default function SchedulePage() {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(today)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showYearMonth, setShowYearMonth] = useState(false)
  const [tempYear, setTempYear] = useState(today.getFullYear())
  const [tempMonth, setTempMonth] = useState(today.getMonth())

  // 실제 약 데이터
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)

  // 복약 완료 상태 (날짜별 로컬스토리지)
  const [doneSet, setDoneSet] = useState(() => loadDoneSet(today))

  // API에서 약 목록 불러오기
  useEffect(() => {
    client.get('/medications')
      .then(res => setMedicines(res.data || []))
      .catch(() => setMedicines([]))
      .finally(() => setLoading(false))
  }, [])

  // 선택 날짜 변경 시 완료 상태 업데이트
  useEffect(() => {
    setDoneSet(loadDoneSet(selectedDate))
  }, [selectedDate])

  // localStorage에서 약별 처방 정보(시작일/처방일수) 불러오기
  const getPrescInfo = () => {
    try {
      return {
        startDates: JSON.parse(localStorage.getItem('medStartDates') || '{}'),
        prescDays: JSON.parse(localStorage.getItem('medPrescDays') || '{}'),
        byName: JSON.parse(localStorage.getItem('medPrescByName') || '{}'),
      }
    } catch { return { startDates: {}, prescDays: {}, byName: {} } }
  }

  // 선택 날짜를 "YYYY-MM-DD" 문자열로 변환
  const toDateStr = (date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // 처방 시작일 + 처방일수 → 마지막 복용일("YYYY-MM-DD") 계산 (시작일 포함)
  const calcEndStr = (startStr, days) => {
    const [y, m, d] = startStr.split('-').map(Number)
    const end = new Date(y, m - 1, d + Number(days) - 1)
    return toDateStr(end)
  }

  // 처방일수 / 오늘 기준 잔여일수 라벨 (예: "7일분 · 잔여 3일")
  const getPrescLabel = (startDate, days) => {
    if (!days) return null
    if (!startDate) return { text: `${days}일분`, level: 'normal' }
    const remaining = Math.ceil(
      (new Date(calcEndStr(startDate, days)) - new Date(toDateStr(new Date()))) / (1000 * 60 * 60 * 24)
    )
    if (remaining < 0) return { text: `${days}일분 · 만료`, level: 'expired' }
    if (remaining <= 3) return { text: `${days}일분 · 잔여 ${remaining}일 ⚠️`, level: 'warning' }
    return { text: `${days}일분 · 잔여 ${remaining}일`, level: 'normal' }
  }

  // 약 데이터를 시간대별로 그룹핑 (처방 시작일 ~ 처방 종료일 사이의 날짜에만 표시)
  const buildSchedule = () => {
    const map = {}
    const { startDates, prescDays, byName } = getPrescInfo()
    const selectedStr = toDateStr(selectedDate)

    medicines.forEach(med => {
      // id 기준 → 없으면 약 이름 기준으로 처방 정보 조회
      const nameInfo = byName[med.medicineName] || {}
      const startDate = startDates[String(med.id)] || nameInfo.startDate
      const days = prescDays[String(med.id)] || nameInfo.days

      // 시작일 이전 날짜에는 표시하지 않음
      if (startDate && selectedStr < startDate) return
      // 처방일수가 있으면 마지막 복용일 이후 날짜에도 표시하지 않음
      if (startDate && days && selectedStr > calcEndStr(startDate, days)) return

      const timeKey = formatTime(med.alarmTime)
      if (!timeKey) return
      if (!map[timeKey]) map[timeKey] = []
      map[timeKey].push({ id: med.id, name: med.medicineName, presc: getPrescLabel(startDate, days) })
    })
    // 시간 순 정렬
    return Object.fromEntries(
      Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
    )
  }

  const schedule = buildSchedule()

  // 복약 완료 토글
  const toggleDone = (medId) => {
    const key = String(medId)
    const next = new Set(doneSet)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setDoneSet(next)
    saveDoneSet(selectedDate, next)
  }

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
  const hasSchedule = Object.keys(schedule).length > 0

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
        {loading ? (
          <div className={styles.emptyMsg}>불러오는 중...</div>
        ) : !hasSchedule ? (
          <div className={styles.emptyMsg}>
            <div className={styles.emptyIcon}>💊</div>
            <div>등록된 약이 없어요</div>
            <div className={styles.emptyDesc}>약 탭에서 복용 중인 약을 추가해보세요</div>
          </div>
        ) : (
          Object.entries(schedule).map(([time, meds]) => (
            <div key={time} className={styles.timeBlock}>
              <div className={styles.timeLabel}>{time}</div>
              <div className={styles.medList}>
                {meds.map((m) => {
                  const done = doneSet.has(String(m.id))
                  return (
                    <div
                      key={m.id}
                      className={`${styles.medItem} ${done ? styles.done : ''}`}
                      onClick={() => toggleDone(m.id)}
                    >
                      <div className={`${styles.check} ${done ? styles.checked : ''}`}>
                        {done && '✓'}
                      </div>
                      <span className={styles.medName}>
                        {m.name}
                        {m.presc && (
                          <span style={{
                            display: 'block', marginTop: 2, fontSize: 11, fontWeight: 600,
                            color: m.presc.level === 'expired' ? 'var(--danger)'
                              : m.presc.level === 'warning' ? '#C98A1A' : 'var(--text-sub)',
                          }}>
                            📋 {m.presc.text}
                          </span>
                        )}
                      </span>
                      {done
                        ? <span className={styles.doneTag}>완료</span>
                        : <span className={styles.pendingTag}>대기</span>
                      }
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
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