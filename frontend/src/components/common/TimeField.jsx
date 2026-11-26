import { useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import styles from './Picker.module.css'

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)          // 1 ~ 12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)         // 0, 5, ... 55

// "13:05" → { ampm: 'pm', hour: 1, minute: 5 }
const parse = (str) => {
  if (!str) return { ampm: 'am', hour: 8, minute: 0 }
  const [h, m] = str.split(':').map(Number)
  return { ampm: h < 12 ? 'am' : 'pm', hour: h % 12 === 0 ? 12 : h % 12, minute: m }
}

const toStr = ({ ampm, hour, minute }) => {
  const h24 = (hour % 12) + (ampm === 'pm' ? 12 : 0)
  return `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// "13:05" → "오후 1:05"
const formatTimeLabel = (str) => {
  if (!str) return ''
  const { ampm, hour, minute } = parse(str)
  return `${ampm === 'am' ? '오전' : '오후'} ${hour}:${String(minute).padStart(2, '0')}`
}

// 앱 디자인에 맞춘 시간 선택 (오전/오후 → 시 → 분, 5분 단위)
// value / onChange 는 'HH:mm' 문자열
export default function TimeField({ value, onChange, placeholder = '시간 선택' }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => parse(value))

  const openSheet = () => {
    const p = parse(value)
    // 5분 단위가 아닌 기존 값은 가장 가까운 5분으로
    setDraft({ ...p, minute: Math.min(55, Math.round(p.minute / 5) * 5) })
    setOpen(true)
  }

  const confirm = () => {
    onChange(toStr(draft))
    setOpen(false)
  }

  return (
    <>
      <button type="button" className={styles.field} onClick={openSheet}>
        <span className={value ? styles.fieldValue : styles.fieldPlaceholder}>
          {value ? formatTimeLabel(value) : placeholder}
        </span>
        <Icon name="clock" size={18} className={styles.fieldIcon} />
      </button>

      {open && createPortal(
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <div className={styles.handle} />
            <div className={styles.timePreview}>{formatTimeLabel(toStr(draft))}</div>

            <div className={styles.segment}>
              {[['am', '오전'], ['pm', '오후']].map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  className={`${styles.segmentBtn} ${draft.ampm === key ? styles.segmentActive : ''}`}
                  onClick={() => setDraft({ ...draft, ampm: key })}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className={styles.pickLabel}>시</div>
            <div className={styles.chipGrid}>
              {HOURS.map(h => (
                <button
                  type="button"
                  key={h}
                  className={`${styles.chip} ${draft.hour === h ? styles.chipActive : ''}`}
                  onClick={() => setDraft({ ...draft, hour: h })}
                >
                  {h}
                </button>
              ))}
            </div>

            <div className={styles.pickLabel}>분</div>
            <div className={styles.chipGrid}>
              {MINUTES.map(mi => (
                <button
                  type="button"
                  key={mi}
                  className={`${styles.chip} ${draft.minute === mi ? styles.chipActive : ''}`}
                  onClick={() => setDraft({ ...draft, minute: mi })}
                >
                  {String(mi).padStart(2, '0')}
                </button>
              ))}
            </div>

            <button type="button" className={styles.confirmBtn} onClick={confirm}>확인</button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
