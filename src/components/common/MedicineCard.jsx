import styles from './MedicineCard.module.css'

export default function MedicineCard({ medicine, onAiClick }) {
  const { name, ingredient, frequency, hasWarning, warningMsg } = medicine

  return (
    <div className={`${styles.card} ${hasWarning ? styles.warning : ''}`}>
      <div className={styles.cardTop}>
        <div className={styles.iconWrap}>💊</div>
        <div className={styles.info}>
          <div className={styles.name}>{name}</div>
          <div className={styles.ingredient}>{ingredient}</div>
        </div>
        {hasWarning && <span className={styles.warnBadge}>⚠️</span>}
      </div>

      <div className={styles.frequency}>{frequency}</div>

      {hasWarning && warningMsg && (
        <div className={styles.warningMsg}>
          ⚠️ {warningMsg}
        </div>
      )}

      <button
        className={styles.aiBtn}
        onClick={e => { e.stopPropagation(); onAiClick && onAiClick(medicine) }}
      >
        🤖 Gemini AI 복약 설명 보기
      </button>
    </div>
  )
}