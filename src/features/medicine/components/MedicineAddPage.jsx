import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './MedicineAddPage.module.css'

export default function MedicineAddPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedMed, setSelectedMed] = useState(null)
  const [frequency, setFrequency] = useState('')
  const [times, setTimes] = useState([''])
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)

  // 처방전 관련 상태
  const [prescriptionDays, setPrescriptionDays] = useState('')
  const [prescriptionDate, setPrescriptionDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [nextVisit, setNextVisit] = useState(null)

  const handleSearch = () => {
    if (!searchQuery.trim()) return
    setLoading(true)
    setTimeout(() => {
      setSearchResults([
        { id: 1, name: searchQuery, ingredient: '성분 정보 (공공 API 연동 예정)', effect: '효능 정보 (공공 API 연동 예정)' },
      ])
      setLoading(false)
    }, 600)
  }

  const handleSelect = (med) => { setSelectedMed(med); setStep(2) }
  const addTime = () => setTimes([...times, ''])
  const removeTime = (i) => setTimes(times.filter((_, idx) => idx !== i))
  const updateTime = (i, val) => setTimes(times.map((t, idx) => idx === i ? val : t))

  const calcNextVisit = () => {
    if (!prescriptionDays || !prescriptionDate) return
    const start = new Date(prescriptionDate)
    start.setDate(start.getDate() + Number(prescriptionDays) - 2) // 2일 전 알림
    const formatted = start.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
    setNextVisit(formatted)
  }

  const handleSave = () => {
    if (!selectedMed) return
    alert('약이 등록되었습니다!')
    navigate('/medicine')
  }

  const stepTitles = { 1: '약 검색', 2: '복용 설정', 3: '처방전 등록' }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => {
          if (step > 1) setStep(step - 1)
          else navigate(-1)
        }}>←</button>
        <h1 className={styles.title}>{stepTitles[step]}</h1>
        <div style={{ width: '32px' }} />
      </header>

      {/* 스텝 인디케이터 */}
      <div className={styles.stepRow}>
        {[1, 2, 3].map(s => (
          <div key={s} className={styles.stepWrap}>
            <div className={`${styles.stepDot} ${step >= s ? styles.stepActive : ''}`}>{s}</div>
            {s < 3 && <div className={`${styles.stepLine} ${step > s ? styles.stepLineDone : ''}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: 약 검색 */}
      {step === 1 && (
        <div className={styles.content}>
          <button className={styles.photoBtn}>
            <span className={styles.photoBtnIcon}>📷</span>
            <div>
              <div className={styles.photoBtnTitle}>사진으로 검색</div>
              <div className={styles.photoBtnSub}>처방전이나 약봉투를 찍어보세요</div>
            </div>
          </button>

          <div className={styles.divider}><span>또는 직접 검색</span></div>

          <div className={styles.searchRow}>
            <input
              className={styles.searchInput}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="약 이름을 입력하세요"
            />
            <button className={styles.searchBtn} onClick={handleSearch} disabled={loading}>
              {loading ? '...' : '검색'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className={styles.results}>
              <div className={styles.resultsTitle}>검색 결과</div>
              {searchResults.map(r => (
                <div key={r.id} className={styles.resultItem} onClick={() => handleSelect(r)}>
                  <div className={styles.resultIcon}>💊</div>
                  <div className={styles.resultInfo}>
                    <div className={styles.resultName}>{r.name}</div>
                    <div className={styles.resultSub}>{r.ingredient}</div>
                  </div>
                  <span className={styles.resultArrow}>›</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: 복용 설정 */}
      {step === 2 && selectedMed && (
        <div className={styles.content}>
          <div className={styles.selectedCard}>
            <span className={styles.selectedCardIcon}>💊</span>
            <div>
              <div className={styles.selectedName}>{selectedMed.name}</div>
              <div className={styles.selectedInfo}>{selectedMed.ingredient}</div>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>복용 횟수</label>
            <select className={styles.select} value={frequency} onChange={e => setFrequency(e.target.value)}>
              <option value="">선택하세요</option>
              <option value="하루 1회">하루 1회</option>
              <option value="하루 2회">하루 2회</option>
              <option value="하루 3회">하루 3회</option>
              <option value="필요 시">필요 시</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>복용 시간</label>
            {times.map((t, i) => (
              <div key={i} className={styles.timeRow}>
                <input
                  className={styles.timeInput}
                  type="time"
                  value={t}
                  onChange={e => updateTime(i, e.target.value)}
                />
                {times.length > 1 && (
                  <button className={styles.removeBtn} onClick={() => removeTime(i)}>✕</button>
                )}
              </div>
            ))}
            <button className={styles.addTimeBtn} onClick={addTime}>＋ 시간 추가</button>
          </div>

          <div className={styles.btnGroup}>
            <button className={styles.skipBtn} onClick={handleSave}>저장 (처방전 생략)</button>
            <button className={styles.saveBtn} onClick={() => setStep(3)}>다음 → 처방전 등록</button>
          </div>
        </div>
      )}

      {/* Step 3: 처방전 등록 */}
      {step === 3 && (
        <div className={styles.content}>
          <div className={styles.prescCard}>
            <div className={styles.prescCardTitle}>📋 처방전 정보 등록</div>
            <div className={styles.prescCardDesc}>처방일수를 입력하면 다음 약국 방문일을 알려드려요</div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>처방 시작일</label>
            <input
              className={styles.searchInput}
              type="date"
              value={prescriptionDate}
              onChange={e => setPrescriptionDate(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>처방일수</label>
            <div className={styles.daysRow}>
              {[3, 5, 7, 14, 30, 60, 90].map(d => (
                <button
                  key={d}
                  className={`${styles.dayChip} ${prescriptionDays === String(d) ? styles.dayChipActive : ''}`}
                  onClick={() => setPrescriptionDays(String(d))}
                >
                  {d}일
                </button>
              ))}
            </div>
            <input
              className={styles.searchInput}
              type="number"
              value={prescriptionDays}
              onChange={e => setPrescriptionDays(e.target.value)}
              placeholder="직접 입력 (일)"
              style={{ marginTop: '8px' }}
            />
          </div>

          <button className={styles.calcBtn} onClick={calcNextVisit} disabled={!prescriptionDays}>
            📅 다음 방문일 계산하기
          </button>

          {nextVisit && (
            <div className={styles.nextVisitCard}>
              <div className={styles.nextVisitTitle}>🏥 다음 약국 방문 권장일</div>
              <div className={styles.nextVisitDate}>{nextVisit}</div>
              <div className={styles.nextVisitDesc}>
                약이 떨어지기 2일 전에 방문하시면 공백 없이 복용할 수 있어요
              </div>
              {Number(prescriptionDays) <= 3 && (
                <div className={styles.newPrescAlert}>
                  ⚠️ 처방일수가 짧습니다. 새로운 처방이 필요할 수 있어요.
                </div>
              )}
            </div>
          )}

          <div className={styles.disclaimer}>
            ⚕️ 본 서비스는 의학적 소견을 대체하지 않습니다. 반드시 의사 또는 약사와 상담하세요.
          </div>

          <button className={styles.saveBtn} onClick={handleSave}>등록 완료</button>
        </div>
      )}
    </div>
  )
}