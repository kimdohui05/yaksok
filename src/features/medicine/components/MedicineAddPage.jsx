import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../../api/client'
import styles from './MedicineAddPage.module.css'

export default function MedicineAddPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  // 입력 방식 선택: 'photo' | 'manual'
  const [inputMode, setInputMode] = useState(null)

  // 공통 상태
  const [step, setStep] = useState(1)
  const [selectedMed, setSelectedMed] = useState(null)
  const [times, setTimes] = useState([''])
  const [frequency, setFrequency] = useState('')
  const [saving, setSaving] = useState(false)

  // 사진 모드
  const [photoPreview, setPhotoPreview] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)

  // 직접 입력 모드
  const [manualName, setManualName] = useState('')

  // 처방전 상태
  const [prescriptionDays, setPrescriptionDays] = useState('')
  const [prescriptionDate, setPrescriptionDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [nextVisit, setNextVisit] = useState(null)

  // ── 사진 촬영 ──
  const handlePhotoClick = () => fileInputRef.current?.click()

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPhotoPreview(ev.target.result)
      setAnalyzing(true)
      // OCR 연동 전 더미 처리
      setTimeout(() => {
        setSelectedMed({
          name: '타이레놀',
          ingredient: '아세트아미노펜 500mg (OCR 인식 결과)',
        })
        setAnalyzing(false)
        setStep(2)
      }, 1500)
    }
    reader.readAsDataURL(file)
  }

  // ── 직접 입력 ──
  const handleManualNext = () => {
    if (!manualName.trim()) return
    setSelectedMed({ name: manualName.trim(), ingredient: '직접 입력' })
    setStep(2)
  }

  // ── 복용 시간 ──
  const addTime = () => setTimes([...times, ''])
  const removeTime = (i) => setTimes(times.filter((_, idx) => idx !== i))
  const updateTime = (i, val) => setTimes(times.map((t, idx) => idx === i ? val : t))

  // ── 처방전 계산 ──
  const calcNextVisit = () => {
    if (!prescriptionDays || !prescriptionDate) return
    const start = new Date(prescriptionDate)
    start.setDate(start.getDate() + Number(prescriptionDays) - 2)
    const formatted = start.toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    })
    setNextVisit(formatted)
    localStorage.setItem('nextVisit', formatted)
  }

  // ── 저장 (백엔드 연동) ──
  const handleSave = async () => {
    if (!selectedMed) return
    const validTimes = times.filter(t => t)
    if (validTimes.length === 0) {
      alert('복용 시간을 최소 1개 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      // 첫 번째 시간만 등록 (복수 시간은 여러 번 호출)
      for (const t of validTimes) {
        await client.post('/medications', {
          medicineName: selectedMed.name,
          alarmTime: t + ':00', // "HH:mm:ss" 형식
        })
      }
      alert('약이 등록되었습니다!')
      navigate('/medicine')
    } catch (err) {
      alert('등록에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  const stepTitles = {
    1: inputMode === 'manual' ? '약 이름 입력' : inputMode === 'photo' ? '약 사진 촬영' : '등록 방법 선택',
    2: '복용 설정',
    3: '처방전 등록'
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => {
          if (step > 1) {
            setStep(step - 1)
            if (step === 2) { setSelectedMed(null); setInputMode(null) }
          } else if (inputMode && step === 1) {
            setInputMode(null)
          } else {
            navigate(-1)
          }
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

      {/* Step 1: 등록 방법 선택 */}
      {step === 1 && !inputMode && (
        <div className={styles.content}>
          <div className={styles.photoGuide}>
            <div className={styles.photoGuideIcon}>💊</div>
            <div className={styles.photoGuideTitle}>약을 어떻게 등록할까요?</div>
            <div className={styles.photoGuideDesc}>사진 촬영 또는 직접 입력 중 선택하세요</div>
          </div>

          {/* 사진 촬영 선택 */}
          <div className={styles.modeCard} onClick={() => setInputMode('photo')}>
            <div className={styles.modeIcon}>📷</div>
            <div className={styles.modeInfo}>
              <div className={styles.modeTitle}>처방전 / 약봉투 사진 촬영</div>
              <div className={styles.modeSub}>AI가 자동으로 약 정보를 인식해요</div>
            </div>
            <span className={styles.modeArrow}>→</span>
          </div>

          {/* 직접 입력 선택 */}
          <div className={styles.modeCard} onClick={() => setInputMode('manual')}>
            <div className={styles.modeIcon}>✏️</div>
            <div className={styles.modeInfo}>
              <div className={styles.modeTitle}>약 이름 직접 입력</div>
              <div className={styles.modeSub}>약 이름을 직접 타이핑해서 등록해요</div>
            </div>
            <span className={styles.modeArrow}>→</span>
          </div>

          <div className={styles.disclaimer}>
            ⚕️ 본 서비스는 의학적 소견을 대체하지 않습니다. 반드시 의사 또는 약사와 상담하세요.
          </div>
        </div>
      )}

      {/* Step 1: 사진 촬영 모드 */}
      {step === 1 && inputMode === 'photo' && (
        <div className={styles.content}>
          <div className={styles.photoGuide}>
            <div className={styles.photoGuideIcon}>📋</div>
            <div className={styles.photoGuideTitle}>처방전 또는 약봉투를 촬영해주세요</div>
            <div className={styles.photoGuideDesc}>AI가 자동으로 약 정보를 인식합니다</div>
          </div>

          {photoPreview ? (
            <div className={styles.previewWrap}>
              <img src={photoPreview} alt="촬영된 사진" className={styles.preview} />
              {analyzing && (
                <div className={styles.analyzingOverlay}>
                  <div className={styles.spinner} />
                  <span>약 정보 분석 중...</span>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.cameraWrap} onClick={handlePhotoClick}>
              <div className={styles.cameraIcon}>📷</div>
              <div className={styles.cameraText}>눌러서 사진 촬영 또는 선택</div>
              <div className={styles.cameraSub}>카메라 또는 갤러리에서 선택</div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handlePhotoChange}
          />

          {photoPreview && !analyzing && (
            <button className={styles.retakeBtn} onClick={() => {
              setPhotoPreview(null)
              setSelectedMed(null)
            }}>
              🔄 다시 촬영하기
            </button>
          )}

          <div className={styles.tipBox}>
            <div className={styles.tipTitle}>📌 촬영 팁</div>
            <div className={styles.tipItem}>• 처방전 전체가 보이도록 찍어주세요</div>
            <div className={styles.tipItem}>• 밝은 곳에서 촬영하면 인식률이 높아요</div>
            <div className={styles.tipItem}>• 약봉투의 약 이름 부분을 선명하게 찍어주세요</div>
          </div>
        </div>
      )}

      {/* Step 1: 직접 입력 모드 */}
      {step === 1 && inputMode === 'manual' && (
        <div className={styles.content}>
          <div className={styles.photoGuide}>
            <div className={styles.photoGuideIcon}>✏️</div>
            <div className={styles.photoGuideTitle}>약 이름을 입력해주세요</div>
            <div className={styles.photoGuideDesc}>복용 중인 약의 이름을 직접 입력하세요</div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>약 이름</label>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="예: 타이레놀, 아스피린..."
              value={manualName}
              onChange={e => setManualName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualNext()}
              autoFocus
            />
          </div>

          <button
            className={styles.saveBtn}
            onClick={handleManualNext}
            disabled={!manualName.trim()}
          >
            다음 →
          </button>

          <div className={styles.disclaimer}>
            ⚕️ 본 서비스는 의학적 소견을 대체하지 않습니다. 반드시 의사 또는 약사와 상담하세요.
          </div>
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
            <button
              className={styles.skipBtn}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '저장 중...' : '저장 (처방전 생략)'}
            </button>
            <button className={styles.saveBtn} onClick={() => setStep(3)}>
              다음 → 처방전 등록
            </button>
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

          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '저장 중...' : '등록 완료'}
          </button>
        </div>
      )}
    </div>
  )
}