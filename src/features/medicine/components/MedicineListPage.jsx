import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../../api/client'
import BottomTab from '../../../components/common/BottomTab'
import styles from './MedicineListPage.module.css'

export default function MedicineListPage() {
  const navigate = useNavigate()
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [aiModal, setAiModal] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiText, setAiText] = useState('')
  const [deletingId, setDeletingId] = useState(null)

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
  }, [fetchMedicines])

  const handleDelete = async (id) => {
    if (!window.confirm('이 약을 삭제하시겠습니까?')) return
    setDeletingId(id)
    try {
      await client.delete(`/medications/${id}`)
      setMedicines(prev => prev.filter(m => m.id !== id))
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
    // 추후 Gemini API 연동 - 임시 더미
    setTimeout(() => {
      setAiText(`${medicine.medicineName}은 ${medicine.alarmTime ? formatTime(medicine.alarmTime) + ' 알람' : ''}이 설정된 약입니다. 반드시 의사 또는 약사와 상담하세요.`)
      setAiLoading(false)
    }, 1200)
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
                <div className={styles.iconWrap}>💊</div>
                <div className={styles.info}>
                  <div className={styles.name}>{m.medicineName}</div>
                  {m.alarmTime && (
                    <div className={styles.ingredient}>⏰ {formatTime(m.alarmTime)} 알람</div>
                  )}
                </div>
              </div>

              <div className={styles.cardActions}>
                <button
                  className={styles.aiBtn}
                  onClick={() => handleAiClick(m)}
                >
                  🤖 Gemini AI 복약 설명
                </button>
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(m.id)}
                  disabled={deletingId === m.id}
                >
                  {deletingId === m.id ? '삭제 중...' : '🗑️ 삭제'}
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
              <h2>🤖 Gemini AI 복약 설명</h2>
              <button onClick={() => setAiModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalMedRow}>
                <span>💊</span>
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
                <div className={styles.aiBox}>
                  <p className={styles.aiText}>{aiText}</p>
                </div>
              )}
              <div className={styles.modalDisclaimer}>
                ⚕️ AI 설명은 참고용이며 의학적 소견을 대체하지 않습니다.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}