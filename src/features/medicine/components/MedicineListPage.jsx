import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomTab from '../../../components/common/BottomTab'
import MedicineCard from '../../../components/common/MedicineCard'
import styles from './MedicineListPage.module.css'

const DUMMY = [
  { id: 1, name: '타이레놀', ingredient: '아세트아미노펜 500mg', frequency: '하루 3회 식후', hasWarning: true, warningMsg: '아스피린과 함께 복용 시 출혈 위험 증가' },
  { id: 2, name: '아스피린', ingredient: '아세틸살리실산 100mg', frequency: '하루 1회 아침', hasWarning: true, warningMsg: '타이레놀과 함께 복용 시 출혈 위험 증가' },
  { id: 3, name: '오메가3', ingredient: '어유 1000mg', frequency: '하루 1회 저녁', hasWarning: false, warningMsg: '' },
]

export default function MedicineListPage() {
  const navigate = useNavigate()
  const [medicines] = useState(DUMMY)
  const [aiModal, setAiModal] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiText, setAiText] = useState('')
  const warningCnt = medicines.filter(m => m.hasWarning).length

  const handleAiClick = async (medicine) => {
    setAiModal(medicine)
    setAiLoading(true)
    setAiText('')
    // 추후 Gemini API 연동 - 임시 더미
    setTimeout(() => {
      setAiText(`${medicine.name}(${medicine.ingredient})은 ${medicine.frequency} 복용하는 약입니다. ${medicine.hasWarning ? medicine.warningMsg + ' 반드시 의사 또는 약사와 상담하세요.' : '현재 등록된 약과 심각한 상호작용은 없습니다.'}`)
      setAiLoading(false)
    }, 1200)
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>내 약 목록</h1>
        <button className={styles.addBtn} onClick={() => navigate('/medicine/add')}>＋ 약 추가</button>
      </header>

      {warningCnt > 0 && (
        <div className={styles.warningBanner}>
          <span>⚠️</span>
          <div>
            <div className={styles.warningTitle}>상호작용 경고 {warningCnt}건</div>
            <div className={styles.warningDesc}>공공 API가 감지한 약물 충돌이 있습니다</div>
          </div>
        </div>
      )}

      <div className={styles.list}>
        {medicines.length === 0 ? (
          <div className={styles.empty}>
            <span>💊</span>
            <p>등록된 약이 없습니다</p>
            <button className={styles.emptyBtn} onClick={() => navigate('/medicine/add')}>약 추가하기</button>
          </div>
        ) : (
          medicines.map(m => (
            <MedicineCard key={m.id} medicine={m} onAiClick={handleAiClick} />
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
                <span className={styles.modalMedName}>{aiModal.name}</span>
                <span className={styles.modalMedSub}>{aiModal.ingredient}</span>
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