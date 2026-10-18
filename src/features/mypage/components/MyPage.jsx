import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomTab from '../../../components/common/BottomTab'
import client from '../../../api/client'
import styles from './MyPage.module.css'

export default function MyPage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [medicines, setMedicines] = useState([])
  const [alarmOn, setAlarmOn] = useState(
    localStorage.getItem('alarmEnabled') !== 'false'
  )
  const [loading, setLoading] = useState(true)

  const nickname = localStorage.getItem('nickname') || '사용자'
  const nextVisit = localStorage.getItem('nextVisit') || null

  const medCount = medicines.length
  const warningCount = 0 // 백엔드 미지원
  const doneMeds = (() => {
    try { return JSON.parse(localStorage.getItem('doneMeds') || '[]') }
    catch { return [] }
  })()
  const pct = medCount > 0 ? Math.round(doneMeds.length / medCount * 100) : 0

  useEffect(() => {
    client.get('/api/user/profile')
      .then(res => setProfile(res.data))
      .catch(() => {})

    client.get('/medications')
      .then(res => setMedicines(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleAlarmToggle = async () => {
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

  const formatTime = (alarmTime) => {
    if (!alarmTime) return '-'
    if (Array.isArray(alarmTime))
      return `${String(alarmTime[0]).padStart(2,'0')}:${String(alarmTime[1]).padStart(2,'0')}`
    return String(alarmTime).substring(0, 5)
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>내 정보</h1>
      </header>

      {/* 프로필 카드 */}
      <div className={styles.profileCard}>
        <div className={styles.avatar}>{nickname.charAt(0).toUpperCase()}</div>
        <div className={styles.profileInfo}>
          <div className={styles.name}>{profile?.name || nickname}</div>
          <div className={styles.email}>{profile?.email || '-'}</div>
        </div>
      </div>

      {/* 복약 현황 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>복약 현황</div>
        {loading ? (
          <div className={styles.infoCard} style={{ textAlign: 'center', color: 'var(--text-sub)', fontSize: '13px', padding: '20px' }}>
            불러오는 중...
          </div>
        ) : (
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
            <div className={styles.statItem}>
              <div className={styles.statIcon}>⚠️</div>
              <div className={styles.statValue}>{warningCount}건</div>
              <div className={styles.statLabel}>상호작용 경고</div>
            </div>
          </div>
        )}
      </div>

      {/* 등록된 약 미리보기 */}
      {!loading && medCount > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>등록된 약</div>
          <div className={styles.infoCard}>
            {medicines.slice(0, 3).map(m => (
              <div key={m.id} className={styles.infoRow}>
                <span className={styles.infoLabel}>💊 {m.medicineName}</span>
                <span className={styles.infoValue}>{formatTime(m.alarmTime)}</span>
              </div>
            ))}
            {medCount > 3 && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel} style={{ color: 'var(--text-sub)' }}>
                  외 {medCount - 3}개 더 있어요
                </span>
              </div>
            )}
            <button className={styles.linkBtn} onClick={() => navigate('/medicine')}>
              전체 약 목록 보기 →
            </button>
          </div>
        </div>
      )}

      {/* 처방전 정보 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>처방전 정보</div>
        <div className={styles.infoCard}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>🏥 다음 약국 방문 예정일</span>
            <span className={styles.infoValue}>{nextVisit || '미등록'}</span>
          </div>
          <button className={styles.linkBtn} onClick={() => navigate('/medicine/add')}>
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

      <div className={styles.disclaimer}>
        ⚕️ 본 서비스는 의학적 소견을 대체하지 않습니다. 반드시 의사 또는 약사와 상담하세요.
      </div>

      <div className={styles.bottomSection}>
        <button className={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
      </div>

      <div style={{ height: '80px' }} />
      <BottomTab />
    </div>
  )
}