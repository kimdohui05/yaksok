import { useState, useEffect, useRef } from 'react'
import { searchMedicines } from '../api/medicineSearch'
import styles from './MedicineNameInput.module.css'

const DEBOUNCE_MS = 300 // 입력이 멈추고 0.3초 뒤에만 요청

// 약 이름 입력창 + 연관검색어 후보 목록 (최대 10개)
// - 방향키로 이동, 엔터로 선택, Esc로 닫기
// - onSelect(name): 후보에서 고른 경우 (이름 확인을 통과한 약으로 처리)
// - onEnter(): 후보를 고르지 않은 상태에서 엔터
// - variant: 'light'(흰 배경 입력창) | 'onDark'(청록 카드 위 입력창)
export default function MedicineNameInput({
  value,
  onChange,
  onSelect,
  onEnter,
  onBlur,
  placeholder,
  className = '',
  autoFocus = false,
  variant = 'light',
}) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const reqIdRef = useRef(0)
  const skipRef = useRef(false) // 후보를 고른 직후에는 다시 검색하지 않음
  const inputRef = useRef(null)

  useEffect(() => {
    if (skipRef.current) { skipRef.current = false; return }
    const q = (value || '').trim()
    if (!q) { setItems([]); setOpen(false); return }

    const id = ++reqIdRef.current
    const timer = setTimeout(async () => {
      setLoading(true)
      const result = await searchMedicines(q)
      if (id !== reqIdRef.current) return // 더 최근 입력이 있으면 결과 버림
      setLoading(false)
      setItems(result)
      setActive(-1)
      // 입력창에 커서가 있을 때만 목록 표시
      setOpen(document.activeElement === inputRef.current && result.length > 0)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [value])

  const select = (item) => {
    skipRef.current = true
    reqIdRef.current++ // 진행 중인 검색 결과 무시
    setOpen(false)
    setItems([])
    setActive(-1)
    onSelect?.(item.name)
  }

  const handleKeyDown = (e) => {
    if (open && items.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive(i => (i + 1) % items.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive(i => (i <= 0 ? items.length - 1 : i - 1))
        return
      }
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key === 'Enter' && active >= 0) {
        e.preventDefault()
        select(items[active])
        return
      }
    }
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) onEnter?.()
  }

  return (
    <div className={`${styles.wrap} ${className}`}>
      <input
        ref={inputRef}
        className={variant === 'onDark' ? styles.inputOnDark : styles.input}
        type="text"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (items.length > 0) setOpen(true) }}
        onBlur={e => { setOpen(false); onBlur?.(e) }}
      />
      {loading && value.trim() && <span className={styles.loading} aria-hidden="true" />}

      {open && (
        <ul className={styles.list} role="listbox">
          {items.map((item, i) => (
            <li
              key={`${item.name}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`${styles.item} ${i === active ? styles.itemActive : ''}`}
              // 클릭 전에 입력창 blur가 먼저 일어나 목록이 닫히지 않도록
              onMouseDown={e => e.preventDefault()}
              onClick={() => select(item)}
              onMouseEnter={() => setActive(i)}
            >
              <span className={styles.itemName}>{item.name}</span>
              {item.company && <span className={styles.itemSub}>{item.company}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
