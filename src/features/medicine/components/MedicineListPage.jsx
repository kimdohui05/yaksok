import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../../api/client'
import BottomTab from '../../../components/common/BottomTab'
import styles from './MedicineListPage.module.css'

// localStorage에서 처방 정보 불러오기
const getPrescInfo = () => {
  try {
    const startDates = JSON.parse(localStorage.getItem('medStartDates') || '{}')
    const prescDays = JSON.parse(localStorage.getItem('medPrescDays') || '{}')
    const byName = JSON.parse(localStorage.getItem('medPrescByName') || '{}')
    return { startDates, prescDays, byName }
  } catch { return { startDates: {}, prescDays: {}, byName: {} } }
}

// 처방 시작일 + 처방일수로 남은 일수 계산
const calcRemaining = (startDate, days) => {
  if (!startDate || !days) return null
  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + Number(days) - 1)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24))
  return diff
}

export default function MedicineListPage() {
  const navigate = useNavigate()
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [aiModal, setAiModal] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiText, setAiText] = useState('')
  const [drugInfo, setDrugInfo] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [editForm, setEditForm] = useState({ medicineName: '', alarmTime: '', startDate: '', days: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [prescInfo, setPrescInfo] = useState({ startDates: {}, prescDays: {}, byName: {} })

  const fetchMedicines = useCallback(async () => {
    try {
      setLoading(true)
      const res = await client.get('/medications')
      setMedicines(res.data)
    } catch (err) {
      console.error('약 목록 불러오기 실패', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMedicines()
    setPrescInfo(getPrescInfo())
  }, [fetchMedicines])

  const handleDelete = async (id) => {
    if (!window.confirm('이 약을 삭제하시겠습니까?')) return
    setDeletingId(id)
    try {
      await client.delete(`/medications/${id}`)
      setMedicines(prev => prev.filter(m => m.id !== id))
      // localStorage에서도 처방 정보 삭제
      try {
        const startDates = JSON.parse(localStorage.getItem('medStartDates') || '{}')
        const prescDays = JSON.parse(localStorage.getItem('medPrescDays') || '{}')
        delete startDates[String(id)]
        delete prescDays[String(id)]
        localStorage.setItem('medStartDates', JSON.stringify(startDates))
        localStorage.setItem('medPrescDays', JSON.stringify(prescDays))
        setPrescInfo(getPrescInfo())
      } catch {}
    } catch (err) {
      alert('삭제에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleAiClick = async (medicine) => {
    setAiModal(medicine)
    setAiLoading(true)
    setAiText('')
    setDrugInfo(null)
    try {
      // 백엔드 DUR 품목정보 API (e약은요) 조회
      const search = async (name) => {
        const res = await client.get('/api/dur/info', { params: { itemName: name } })
        return Array.isArray(res.data) ? res.data : []
      }
      let list = await search(medicine.medicineName)
      // 결과가 없으면 용량/단위 등 숫자 이후를 뺀 이름으로 재검색 (예: 타이레놀정500mg → 타이레놀정)
      if (list.length === 0) {
        const short = medicine.medicineName.replace(/[\d(].*$/, '').trim()
        if (short && short !== medicine.medicineName) list = await search(short)
      }
      if (list.length > 0) {
        setDrugInfo(list[0])
      } else {
        setAiText(`${medicine.medicineName}에 대한 품목정보를 찾지 못했습니다. 반드시 의사 또는 약사와 상담하세요.`)
      }
    } catch (err) {
      console.error('품목정보 조회 실패', err)
      const status = err?.response?.status
      setAiText(`약 정보를 불러오지 못했습니다.${status ? ` (오류 ${status})` : ''} 서버(/api/dur/info) 상태를 확인해주세요.`)
    } finally {
      // 추후 Gemini API 연동 시 drugInfo를 프롬프트로 전달해 요약 생성
      setAiLoading(false)
    }
  }

  const formatTime = (alarmTime) => {
    if (!alarmTime) return ''
    // Jackson이 LocalTime을 배열로 직렬화할 수 있음 [H, m, s]
    if (Array.isArray(alarmTime)) {
      const h = String(alarmTime[0]).padStart(2, '0')
      const m = String(alarmTime[1]).padStart(2, '0')
      return `${h}:${m}`
    }
    return String(alarmTime).substring(0, 5)
  }

  // 처방일수 뱃지 렌더
  const renderPrescBadge = (m) => {
    const { startDates, prescDays, byName } = prescInfo
    const key = String(m.id)
    // id 기준 → 없으면 약 이름 기준으로 조회
    const nameInfo = byName[m.medicineName] || {}
    const days = prescDays[key] || nameInfo.days
    const startDate = startDates[key] || nameInfo.startDate
    if (!days) return null

    const remaining = calcRemaining(startDate, days)

    if (remaining === null) {
      // 시작일 없이 처방일수만 있는 경우
      return <div className={styles.prescBadge}>📋 처방 {days}일분</div>
    }
    if (remaining < 0) {
      return <div className={`${styles.prescBadge} ${styles.prescExpired}`}>📋 처방 {days}일분 · 처방 만료</div>
    }
    if (remaining <= 3) {
      return <div className={`${styles.prescBadge} ${styles.prescWarning}`}>📋 처방 {days}일분 · 잔여 {remaining}일 ⚠️</div>
    }
    return <div className={styles.prescBadge}>📋 처방 {days}일분 · 잔여 {remaining}일</div>
  }

  // 수정 모달 열기
  const openEdit = (m) => {
    const key = String(m.id)
    const nameInfo = prescInfo.byName[m.medicineName] || {}
    setEditModal(m)
    setEditForm({
      medicineName: m.medicineName,
      alarmTime: formatTime(m.alarmTime),
      startDate: prescInfo.startDates[key] || nameInfo.startDate || '',
      days: prescInfo.prescDays[key] || nameInfo.days || '',
    })
  }

  // 수정 저장
  const handleEditSave = async () => {
    if (!editForm.medicineName.trim() || !editForm.alarmTime) {
      alert('약 이름과 복용 시간을 입력해주세요.')
      return
    }
    setEditSaving(true)
    try {
      const res = await client.put(`/medications/${editModal.id}`, {
        medicineName: editForm.medicineName.trim(),
        alarmTime: editForm.alarmTime + ':00',
      })
      setMedicines(prev => prev.map(m => m.id === editModal.id ? { ...m, ...res.data } : m))

      // 처방 시작일 / 처방일수 localStorage 갱신
      const startDates = JSON.parse(localStorage.getItem('medStartDates') || '{}')
      const prescDays = JSON.parse(localStorage.getItem('medPrescDays') || '{}')
      const byName = JSON.parse(localStorage.getItem('medPrescByName') || '{}')
      const key = String(editModal.id)
      if (editForm.startDate) startDates[key] = editForm.startDate; else delete startDates[key]
      if (editForm.days) prescDays[key] = String(editForm.days); else delete prescDays[key]
      byName[editForm.medicineName.trim()] = {
        startDate: editForm.startDate || '',
        days: editForm.days ? String(editForm.days) : '',
      }
      localStorage.setItem('medStartDates', JSON.stringify(startDates))
      localStorage.setItem('medPrescDays', JSON.stringify(prescDays))
      localStorage.setItem('medPrescByName', JSON.stringify(byName))
      setPrescInfo(getPrescInfo())
      setEditModal(null)
    } catch (err) {
      console.error('약 수정 실패', err)
      alert('수정에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>내 약 목록</h1>
        <button className={styles.addBtn} onClick={() => navigate('/medicine/add')}>＋ 약 추가</button>
      </header>

      <div className={styles.list}>
        {loading ? (
          <div className={styles.empty}>
            <div className={styles.spinner} />
            <p>불러오는 중...</p>
          </div>
        ) : medicines.length === 0 ? (
          <div className={styles.empty}>
            <span>💊</span>
            <p>등록된 약이 없습니다</p>
            <button className={styles.emptyBtn} onClick={() => navigate('/medicine/add')}>약 추가하기</button>
          </div>
        ) : (
          medicines.map(m => (
            <div key={m.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.info}>
                  <div className={styles.name}>{m.medicineName}</div>
                  {m.alarmTime && (
                    <div className={styles.ingredient}>{formatTime(m.alarmTime)} 알람</div>
                  )}
                </div>
              </div>

              {/* 처방일수 뱃지 */}
              {renderPrescBadge(m)}

              <div className={styles.cardActions}>
                <button
                  className={styles.aiBtn}
                  onClick={() => handleAiClick(m)}
                >
                  Gemini AI 복약 설명
                </button>
                <button
                  className={styles.editBtn}
                  onClick={() => openEdit(m)}
                >
                  수정
                </button>
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(m.id)}
                  disabled={deletingId === m.id}
                >
                  {deletingId === m.id ? '삭제 중...' : '삭제'}
                </button>
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

      {/* Gemini AI 요약 모달 */}
      {aiModal && (
        <div className={styles.modalOverlay} onClick={() => setAiModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHandle} />
            <div className={styles.modalHeader}>
              <h2> Gemini AI 복약 설명</h2>
              <button onClick={() => setAiModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalMedRow}>
                <span className={styles.modalMedName}>{aiModal.medicineName}</span>
                {aiModal.alarmTime && (
                  <span className={styles.modalMedSub}>{formatTime(aiModal.alarmTime)} 알람</span>
                )}
              </div>
              {aiLoading ? (
                <div className={styles.aiLoading}>
                  <div className={styles.spinner} />
                  <span>Gemini AI가 분석 중입니다...</span>
                </div>
              ) : (
                drugInfo ? (
                  <div className={styles.aiBox}>
                    {drugInfo.company && <p className={styles.infoCompany}>{drugInfo.company}</p>}
                    {[
                      ['효능', drugInfo.efficacy],
                      ['사용법', drugInfo.usage],
                      ['사용 전 알아야 할 내용', drugInfo.warning],
                      ['주의사항', drugInfo.precaution],
                      ['상호작용', drugInfo.interaction],
                      ['부작용', drugInfo.sideEffect],
                      ['보관법', drugInfo.storage],
                    ].filter(([, v]) => v).map(([label, v]) => (
                      <div key={label} className={styles.infoSection}>
                        <div className={styles.infoLabel}>{label}</div>
                        <p className={styles.aiText}>{v}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.aiBox}>
                    <p className={styles.aiText}>{aiText}</p>
                  </div>
                )
              )}
              <div className={styles.modalDisclaimer}>
                ⚕️ AI 설명은 참고용이며 의학적 소견을 대체하지 않습니다.
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 약 수정 모달 */}
      {editModal && (
        <div className={styles.modalOverlay} onClick={() => setEditModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHandle} />
            <div className={styles.modalHeader}>
              <h2> 약 정보 수정</h2>
              <button onClick={() => setEditModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.editField}>
                <span>약 이름</span>
                <input
                  type="text"
                  value={editForm.medicineName}
                  maxLength={50}
                  onChange={e => setEditForm({ ...editForm, medicineName: e.target.value })}
                />
              </label>
              <label className={styles.editField}>
                <span>복용 시간</span>
                <input
                  type="time"
                  value={editForm.alarmTime}
                  onChange={e => setEditForm({ ...editForm, alarmTime: e.target.value })}
                />
              </label>
              <label className={styles.editField}>
                <span>처방 시작일</span>
                <input
                  type="date"
                  value={editForm.startDate}
                  onChange={e => setEditForm({ ...editForm, startDate: e.target.value })}
                />
              </label>
              <label className={styles.editField}>
                <span>처방일수 (일)</span>
                <input
                  type="number"
                  min="1"
                  value={editForm.days}
                  onChange={e => setEditForm({ ...editForm, days: e.target.value })}
                />
              </label>
              <button className={styles.saveBtn} onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}