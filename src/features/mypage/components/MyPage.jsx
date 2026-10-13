import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomTab from '../../../components/common/BottomTab'
import client from '../../../api/client'
import styles from './MyPage.module.css'

const DUMMY_MEDICINES = [
  { id: 1, name: '타이레놀', hasWarning: true },
  { id: 2, name: '아스피린', hasWarning: true },
  { id: 3, name: '오메가3', hasWarning: false },
]

const DUMMY_TODAY = [
  { done: true }, { done: false }, { done: false }
]

export default function MyPage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  // alarmEnabled: localStorage와 동기화
  const [alarmOn, setAlarmOn] = useState(
    localStorage.getItem('alarmEnabled') !== 'false'
  )
  const [loading, setLoading] = useState(true)

  const nickname = localStorage.getItem('nickname') || '사용자'

  const medCount = DUMMY_MEDICINES.length
  const warningCount = DUMMY_MEDICINES.filter(m => m.hasWarning).length
  const doneCnt = DUMMY_TODAY.filter(m => m.done).length
  const totalCnt = DUMMY_TODAY.length
  const pct = totalCnt > 0 ? Math.round(doneCnt / totalCnt * 100) : 0
  const nextVisit = localStorage.getItem('nextVisit') || null

  useEffect(() => {
    client.get('/api/user/profile')
      .then(res => setProfile(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleAlarmToggle = async () => {
    // 알림 켤 때 권한 요청
    if (!alarmOn) {
      if ('Notification' in window && Notification.permission === 'default') {
        const result = await Notification.requestPermission()
        if (result !== 'granted') {
          alert('브라우저 설정에서 알림을 허용해주세요.')
          return
        }
      }
    }
    const next = !alarmOn
    setAlarmOn(next)
    localStorage.setItem('alarmEnabled', String(next))
  }

  const handleLogout = () => {
    localStorage.clear()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>내 정보</h1>
      </header>

      {/* 프로필 카드 */}
      <div className={styles.profileCard}>
        <div className={styles.avatar}>
          {nickname.charAt(0).toUpperCase()}
        </div>
        <div className={styles.profileInfo}>
          <div className={styles.name}>{profile?.name || nickname}</div>
          <div className={styles.email}>{profile?.email || '-'}</div>
        </div>
      </div>

      {/* 복약 현황 요약 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>복약 현황</div>
        <div className={styles.statGrid}>
          <div className={styles.statItem}>
            <div className={styles.statIcon}>💊</div>
            <div className={styles.statValue}>{medCount}개</div>
            <div className={styles.statLabel}>등록된 약</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statIcon}>📊</div>
            <div className={styles.statValue}>{pct}%</div>
            <div className={styles.statLabel}>오늘 완료율</div>
          </div>
          <div className={`${styles.statItem} ${warningCount > 0 ? styles.statWarning : ''}`}>
            <div className={styles.statIcon}>⚠️</div>
            <div className={styles.statValue}>{warningCount}건</div>
            <div className={styles.statLabel}>상호작용 경고</div>
          </div>
        </div>
      </div>

      {/* 처방전 정보 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>처방전 정보</div>
        <div className={styles.infoCard}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>🏥 다음 약국 방문 예정일</span>
            <span className={styles.infoValue}>
              {nextVisit || '미등록'}
            </span>
          </div>
          <button
            className={styles.linkBtn}
            onClick={() => navigate('/medicine/add')}
          >
            처방전 등록하기 →
          </button>
        </div>
      </div>

      {/* 앱 설정 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>앱 설정</div>
        <div className={styles.infoCard}>
          <div className={styles.settingRow}>
            <div>
              <div className={styles.settingLabel}>복약 알림</div>
              <div className={styles.settingDesc}>
                {alarmOn ? '✅ 복약 시간마다 알림을 받고 있어요' : '🔕 알림이 꺼져 있어요'}
              </div>
            </div>
            <div
              className={`${styles.toggle} ${alarmOn ? styles.toggleOn : ''}`}
              onClick={handleAlarmToggle}
            >
              <div className={styles.toggleThumb} />
            </div>
          </div>
        </div>
      </div>

      {/* 면책 고지 */}
      <div className={styles.disclaimer}>
        ⚕️ 본 서비스는 의학적 소견을 대체하지 않습니다. 반드시 의사 또는 약사와 상담하세요.
      </div>

      {/* 로그아웃 */}
      <div className={styles.bottomSection}>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          로그아웃
        </button>
      </div>

      <div style={{ height: '80px' }} />
      <BottomTab />
    </div>
  )
}