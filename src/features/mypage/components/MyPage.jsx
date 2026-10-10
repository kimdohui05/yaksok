import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomTab from '../../../components/common/BottomTab'
import client from '../../../api/client'
import styles from './MyPage.module.css'

const DUMMY_MEDICINES = [
  { id: 1, name: '타이레놀', dose: '500mg', hasWarning: true },
  { id: 2, name: '아스피린', dose: '100mg', hasWarning: true },
  { id: 3, name: '오메가3', dose: '', hasWarning: false },
]

const DUMMY_TODAY = [
  { done: true }, { done: false }, { done: false }
]

// 'YYYY-MM-DD' → 오늘부터 며칠 남았는지
const getDday = (dateStr) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${dateStr}T00:00:00`)
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

// 브라우저 알림 권한 요청 (알림 페이지와 동일)
const requestPermission = async () => {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export default function MyPage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  // 알림 페이지와 같은 localStorage 값('alarmEnabled')을 공유
  const [alarmOn, setAlarmOn] = useState(
    localStorage.getItem('alarmEnabled') !== 'false'
  )

  const nickname = localStorage.getItem('nickname') || '사용자'

  const warningCount = DUMMY_MEDICINES.filter(m => m.hasWarning).length
  const doneCnt = DUMMY_TODAY.filter(m => m.done).length
  const totalCnt = DUMMY_TODAY.length
  const pct = totalCnt > 0 ? Math.round(doneCnt / totalCnt * 100) : 0
  const nextVisit = localStorage.getItem('nextVisit') || null
  const dday = nextVisit ? getDday(nextVisit) : null

  useEffect(() => {
    client.get('/api/user/profile')
      .then(res => setProfile(res.data))
      .catch(() => {})
  }, [])

  const toggleAlarm = async () => {
    if (!alarmOn) {
      const granted = await requestPermission()
      if (!granted) {
        alert('브라우저 설정에서 알림을 허용해주세요.')
        return
      }
    }
    const next = !alarmOn
    setAlarmOn(next)
    localStorage.setItem('alarmEnabled', String(next))
  }

  const handleLogout = () => {
    if (!window.confirm('로그아웃 하시겠어요?')) return
    localStorage.clear()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.container}>
      {/* 상단 흰 영역 (헤더 + 복약 카드) */}
      <div className={styles.top}>
        <header className={styles.header}>
          <h1 className={styles.title}>내 정보</h1>
          {/* TODO: 편집 화면(건강 정보 등) 만들면 연결 */}
          <button className={styles.editBtn}>편집</button>
        </header>

        <div className={styles.medCard}>
          <div className={styles.medCardLabel}>MY MEDICATION CARD</div>
          <div className={styles.medCardName}>{profile?.name || nickname}</div>
          <div className={styles.medCardSub}>복용 중인 약 {DUMMY_MEDICINES.length}</div>
          <div className={styles.medChips}>
            {DUMMY_MEDICINES.map(m => (
              <span key={m.id} className={styles.medChip}>
                {m.name}{m.dose && ` ${m.dose}`}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.body}>
        {/* 오늘 완료율 / 상호작용 경고 */}
        <div className={styles.statGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>오늘 완료율</div>
            <div className={styles.statValue}>{pct}%</div>
            <div className={styles.progress}>
              <div className={styles.progressFill} style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className={`${styles.statCard} ${warningCount > 0 ? styles.statWarning : ''}`}>
            <div className={styles.statLabel}>상호작용 경고</div>
            <div className={styles.statValue}>{warningCount}건</div>
            {warningCount > 0 && (
              <button className={styles.warningLink} onClick={() => navigate('/medicine')}>
                설명 보기 →
              </button>
            )}
          </div>
        </div>

        {/* 다음 약국 방문일 */}
        <div className={styles.card}>
          <div className={styles.visitRow}>
            <div className={`${styles.ddayBox} ${dday === null ? styles.ddayEmpty : ''}`}>
              <span className={styles.ddayPrefix}>D-</span>
              <span className={styles.ddayNum}>{dday === null ? '?' : Math.max(dday, 0)}</span>
            </div>
            <div className={styles.visitInfo}>
              <div className={styles.visitTitle}>다음 약국 방문일</div>
              <div className={styles.visitDesc}>
                {nextVisit
                  ? `${nextVisit.replaceAll('-', '.')} 방문 예정`
                  : '처방전을 등록하면 약 떨어지기 전에 알려드려요'}
              </div>
            </div>
            <button className={styles.registerBtn} onClick={() => navigate('/medicine/add')}>
              등록
            </button>
          </div>
        </div>

        {/* 복약 알림 + 로그아웃 */}
        <div className={styles.card}>
          <div className={styles.settingRow}>
            <div>
              <div className={styles.settingLabel}>복약 알림</div>
              <div className={styles.settingDesc}>복약 시간에 브라우저 알림을 받습니다</div>
            </div>
            <button
              className={`${styles.toggle} ${alarmOn ? styles.toggleOn : ''}`}
              onClick={toggleAlarm}
              aria-label="복약 알림 켜기/끄기"
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>
          <div className={styles.divider} />
          <button className={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
        </div>

        <div className={styles.disclaimer}>
          본 서비스는 의학적 소견을 대체하지 않습니다. 반드시 의사 또는 약사와 상담하세요.
        </div>
      </div>

      <div style={{ height: '80px' }} />
      <BottomTab />
    </div>
  )
}
