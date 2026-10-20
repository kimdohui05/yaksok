import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../../api/client'
import BottomTab from '../../../components/common/BottomTab'
import styles from './HomePage.module.css'

const formatTime = (alarmTime) => {
  if (!alarmTime) return ''
  if (Array.isArray(alarmTime)) {
    const h = String(alarmTime[0]).padStart(2, '0')
    const m = String(alarmTime[1]).padStart(2, '0')
    return `${h}:${m}`
  }
  return String(alarmTime).substring(0, 5)
}

export default function HomePage() {
  const navigate = useNavigate()
  const nickname = localStorage.getItem('nickname') || '사용자'
  const [todayMeds, setTodayMeds] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasUnread, setHasUnread] = useState(false)

  // API에서 약 목록 불러오기
  useEffect(() => {
    client.get('/medications')
      .then(res => {
        // done 상태는 프론트에서만 관리 (세션 내)
        setTodayMeds(res.data.map(m => ({
          id: m.id,
          name: m.medicineName,
          time: formatTime(m.alarmTime),
          done: false,
        })))
      })
      .catch(err => console.error('약 목록 불러오기 실패', err))
      .finally(() => setLoading(false))
  }, [])

  // 페이지 포커스될 때마다 unreadAlarm 체크
  useEffect(() => {
    const checkUnread = () => {
      setHasUnread(localStorage.getItem('unreadAlarm') === 'true')
    }
    checkUnread()
    window.addEventListener('focus', checkUnread)
    return () => window.removeEventListener('focus', checkUnread)
  }, [])

  const doneCnt = todayMeds.filter(m => m.done).length
  const totalCnt = todayMeds.length
  const pct = totalCnt > 0 ? Math.round(doneCnt / totalCnt * 100) : 0
  const toggleDone = (id) => setTodayMeds(prev => prev.map(m => m.id === id ? { ...m, done: !m.done } : m))
  const now = new Date()
  const nextMed = todayMeds.find(m => !m.done)

  const handleAlarmClick = () => {
    localStorage.setItem('unreadAlarm', 'false')
    setHasUnread(false)
    navigate('/alarm')
  }

  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <header className={styles.header}>
        <div>
          <div className={styles.logoRow}>
            <span className={styles.logoText}>YakSok</span>
          </div>
          <div className={styles.greeting}>안녕하세요, {nickname}님 </div>
          <div className={styles.date}>
            {now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </div>
        <button className={styles.alarmBtn} onClick={handleAlarmClick}>
          🔔
          {hasUnread && <span className={styles.alarmDot} />}
        </button>
      </header>

      <div className={styles.content}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-sub)' }}>
            불러오는 중...
          </div>
        ) : (
          <>
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
                {pct === 100 && totalCnt > 0 && <span className={styles.allDone}> 오늘 복약 완료!</span>}
              </div>
            </div>

            {/* 다음 복약 카드 */}
            {nextMed && (
              <div className={styles.nextCard}>
                <div className={styles.nextLabel}>다음 복약 시간</div>
                <div className={styles.nextRow}>
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
              {todayMeds.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-sub)', fontSize: '13px' }}>
                  등록된 약이 없어요. 약을 추가해보세요!
                </div>
              ) : (
                todayMeds.map(m => (
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
                ))
              )}
            </div>

            {/* 면책 고지 */}
            <div className={styles.disclaimer}>
              ⚕️ 본 서비스는 의학적 소견을 대체하지 않습니다. 반드시 의사 또는 약사와 상담하세요.
            </div>
          </>
        )}
      </div>

      <div style={{ height: '80px' }} />
      <BottomTab />
    </div>
  )
}