import { useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import styles from './Picker.module.css'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

const pad = (n) => String(n).padStart(2, '0')
const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (str) => {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// "2026-11-24" → "2026년 11월 24일 (화)"
const formatDateLabel = (str) => {
  const d = parse(str)
  if (!d) return ''
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`
}

// 앱 디자인에 맞춘 날짜 선택 (누르면 아래에서 달력 시트가 올라옴)
// value / onChange 는 'YYYY-MM-DD' 문자열
export default function DateField({ value, onChange, placeholder = '날짜 선택' }) {
  const [open, setOpen] = useState(false)
  const selected = parse(value)
  const [month, setMonth] = useState(() => {
    const base = selected || new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const openSheet = () => {
    const base = parse(value) || new Date()
    setMonth(new Date(base.getFullYear(), base.getMonth(), 1))
    setOpen(true)
  }

  const pick = (d) => {
    onChange(toStr(d))
    setOpen(false)
  }

  const todayStr = toStr(new Date())
  const year = month.getFullYear()
  const m = month.getMonth()
  const firstDay = new Date(year, m, 1).getDay()
  const lastDate = new Date(year, m + 1, 0).getDate()
  const cells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: lastDate }, (_, i) => new Date(year, m, i + 1)),
  ]

  return (
    <>
      <button type="button" className={styles.field} onClick={openSheet}>
        <span className={value ? styles.fieldValue : styles.fieldPlaceholder}>
          {value ? formatDateLabel(value) : placeholder}
        </span>
        <Icon name="calendar" size={18} className={styles.fieldIcon} />
      </button>

      {open && createPortal(
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <div className={styles.handle} />
            <div className={styles.calHeader}>
              <button type="button" className={styles.navBtn} onClick={() => setMonth(new Date(year, m - 1, 1))} aria-label="이전 달">
                <Icon name="back" size={18} />
              </button>
              <span className={styles.calTitle}>{year}년 {m + 1}월</span>
              <button type="button" className={styles.navBtn} onClick={() => setMonth(new Date(year, m + 1, 1))} aria-label="다음 달">
                <Icon name="chevronRight" size={18} />
              </button>
            </div>

            <div className={styles.weekRow}>
              {DAYS.map((d, i) => (
                <span key={d} className={`${styles.weekDay} ${i === 0 ? styles.sun : ''} ${i === 6 ? styles.sat : ''}`}>{d}</span>
              ))}
            </div>
            <div className={styles.dateGrid}>
              {cells.map((d, i) => {
                if (!d) return <span key={i} />
                const str = toStr(d)
                return (
                  <button
                    type="button"
                    key={i}
                    className={`${styles.dateCell} ${str === value ? styles.dateSelected : ''} ${str === todayStr ? styles.dateToday : ''}`}
                    onClick={() => pick(d)}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>

            <div className={styles.sheetActions}>
              <button type="button" className={styles.ghostBtn} onClick={() => pick(new Date())}>오늘</button>
              <button type="button" className={styles.ghostBtn} onClick={() => setOpen(false)}>닫기</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
