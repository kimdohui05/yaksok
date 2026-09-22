import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomTab from '../../../components/common/BottomTab'
import styles from './HomePage.module.css'

export default function HomePage() {
  const navigate = useNavigate()
  const nickname = localStorage.getItem('nickname') || '사용자'
  const [todayMeds, setTodayMeds] = useState([
    { id: 1, name: '타이레놀', time: '08:00', done: true },
    { id: 2, name: '아스피린', time: '12:00', done: false },
    { id: 3, name: '오메가3', time: '18:00', done: false },
  ])
  const [warnings] = useState([
    { id: 1, msg: '타이레놀과 아스피린 상호작용 주의' }
  ])

  const doneCnt = todayMeds.filter(m => m.done).length
  const totalCnt = todayMeds.length
  const pct = totalCnt > 0 ? Math.round(doneCnt / totalCnt * 100) : 0
  const toggleDone = (id) => setTodayMeds(prev => prev.map(m => m.id === id ? { ...m, done: !m.done } : m))
  const now = new Date()
  const nextMed = todayMeds.find(m => !m.done)

  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <header className={styles.header}>
        <div>
          <div className={styles.logoRow}>
            <span className={styles.logo}>💊</span>
            <span className={styles.logoText}>약속</span>
          </div>
          <div className={styles.greeting}>안녕하세요, {nickname}님 👋</div>
          <div className={styles.date}>
            {now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </div>
        <button className={styles.alarmBtn} onClick={() => navigate('/alarm')}>
          🔔
          {warnings.length > 0 && <span className={styles.alarmDot} />}
        </button>
      </header>

      {/* 상호작용 경고 배너 */}
      {warnings.length > 0 && (
        <div className={styles.warningBanner} onClick={() => navigate('/medicine')}>
          <span className={styles.warningIcon}>⚠️</span>
          <div>
            <div className={styles.warningTitle}>상호작용 경고 {warnings.length}건 감지</div>
            <div className={styles.warningDesc}>눌러서 확인하기 →</div>
          </div>
        </div>
      )}

      <div className={styles.content}>
        {/* 오늘 복약 현황 카드 */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>오늘 복약 현황</span>
            <span className={styles.cardBadge}>{doneCnt}/{totalCnt}</span>
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
          <div className={styles.pctRow}>
            <span className={styles.pct}>{pct}% 완료</span>
            {pct === 100 && <span className={styles.allDone}>🎉 오늘 복약 완료!</span>}
          </div>
        </div>

        {/* 다음 복약 카드 */}
        {nextMed && (
          <div className={styles.nextCard}>
            <div className={styles.nextLabel}>다음 복약 시간</div>
            <div className={styles.nextRow}>
              <span className={styles.nextIcon}>💊</span>
              <div>
                <div className={styles.nextName}>{nextMed.name}</div>
                <div className={styles.nextTime}>{nextMed.time}</div>
              </div>
            </div>
          </div>
        )}

        {/* 오늘 복약 목록 */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>오늘 복약 목록</span>
          </div>
          {todayMeds.map(m => (
            <div key={m.id} className={styles.medItem} onClick={() => toggleDone(m.id)}>
              <div className={`${styles.check} ${m.done ? styles.checked : ''}`}>
                {m.done && '✓'}
              </div>
              <div className={styles.medInfo}>
                <div className={styles.medName}
                  style={{
                    textDecoration: m.done ? 'line-through' : 'none',
                    color: m.done ? 'var(--text-sub)' : 'var(--text)'
                  }}>
                  {m.name}
                </div>
                <div className={styles.medTime}>{m.time}</div>
              </div>
              {m.done && <span className={styles.doneTag}>완료</span>}
            </div>
          ))}
        </div>

        {/* 면책 고지 */}
        <div className={styles.disclaimer}>
          ⚕️ 본 서비스는 의학적 소견을 대체하지 않습니다. 반드시 의사 또는 약사와 상담하세요.
        </div>
      </div>

      <div style={{ height: '80px' }} />
      <BottomTab />
    </div>
  )
}