import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getErrorMessage } from '../../../api/errorMessage'
import Icon from '../../../components/common/Icon'
import DateField from '../../../components/common/DateField'
import TimeField from '../../../components/common/TimeField'
import styles from './MedicineAddPage.module.css'
import MedicineNameInput from './MedicineNameInput'
import { analyzePrescription, defaultTimes } from '../utils/prescription'
import { checkInteractions } from '../utils/durCheck'
import { checkMedicineName } from '../utils/nameCheck'
import { listMedications, addMedication } from '../api/medicationStore'
import { CATEGORIES, guessCategory, setCategory } from '../categories'

const today = () => new Date().toISOString().split('T')[0]

// 처방전 분석 진행 단계 (prescription.js의 onStage와 같은 이름)
const ANALYZE_STAGES = [
  { key: 'preparing', label: '사진 준비' },
  { key: 'uploading', label: '사진 업로드' },
  { key: 'analyzing', label: '처방전 분석 · 약 이름 확인' },
]
const DAY_CHIPS = [3, 5, 7, 14, 30]

export default function MedicineAddPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const fileInputRef = useRef(null)
  const keyRef = useRef(0)
  const analyzingRef = useRef(false) // 분석 중 중복 요청 방지

  // 입력 방식 선택: 'photo' | 'manual'
  // 홈의 '촬영 시작'에서 들어오면 바로 사진 모드
  const [inputMode, setInputMode] = useState(location.state?.mode || null)

  // 공통 상태
  const [step, setStep] = useState(1)
  // 2단계에서 설정할 약 목록 (직접 입력은 1개, 사진은 AI가 읽은 여러 개)
  // { key, name, ingredient, dose, category, frequency, times, days, verified, suggestedName }
  // verified: true 확인된 약 / false 확인되지 않은 약(저장 전 경고) / null 판단 불가
  const [meds, setMeds] = useState([])
  const [saving, setSaving] = useState(false)
  // DUR 병용금기 경고: { [약 key]: [{ name, reasons }] }
  const [interactions, setInteractions] = useState({})

  // 사진 모드
  const [photoPreview, setPhotoPreview] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [stage, setStage] = useState({ key: 'preparing', percent: 0 })
  const [qualityWarning, setQualityWarning] = useState(null)

  // 직접 입력 모드
  const [manualName, setManualName] = useState('')
  const [checking, setChecking] = useState(false)
  const [notFound, setNotFound] = useState(null) // { message, suggestions } — 확인 안 된 이름이면 다음으로 못 넘어감
  const [manualPicked, setManualPicked] = useState(false) // 연관검색어에서 고른 이름이면 확인 생략

  // 처방 시작일 (모든 약 공통, 총 투약 일수는 약마다)
  const [prescriptionDate, setPrescriptionDate] = useState(today())

  const makeMed = (name, ingredient, { timesPerDay, days, dose, verified = null, suggestedName = null } = {}) => ({
    key: ++keyRef.current,
    name,
    ingredient,
    dose: dose || '',
    category: '', // 비어 있으면 약 이름으로 추정한 카테고리 사용
    frequency: timesPerDay >= 1 && timesPerDay <= 3 ? `하루 ${timesPerDay}회` : '',
    times: timesPerDay ? defaultTimes(timesPerDay) : [''],
    days: Number(days) > 0 ? String(days) : '',
    verified,
    suggestedName: suggestedName && suggestedName !== name ? suggestedName : null,
  })

  // ── DUR 병용금기 확인 (실패해도 등록은 진행) ──
  // 약마다 "이미 등록된 내 약 + 이번에 같이 등록하는 다른 약"과 비교
  const recheckInteractions = async (list) => {
    try {
      const existing = await listMedications().catch(() => [])
      const entries = await Promise.all(list.map(async m => {
        if (!m.name.trim()) return [m.key, []]
        const others = [
          ...existing,
          ...list.filter(o => o.key !== m.key && o.name.trim()).map(o => ({ medicineName: o.name.trim() })),
        ]
        return [m.key, await checkInteractions(m.name.trim(), others)]
      }))
      setInteractions(Object.fromEntries(entries))
    } catch {}
  }

  const resetToModeSelect = () => {
    setInteractions({})
    setMeds([])
    setInputMode(null)
    setPhotoPreview(null)
    setQualityWarning(null)
  }

  // ── 사진 촬영 ──
  const handlePhotoClick = () => {
    if (analyzingRef.current) return
    fileInputRef.current?.click()
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    e.target.value = '' // 같은 사진을 다시 골라도 동작하도록
    if (!file || analyzingRef.current) return
    analyzingRef.current = true
    setAnalyzing(true)
    setStage({ key: 'preparing', percent: 0 })
    const reader = new FileReader()
    reader.onload = async (ev) => {
      setPhotoPreview(ev.target.result)
      try {
        const result = await analyzePrescription(file, (key, percent = 0) => setStage({ key, percent }))
        const recognized = (result.medicines || []).map(m =>
          makeMed(m.name || '', 'AI 인식 결과 · 처방전과 비교해 확인해주세요', {
            timesPerDay: m.timesPerDay,
            days: m.days,
            dose: m.dose,
            verified: typeof m.verified === 'boolean' ? m.verified : null,
            suggestedName: m.suggestedName,
          })
        )
        setMeds(recognized)
        recheckInteractions(recognized)
        setPrescriptionDate(result.prescriptionDate || today())
        // 화질 경고: 문구가 오면 그대로, true 같은 값만 오면 기본 문구
        setQualityWarning(result.qualityWarning
          ? (typeof result.qualityWarning === 'string'
            ? result.qualityWarning
            : '사진이 흐리거나 어두워서 인식이 정확하지 않을 수 있어요. 처방전과 꼭 비교해 주세요.')
          : null)
        setStep(2)
      } catch (err) {
        // 서버가 보낸 오류 문구가 있으면 그대로 표시
        alert(getErrorMessage(err, '처방전 인식에 실패했습니다. 다시 촬영해주세요.'))
        setPhotoPreview(null)
      } finally {
        analyzingRef.current = false
        setAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  // ── 직접 입력 ──
  // 서버에서 확인된 약만 2단계로 넘어감 (없는 약이면 1단계에서 막음)
  const goManualStep2 = async (name = manualName.trim()) => {
    const list = [makeMed(name, '직접 입력', { verified: true })]
    setMeds(list)
    await recheckInteractions(list)
    setNotFound(null)
    setStep(2)
  }

  const handleManualNext = async () => {
    if (!manualName.trim() || checking) return
    // 연관검색어 후보에서 고른 약은 이름 확인을 통과한 것으로 처리
    if (manualPicked) {
      await goManualStep2()
      return
    }
    setNotFound(null)
    setChecking(true)
    try {
      const result = await checkMedicineName(manualName)
      if (!result) {
        // 서버 오류로 확인 못 함 → 넘어가지 않음
        setNotFound({ message: '약 이름을 확인하지 못했어요.', suggestions: [] })
        return
      }
      if (!result.verified) {
        setNotFound({ message: result.message, suggestions: result.suggestions })
        return
      }
      // 한 글자 오타는 서버가 고친 공식 이름으로 넘어감
      setManualName(result.name)
      await goManualStep2(result.name)
    } finally {
      setChecking(false)
    }
  }

  // ── 2단계: 약별 복용 설정 ──
  const updateMed = (key, patch) =>
    setMeds(prev => prev.map(m => (m.key === key ? { ...m, ...patch } : m)))

  // 하루 N회를 고르면 기본 시간으로 채움 ('필요 시'는 시간 그대로)
  const changeFrequency = (key, value) => {
    const n = Number(value.match(/하루 (\d)회/)?.[1])
    updateMed(key, n ? { frequency: value, times: defaultTimes(n) } : { frequency: value })
  }

  const addTime = (key) =>
    setMeds(prev => prev.map(m => (m.key === key ? { ...m, times: [...m.times, ''] } : m)))
  const removeTime = (key, i) =>
    setMeds(prev => prev.map(m =>
      m.key === key ? { ...m, times: m.times.filter((_, idx) => idx !== i) } : m
    ))
  const updateTime = (key, i, val) =>
    setMeds(prev => prev.map(m =>
      m.key === key ? { ...m, times: m.times.map((t, idx) => (idx === i ? val : t)) } : m
    ))

  // 사진 모드에서 약 이름을 고치면 다시 확인 (고친 뒤 칸을 벗어날 때)
  const recheckName = async (key, name) => {
    recheckInteractions(meds)
    if (!name.trim()) return
    // 연관검색어에서 고른 뒤 고치지 않았으면 다시 확인하지 않음
    if (meds.find(m => m.key === key)?.verified === true) return
    const result = await checkMedicineName(name)
    const verified = result ? result.verified : null
    const suggestedName = result && !result.verified ? (result.suggestions[0] || null) : null
    // 확인하는 동안 이름이 또 바뀌었으면 결과를 버림
    setMeds(prev => prev.map(m => (m.key === key && m.name === name ? { ...m, verified, suggestedName } : m)))
  }

  // 연관검색어에서 고른 이름 → 확인된 약
  const pickName = (key, name) => {
    const next = meds.map(m => (m.key === key ? { ...m, name, verified: true, suggestedName: null } : m))
    setMeds(next)
    recheckInteractions(next)
  }

  // "혹시 OOO인가요?" → [이 이름으로 바꾸기] (자동으로 바꾸지 않음)
  const applySuggestion = (key) => {
    const next = meds.map(m =>
      m.key === key ? { ...m, name: m.suggestedName, verified: true, suggestedName: null } : m
    )
    setMeds(next)
    recheckInteractions(next)
  }

  const removeMed = (key) => {
    const next = meds.filter(m => m.key !== key)
    setMeds(next)
    recheckInteractions(next)   // 지운 약과의 경고도 같이 정리
  }
  const addMed = () => setMeds(prev => [...prev, makeMed('', '직접 추가')])

  // 등록 전 입력 확인
  const validateMeds = () => {
    if (meds.length === 0) {
      alert('등록할 약이 없습니다.')
      return false
    }
    if (meds.some(m => !m.name.trim())) {
      alert('약 이름이 비어 있는 항목이 있습니다.')
      return false
    }
    if (meds.some(m => m.times.filter(t => t).length === 0)) {
      alert('복용 시간을 약마다 최소 1개 입력해주세요.')
      return false
    }
    return true
  }

  // ── 저장 (백엔드 연동) ──
  // 약 × 복용시간 마다 POST /medications, 처방 시작일은 localStorage(medStartDates)
  const handleSave = async () => {
    if (!validateMeds()) return

    // 확인되지 않은 약은 저장 전에 한 번 더 묻기 (막지는 않음)
    const unverified = meds.filter(m => m.verified === false)
    if (unverified.length > 0) {
      const list = unverified.map(m => `• ${m.name.trim()}`).join('\n')
      if (!window.confirm(`확인되지 않은 약입니다. 그래도 저장할까요?\n\n${list}`)) return
    }

    setSaving(true)
    const idsByKey = {} // 약 key -> 저장된 id들 (약마다 투약 일수가 달라서 따로 모음)
    const saved = {} // key -> 등록된 시간 값들 (실패 시 중복 등록 방지용)
    let failed = false
    let failMessage = ''

    try {
      for (const m of meds) {
        for (const t of m.times.filter(t => t)) {
          const savedMed = await addMedication({
            medicineName: m.name.trim(),
            alarmTime: t + ':00',
          })
          // 저장된 id를 수집 (게스트는 이 기기에서 만든 id)
          if (savedMed?.id) (idsByKey[m.key] ||= []).push(savedMed.id)
          if (!saved[m.key]) saved[m.key] = []
          saved[m.key].push(t)
        }
      }
    } catch (err) {
      failed = true
      failMessage = getErrorMessage(err, '')
    }

    // 처방 시작일 + 총 투약 일수를 localStorage에 저장 (약 id별로)
    if (Object.keys(idsByKey).length > 0) {
      try {
        const startDates = JSON.parse(localStorage.getItem('medStartDates') || '{}')
        const prescDays = JSON.parse(localStorage.getItem('medPrescDays') || '{}')
        Object.entries(idsByKey).forEach(([key, ids]) => {
          const m = meds.find(x => String(x.key) === key)
          ids.forEach(id => {
            if (prescriptionDate) startDates[String(id)] = prescriptionDate
            if (m?.days) prescDays[String(id)] = m.days
          })
        })
        localStorage.setItem('medStartDates', JSON.stringify(startDates))
        localStorage.setItem('medPrescDays', JSON.stringify(prescDays))
      } catch {}
    }
    // 약 이름 기준으로도 저장 (id 매핑이 어긋나도 약 목록/내 정보/일정에 표시되도록 하는 보조 키)
    // 카테고리도 약 이름 기준으로 저장
    try {
      const byName = JSON.parse(localStorage.getItem('medPrescByName') || '{}')
      Object.keys(saved).forEach(key => {
        const m = meds.find(x => String(x.key) === key)
        if (!m) return
        byName[m.name.trim()] = { startDate: prescriptionDate || '', days: m.days || '' }
        setCategory(m.name.trim(), m.category || guessCategory(m.name.trim()))
      })
      localStorage.setItem('medPrescByName', JSON.stringify(byName))
    } catch {}

    setSaving(false)

    if (!failed) {
      alert('약이 등록되었습니다!')
      navigate('/medicine')
      return
    }

    // 일부만 등록된 경우: 등록된 시간은 빼고 남은 것만 다시 등록하도록
    const anySaved = Object.keys(saved).length > 0
    setMeds(prev =>
      prev
        .map(m => {
          const done = saved[m.key]
          return done ? { ...m, times: m.times.filter(t => t && !done.includes(t)) } : m
        })
        .filter(m => m.times.length > 0)
    )
    const base = anySaved
      ? '일부만 등록되었습니다. 남은 항목만 다시 등록해주세요.'
      : '등록에 실패했습니다. 다시 시도해주세요.'
    alert(failMessage ? `${base}\n(${failMessage})` : base)
  }

  const stepTitles = {
    1: inputMode === 'manual' ? '약 이름 입력' : inputMode === 'photo' ? '약 사진 촬영' : '약 등록',
    2: '복용 설정',
  }

  const isPhoto = inputMode === 'photo'

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} disabled={analyzing} onClick={() => {
          if (step > 1) {
            setStep(step - 1)
            if (step === 2) resetToModeSelect()
          } else if (inputMode && step === 1) {
            setInputMode(null)
          } else {
            navigate(-1)
          }
        }} aria-label="뒤로"><Icon name="back" size={22} /></button>
        <h1 className={styles.title}>{stepTitles[step]}</h1>
        <div style={{ width: '32px' }} />
      </header>

      {/* 스텝 인디케이터 */}
      <div className={styles.stepRow}>
        {['방법 선택', '복용 설정'].map((label, i) => {
          const s = i + 1
          return (
            <div key={s} className={styles.stepWrap}>
              <div className={styles.stepCol}>
                <div className={`${styles.stepDot} ${step >= s ? styles.stepActive : ''}`}>{s}</div>
                <div className={`${styles.stepLabel} ${step >= s ? styles.stepLabelActive : ''}`}>{label}</div>
              </div>
              {s < 2 && <div className={`${styles.stepLine} ${step > s ? styles.stepLineDone : ''}`} />}
            </div>
          )
        })}
      </div>

      {/* Step 1: 등록 방법 선택 */}
      {step === 1 && !inputMode && (
        <div className={styles.content}>
          <div className={styles.photoGuide}>
            <div className={styles.photoGuideTitle}>약을 어떻게 등록할까요?</div>
            <div className={styles.photoGuideDesc}>사진 촬영 또는 직접 입력 중 선택하세요</div>
          </div>

          <div className={`${styles.modeCard} ${styles.modeCardMain}`} onClick={() => setInputMode('photo')}>
            <span className={`${styles.modeIcon} ${styles.modeIconMain}`}><Icon name="camera" size={22} /></span>
            <div className={styles.modeInfo}>
              <div className={styles.modeTitle}>처방전 / 약봉투 촬영</div>
              <div className={styles.modeSub}>AI가 자동으로 약 정보를 인식해요</div>
              <span className={styles.recommend}>추천</span>
            </div>
            <Icon name="chevronRight" size={18} className={styles.modeArrow} />
          </div>

          <div className={styles.modeCard} onClick={() => setInputMode('manual')}>
            <span className={styles.modeIcon}><Icon name="pencil" size={20} /></span>
            <div className={styles.modeInfo}>
              <div className={styles.modeTitle}>약 이름 직접 입력</div>
              <div className={styles.modeSub}>약 이름을 타이핑해서 등록해요</div>
            </div>
            <Icon name="chevronRight" size={18} className={styles.modeArrow} />
          </div>

          <div className={styles.disclaimer}>
            본 서비스는 의학적 소견을 대체하지 않습니다. 반드시 의사 또는 약사와 상담하세요.
          </div>
        </div>
      )}

      {/* Step 1: 사진 촬영 모드 */}
      {step === 1 && inputMode === 'photo' && (
        <div className={styles.content}>
          <div className={styles.photoGuide}>
            <div className={styles.photoGuideTitle}>처방전 또는 약봉투를 촬영해주세요</div>
            <div className={styles.photoGuideDesc}>AI가 자동으로 약 정보를 인식합니다</div>
          </div>

          {photoPreview ? (
            <div className={styles.previewWrap}>
              <img src={photoPreview} alt="촬영된 사진" className={styles.preview} />
              {analyzing && (
                <div className={styles.analyzingOverlay}>
                  <div className={styles.spinner} />
                  <ol className={styles.stageList}>
                    {ANALYZE_STAGES.map((st, i) => {
                      const current = ANALYZE_STAGES.findIndex(x => x.key === stage.key)
                      const state = i < current ? 'done' : i === current ? 'now' : 'wait'
                      return (
                        <li key={st.key} className={`${styles.stageItem} ${styles['stage_' + state]}`}>
                          <span className={styles.stageMark}>
                            {state === 'done' ? <Icon name="check" size={12} strokeWidth={3} /> : i + 1}
                          </span>
                          {st.label}
                          {state === 'now' && st.key === 'uploading' && ` ${stage.percent}%`}
                          {state === 'now' && st.key !== 'uploading' && ' 중...'}
                        </li>
                      )
                    })}
                  </ol>
                  <span className={styles.stageHint}>잠시만 기다려 주세요. 보통 10~20초 걸려요.</span>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`${styles.cameraWrap} ${analyzing ? styles.cameraDisabled : ''}`}
              onClick={handlePhotoClick}
              aria-disabled={analyzing}
            >
              <Icon name="camera" size={32} className={styles.cameraIcon} />
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
            disabled={analyzing}
            onChange={handlePhotoChange}
          />

          {photoPreview && !analyzing && (
            <button className={styles.retakeBtn} onClick={() => {
              setPhotoPreview(null)
              setMeds([])
            }}>
              다시 촬영하기
            </button>
          )}

          <div className={styles.tipBox}>
            <div className={styles.tipTitle}>촬영 팁</div>
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
            <div className={styles.photoGuideTitle}>약 이름을 입력해주세요</div>
            <div className={styles.photoGuideDesc}>복용 중인 약의 이름을 직접 입력하세요</div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>약 이름</label>
            <MedicineNameInput
              placeholder="예: 타이레놀, 아스피린..."
              value={manualName}
              onChange={v => { setManualName(v); setNotFound(null); setManualPicked(false) }}
              onSelect={name => { setManualName(name); setNotFound(null); setManualPicked(true) }}
              onEnter={handleManualNext}
              autoFocus
            />
            {notFound && (
              <p className={styles.nameError}>{notFound.message}</p>
            )}
          </div>

          <button
            className={styles.saveBtn}
            onClick={handleManualNext}
            disabled={!manualName.trim() || checking}
          >
            {checking ? '확인 중...' : '다음'}
          </button>

          <div className={styles.disclaimer}>
            본 서비스는 의학적 소견을 대체하지 않습니다. 반드시 의사 또는 약사와 상담하세요.
          </div>
        </div>
      )}

      {/* Step 2: 처방 정보 + 약별 복용 설정 한 화면 (사진 모드는 AI가 읽은 값이 모두 미리 채워짐) */}
      {step === 2 && (
        <div className={styles.content}>
          {qualityWarning && (
            <div className={styles.qualityWarning}>
              <Icon name="warning" size={16} />
              <span>{qualityWarning}</span>
            </div>
          )}

          {isPhoto && (
            <div className={styles.aiNotice}>
              <Icon name="magic" size={16} />
              <span>AI가 처방전에서 약 {meds.length}개를 읽었어요. 처방전과 비교해 확인해주세요.</span>
            </div>
          )}

          {/* 처방 정보: 모든 약 공통 */}
          <div className={styles.prescBlock}>
            <div className={styles.sectionTitle}>처방 정보</div>
            <div className={styles.formGroup}>
              <label className={styles.label}>처방 시작일</label>
              <DateField value={prescriptionDate} onChange={setPrescriptionDate} />
            </div>
          </div>

          <div className={styles.sectionTitle}>복용 설정</div>
          {meds.map(m => (
            <div key={m.key} className={styles.medBlock}>
              <div className={styles.selectedCard}>
                <span className={styles.selectedIcon}><Icon name="pill" size={20} /></span>
                <div className={styles.selectedText}>
                  {isPhoto ? (
                    <MedicineNameInput
                      variant="onDark"
                      value={m.name}
                      placeholder="약 이름"
                      onChange={v => updateMed(m.key, { name: v, verified: null, suggestedName: null })}
                      onSelect={name => pickName(m.key, name)}
                      onBlur={e => recheckName(m.key, e.target.value)}
                    />
                  ) : (
                    <div className={styles.selectedName}>{m.name}</div>
                  )}
                  <div className={styles.selectedInfo}>
                    {m.dose ? `1회 ${m.dose} · ` : ''}{m.ingredient}
                  </div>
                </div>
                {isPhoto && meds.length > 1 && (
                  <button
                    className={styles.medRemoveBtn}
                    onClick={() => removeMed(m.key)}
                    aria-label="약 삭제"
                  >✕</button>
                )}
              </div>

              {m.verified === false && (
                <div className={styles.unverifiedBox}>
                  <div className={styles.unverifiedTitle}>
                    <Icon name="warning" size={16} /> 확인되지 않은 약이에요
                  </div>
                  {m.suggestedName ? (
                    <div className={styles.suggestRow}>
                      <span>혹시 <b>{m.suggestedName}</b>인가요?</span>
                      <button className={styles.unverifiedBtn} onClick={() => applySuggestion(m.key)}>
                        이 이름으로 바꾸기
                      </button>
                    </div>
                  ) : (
                    <div className={styles.unverifiedDesc}>처방전과 비교해 약 이름을 확인해 주세요.</div>
                  )}
                </div>
              )}

              {interactions[m.key]?.length > 0 && (
                <div className={styles.durWarning}>
                  <div className={styles.durTitle}>
                    <Icon name="warning" size={16} /> 함께 복용하면 안 되는 약이 있어요
                  </div>
                  {interactions[m.key].map(it => (
                    <div key={it.name} className={styles.durItem}>
                      • {it.name}{it.reasons.length > 0 && ` — ${it.reasons.join(', ')}`}
                    </div>
                  ))}
                  <div className={styles.durDesc}>반드시 의사 또는 약사와 상담하세요.</div>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.label}>카테고리</label>
                <select
                  className={styles.select}
                  value={m.category || guessCategory(m.name)}
                  onChange={e => updateMed(m.key, { category: e.target.value })}
                >
                  {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.key}</option>)}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>복용 횟수</label>
                <select
                  className={styles.select}
                  value={m.frequency}
                  onChange={e => changeFrequency(m.key, e.target.value)}
                >
                  <option value="">선택하세요</option>
                  <option value="하루 1회">하루 1회</option>
                  <option value="하루 2회">하루 2회</option>
                  <option value="하루 3회">하루 3회</option>
                  <option value="필요 시">필요 시</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>총 투약 일수</label>
                <div className={styles.daysRow}>
                  {DAY_CHIPS.map(d => (
                    <button
                      key={d}
                      className={`${styles.dayChip} ${m.days === String(d) ? styles.dayChipActive : ''}`}
                      onClick={() => updateMed(m.key, { days: String(d) })}
                    >
                      {d}일
                    </button>
                  ))}
                </div>
                <div className={styles.daysInputWrap}>
                  <input
                    className={styles.searchInput}
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={m.days}
                    onChange={e => updateMed(m.key, { days: e.target.value })}
                    placeholder="직접 입력"
                  />
                  <span className={styles.daysSuffix}>일</span>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>복용 시간</label>
                {m.times.map((t, i) => (
                  <div key={i} className={styles.timeRow}>
                    <TimeField value={t} onChange={val => updateTime(m.key, i, val)} />
                    {m.times.length > 1 && (
                      <button className={styles.removeBtn} onClick={() => removeTime(m.key, i)}>✕</button>
                    )}
                  </div>
                ))}
                <button className={styles.addTimeBtn} onClick={() => addTime(m.key)}>＋ 시간 추가</button>
              </div>
            </div>
          ))}

          {isPhoto && (
            <button className={styles.addTimeBtn} onClick={addMed}>＋ 약 추가</button>
          )}

          <div className={styles.disclaimer}>
            본 서비스는 의학적 소견을 대체하지 않습니다. 반드시 의사 또는 약사와 상담하세요.
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
