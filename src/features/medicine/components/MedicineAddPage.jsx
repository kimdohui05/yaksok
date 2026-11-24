import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import client from '../../../api/client'
import Icon from '../../../components/common/Icon'
import styles from './MedicineAddPage.module.css'
import { analyzePrescription, defaultTimes } from '../utils/prescription'
import { checkInteractions } from '../utils/durCheck'
import { CATEGORIES, guessCategory, setCategory } from '../categories'

const today = () => new Date().toISOString().split('T')[0]

export default function MedicineAddPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const fileInputRef = useRef(null)
  const keyRef = useRef(0)

  // 입력 방식 선택: 'photo' | 'manual'
  // 홈의 '촬영 시작'에서 들어오면 바로 사진 모드
  const [inputMode, setInputMode] = useState(location.state?.mode || null)

  // 공통 상태
  const [step, setStep] = useState(1)
  // 2단계에서 설정할 약 목록 (직접 입력은 1개, 사진은 AI가 읽은 여러 개)
  // { key, name, ingredient, category, frequency, times }
  const [meds, setMeds] = useState([])
  const [saving, setSaving] = useState(false)
  // DUR 병용금기 경고: { [약 key]: [{ name, reasons }] }
  const [interactions, setInteractions] = useState({})

  // 사진 모드
  const [photoPreview, setPhotoPreview] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)

  // 직접 입력 모드
  const [manualName, setManualName] = useState('')
  const [checking, setChecking] = useState(false)
  const [notFound, setNotFound] = useState(false)

  // 처방전 상태
  const [prescriptionDays, setPrescriptionDays] = useState('')
  const [prescriptionDate, setPrescriptionDate] = useState(today())

  const makeMed = (name, ingredient, timesPerDay) => ({
    key: ++keyRef.current,
    name,
    ingredient,
    category: '', // 비어 있으면 약 이름으로 추정한 카테고리 사용
    frequency: timesPerDay >= 1 && timesPerDay <= 3 ? `하루 ${timesPerDay}회` : '',
    times: timesPerDay ? defaultTimes(timesPerDay) : [''],
  })

  // ── DUR 병용금기 확인 (실패해도 등록은 진행) ──
  // 약마다 "이미 등록된 내 약 + 이번에 같이 등록하는 다른 약"과 비교
  const recheckInteractions = async (list) => {
    try {
      const res = await client.get('/medications').catch(() => ({ data: [] }))
      const existing = res.data || []
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
  }

  // ── 사진 촬영 ──
  const handlePhotoClick = () => fileInputRef.current?.click()

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    e.target.value = '' // 같은 사진을 다시 골라도 동작하도록
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      setPhotoPreview(ev.target.result)
      setAnalyzing(true)
      try {
        const result = await analyzePrescription(file)
        const recognized = result.medicines.map(m =>
          makeMed(m.name, 'AI 인식 결과 · 처방전과 비교해 확인해주세요', m.timesPerDay)
        )
        setMeds(recognized)
        recheckInteractions(recognized)
        setPrescriptionDate(result.prescriptionDate || today())
        // 처방일수는 처방전 공통 1칸이라, 약마다 다르면 가장 긴 일수로 채움
        const days = Math.max(0, ...result.medicines.map(m => Number(m.days) || 0))
        setPrescriptionDays(days ? String(days) : '')
        setStep(2)
      } catch {
        alert('처방전 인식에 실패했습니다. 다시 촬영해주세요.')
        setPhotoPreview(null)
      } finally {
        setAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  // ── 직접 입력 ──
  const handleManualNext = async () => {
    if (!manualName.trim()) return
    setNotFound(false)
    setChecking(true)
    try {
      // 일반의약품(e약은요) 또는 병용금기 목록 중 하나라도 있으면 통과
      const params = { itemName: manualName.trim() }
      const [info, check] = await Promise.all([
        client.get('/api/dur/info', { params }),
        client.get('/api/dur/check', { params }),
      ])
      if (info.data.length === 0 && check.data.length === 0) {
        setNotFound(true)
        return
      }
      const list = [makeMed(manualName.trim(), '직접 입력')]
      setMeds(list)
      await recheckInteractions(list)
      setStep(2)
    } catch {
      // API 오류 시 그냥 통과 (DUR 서버 문제일 수 있음)
      const list = [makeMed(manualName.trim(), '직접 입력')]
      setMeds(list)
      await recheckInteractions(list)
      setStep(2)
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

  const removeMed = (key) => {
    const next = meds.filter(m => m.key !== key)
    setMeds(next)
    recheckInteractions(next)   // 지운 약과의 경고도 같이 정리
  }
  const addMed = () => setMeds(prev => [...prev, makeMed('', '직접 추가')])

  // 복용 설정 → 처방 정보로 넘어가기 전 입력 확인
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

    setSaving(true)
    const ids = []
    const saved = {} // key -> 등록된 시간 값들 (실패 시 중복 등록 방지용)
    let failed = false

    try {
      for (const m of meds) {
        for (const t of m.times.filter(t => t)) {
          const res = await client.post('/medications', {
            medicineName: m.name.trim(),
            alarmTime: t + ':00',
          })
          // 백엔드가 저장된 id를 반환하면 수집
          if (res.data?.id) ids.push(res.data.id)
          if (!saved[m.key]) saved[m.key] = []
          saved[m.key].push(t)
        }
      }
    } catch {
      failed = true
    }

    // 처방 시작일 + 처방일수를 localStorage에 저장 (약 id별로)
    if (ids.length > 0) {
      try {
        const startDates = JSON.parse(localStorage.getItem('medStartDates') || '{}')
        const prescDays = JSON.parse(localStorage.getItem('medPrescDays') || '{}')
        ids.forEach(id => {
          if (prescriptionDate) startDates[String(id)] = prescriptionDate
          if (prescriptionDays) prescDays[String(id)] = prescriptionDays
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
        byName[m.name.trim()] = { startDate: prescriptionDate || '', days: prescriptionDays || '' }
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
    alert(anySaved
      ? '일부만 등록되었습니다. 남은 항목만 다시 등록해주세요.'
      : '등록에 실패했습니다. 다시 시도해주세요.')
  }

  const stepTitles = {
    1: inputMode === 'manual' ? '약 이름 입력' : inputMode === 'photo' ? '약 사진 촬영' : '약 등록',
    2: '복용 설정',
    3: '처방전 등록',
  }

  const isPhoto = inputMode === 'photo'

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => {
          if (step > 1) {
            setStep(step - 1)
            if (step === 2) resetToModeSelect()  // 3 → 2는 입력한 약 그대로 유지
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
        {['방법 선택', '복용 설정', '처방 정보'].map((label, i) => {
          const s = i + 1
          return (
            <div key={s} className={styles.stepWrap}>
              <div className={styles.stepCol}>
                <div className={`${styles.stepDot} ${step >= s ? styles.stepActive : ''}`}>{s}</div>
                <div className={`${styles.stepLabel} ${step >= s ? styles.stepLabelActive : ''}`}>{label}</div>
              </div>
              {s < 3 && <div className={`${styles.stepLine} ${step > s ? styles.stepLineDone : ''}`} />}
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
                  <span>약 정보 분석 중...</span>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.cameraWrap} onClick={handlePhotoClick}>
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
            <input
              className={`${styles.searchInput} ${notFound ? styles.inputError : ''}`}
              type="text"
              placeholder="예: 타이레놀, 아스피린..."
              value={manualName}
              onChange={e => { setManualName(e.target.value); setNotFound(false) }}
              onKeyDown={e => e.key === 'Enter' && handleManualNext()}
              autoFocus
            />
            {notFound && (
              <div className={styles.notFoundMsg}>
                약이 존재하지 않습니다. 약 이름을 다시 확인해주세요.
              </div>
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

      {/* Step 2: 약별 복용 설정 (사진 모드는 AI 결과가 미리 채워짐) */}
      {step === 2 && (
        <div className={styles.content}>
          {meds.map(m => (
            <div key={m.key} className={styles.medBlock}>
              <div className={styles.selectedCard}>
                <span className={styles.selectedIcon}><Icon name="pill" size={20} /></span>
                <div className={styles.selectedText}>
                  {isPhoto ? (
                    <input
                      className={styles.selectedNameInput}
                      type="text"
                      value={m.name}
                      placeholder="약 이름"
                      onChange={e => updateMed(m.key, { name: e.target.value })}
                      onBlur={() => recheckInteractions(meds)}
                    />
                  ) : (
                    <div className={styles.selectedName}>{m.name}</div>
                  )}
                  <div className={styles.selectedInfo}>{m.ingredient}</div>
                </div>
                {isPhoto && meds.length > 1 && (
                  <button
                    className={styles.medRemoveBtn}
                    onClick={() => removeMed(m.key)}
                    aria-label="약 삭제"
                  >✕</button>
                )}
              </div>

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
                <label className={styles.label}>복용 시간</label>
                {m.times.map((t, i) => (
                  <div key={i} className={styles.timeRow}>
                    <input
                      className={styles.timeInput}
                      type="time"
                      value={t}
                      onChange={e => updateTime(m.key, i, e.target.value)}
                    />
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

          <div className={styles.btnGroup}>
            <button className={styles.saveBtn} onClick={() => validateMeds() && setStep(3)}>
              다음
            </button>
          </div>
        </div>
      )}

      {/* Step 3: 처방전 등록 (모든 약 공통) */}
      {step === 3 && (
        <div className={styles.content}>
          <div className={styles.prescCard}>
            <div className={styles.prescCardTitle}>처방전 정보 등록</div>
            <div className={styles.prescCardDesc}>처방 시작일과 처방일수를 입력해주세요</div>
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
