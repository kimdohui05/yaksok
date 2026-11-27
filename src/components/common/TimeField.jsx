import { useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import styles from './Picker.module.css'

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)          // 1 ~ 12
const MINUTE_TENS = [0, 10, 20, 30, 40, 50]                          // 10분 단위
const MINUTE_ONES = Array.from({ length: 10 }, (_, i) => i)          // 1분 단위 0 ~ 9

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

// 앱 디자인에 맞춘 시간 선택 (오전/오후 → 시 → 분: 10분 단위 + 1분 단위)
// value / onChange 는 'HH:mm' 문자열
export default function TimeField({ value, onChange, placeholder = '시간 선택' }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => parse(value))

  const openSheet = () => {
    setDraft(parse(value))
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

            <div className={styles.pickLabel}>
              분 <span className={styles.pickHint}>10분 단위</span>
            </div>
            <div className={styles.chipGrid}>
              {MINUTE_TENS.map(t => (
                <button
                  type="button"
                  key={t}
                  className={`${styles.chip} ${Math.floor(draft.minute / 10) * 10 === t ? styles.chipActive : ''}`}
                  onClick={() => setDraft({ ...draft, minute: t + (draft.minute % 10) })}
                >
                  {String(t).padStart(2, '0')}
                </button>
              ))}
            </div>

            <div className={styles.pickLabel}>
              <span className={styles.pickHint}>1분 단위</span>
            </div>
            <div className={`${styles.chipGrid} ${styles.chipGrid5}`}>
              {MINUTE_ONES.map(o => (
                <button
                  type="button"
                  key={o}
                  className={`${styles.chip} ${draft.minute % 10 === o ? styles.chipActive : ''}`}
                  onClick={() => setDraft({ ...draft, minute: Math.floor(draft.minute / 10) * 10 + o })}
                >
                  {o}
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
