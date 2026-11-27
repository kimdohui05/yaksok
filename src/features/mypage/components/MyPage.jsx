import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomTab from '../../../components/common/BottomTab'
import client from '../../../api/client'
import Icon from '../../../components/common/Icon'
import { findInteractions } from '../../medicine/categories'
import { listMedications, isLoggedIn } from '../../medicine/api/medicationStore'
import { isPushSupported, isPushSubscribed, enablePush, disablePush } from '../../notification/push'
import { getAlarmEnabledCached, cacheAlarmEnabled, saveAlarmEnabled } from '../../notification/notificationApi'
import { loadDoneCached, fetchDone } from '../../medicine/api/doseStore'
import styles from './MyPage.module.css'

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
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24))
}

export default function MyPage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [medicines, setMedicines] = useState([])
  const [alarmOn, setAlarmOn] = useState(getAlarmEnabledCached) // 서버 복약 알림(메일·PC 알림) 받기
  const [alarmBusy, setAlarmBusy] = useState(false)
  const [doneMeds, setDoneMeds] = useState(() => [...loadDoneCached()]) // 오늘 먹은 약 id (서버 기준)
  const [loading, setLoading] = useState(true)
  const [pushOn, setPushOn] = useState(false)       // PC 알림 센터 알림(웹 푸시) 구독 여부
  const [pushBusy, setPushBusy] = useState(false)

  const loggedIn = isLoggedIn()
  const nickname = localStorage.getItem('nickname') || '사용자'
  const prescInfo = getPrescInfo()

  const medCount = medicines.length
  const warningCount = findInteractions(medicines.map(m => m.medicineName)).length
  const pct = medCount > 0 ? Math.round(doneMeds.length / medCount * 100) : 0

  useEffect(() => {
    if (isLoggedIn()) {
      client.get('/api/user/profile')
        .then(res => {
          setProfile(res.data)
          if (typeof res.data?.alarmEnabled === 'boolean') {
            setAlarmOn(res.data.alarmEnabled)
            cacheAlarmEnabled(res.data.alarmEnabled)
          }
        })
        .catch(() => {})
      fetchDone().then(set => setDoneMeds([...set])).catch(() => {})
    }

    listMedications()
      .then(data => setMedicines(data))
      .catch(() => {})
      .finally(() => setLoading(false))

    isPushSubscribed().then(setPushOn).catch(() => {})
  }, [])

  // PC 알림 켜기/끄기 (로그인 + 지원 브라우저에서만)
  const handlePushToggle = async () => {
    if (pushBusy) return
    setPushBusy(true)
    try {
      if (pushOn) {
        await disablePush()
        setPushOn(false)
      } else {
        const result = await enablePush()
        if (result.ok) setPushOn(true)
        else alert(result.message)
      }
    } finally {
      setPushBusy(false)
    }
  }

  // 복약 알림 켜기/끄기: 서버에 저장 (끄면 서버가 메일·PC 알림을 보내지 않음)
  const handleAlarmToggle = async () => {
    if (alarmBusy) return
    const next = !alarmOn
    if (!loggedIn) {
      setAlarmOn(next)
      cacheAlarmEnabled(next)
      return
    }
    setAlarmOn(next)
    setAlarmBusy(true)
    try {
      await saveAlarmEnabled(next)
    } catch {
      setAlarmOn(!next)
      alert('알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setAlarmBusy(false)
    }
  }

  const handleLogout = async () => {
    // 공용 PC에서 다른 사람에게 내 복약 알림이 가지 않도록 구독 해제 (토큰이 있을 때 먼저)
    await disablePush().catch(() => {})
    localStorage.clear()
    navigate('/login', { replace: true })
  }

  const formatTime = (alarmTime) => {
    if (!alarmTime) return '-'
    if (Array.isArray(alarmTime))
      return `${String(alarmTime[0]).padStart(2,'0')}:${String(alarmTime[1]).padStart(2,'0')}`
    return String(alarmTime).substring(0, 5)
  }

  // 처방일수 텍스트 (예: "7일분 · 잔여 3일")
  const prescText = (med) => {
    const key = String(med.id)
    // id 기준 → 없으면 약 이름 기준으로 조회
    const byName = prescInfo.byName[med.medicineName] || {}
    const days = prescInfo.prescDays[key] || byName.days
    if (!days) return null
    const startDate = prescInfo.startDates[key] || byName.startDate
    const remaining = calcRemaining(startDate, days)
    if (remaining === null) return { text: `${days}일분`, level: 'normal' }
    if (remaining < 0) return { text: `${days}일분 · 만료`, level: 'expired' }
    if (remaining <= 3) return { text: `${days}일분 · 잔여 ${remaining}일`, level: 'warning' }
    return { text: `${days}일분 · 잔여 ${remaining}일`, level: 'normal' }
  }

  const levelClass = (level) =>
    level === 'expired' ? styles.prescExpired
      : level === 'warning' ? styles.prescWarning : ''

  // 같은 약을 여러 시간대로 등록한 경우 약 이름 기준 한 번만 표시
  const prescList = (() => {
    const seen = new Set()
    const list = []
    medicines.forEach(m => {
      if (seen.has(m.medicineName)) return
      const info = prescText(m)
      if (!info) return
      seen.add(m.medicineName)
      list.push({ id: m.id, name: m.medicineName, ...info })
    })
    return list
  })()

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>내 정보</h1>
      </header>

      {/* 프로필 카드 (로그인 전에는 로그인 안내) */}
      {!loggedIn ? (
        <div className={styles.profileCard}>
          <div className={styles.avatar}><Icon name="profile" size={26} /></div>
          <div className={styles.profileInfo}>
            <div className={styles.guestTitle}>로그인 없이 사용 중</div>
            <div className={styles.email}>등록한 약은 이 기기에만 저장돼요</div>
            <div className={styles.guestBtns}>
              <button className={styles.guestPrimary} onClick={() => navigate('/login')}>로그인</button>
              <button className={styles.guestSecondary} onClick={() => navigate('/signup')}>회원가입</button>
            </div>
          </div>
        </div>
      ) : (
      <div className={styles.profileCard}>
        <div className={styles.avatar}>{nickname.charAt(0).toUpperCase()}</div>
        <div className={styles.profileInfo}>
          <div className={styles.name}>{profile?.name || nickname}</div>
          {profile?.email && <div className={styles.email}>{profile.email}</div>}
        </div>
      </div>
      )}

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
              <div className={styles.statValue}>{medCount}개</div>
              <div className={styles.statLabel}>등록된 약</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>{pct}%</div>
              <div className={styles.statLabel}>오늘 완료율</div>
            </div>
            <div
              className={`${styles.statItem} ${warningCount > 0 ? styles.statWarning : ''}`}
              onClick={() => warningCount > 0 && navigate('/medicine')}
            >
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
                <span className={styles.infoLabel}>{m.medicineName}</span>
                <span className={styles.infoValue}>
                  {formatTime(m.alarmTime)}
                  {prescText(m) && ` · ${prescText(m).text}`}
                </span>
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
              전체 약 목록 보기 ›
            </button>
          </div>
        </div>
      )}

      {/* 처방전 정보 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>처방전 정보</div>
        <div className={styles.infoCard}>
          {prescList.length === 0 ? (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>등록된 처방 정보</span>
              <span className={styles.unregistered}>미등록</span>
            </div>
          ) : (
            prescList.map(p => (
              <div key={p.id} className={styles.infoRow}>
                <span className={styles.infoLabel}>{p.name}</span>
                <span className={`${styles.infoValue} ${levelClass(p.level)}`}>{p.text}</span>
              </div>
            ))
          )}
          <button
            className={styles.outlineBtn}
            onClick={() => navigate('/medicine/add', { state: { mode: 'photo' } })}
          >
            <Icon name="camera" size={16} /> 처방전 등록하기
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
                {alarmOn ? '복약 시간마다 알림을 받고 있어요' : '알림이 꺼져 있어요'}
              </div>
            </div>
            <div
              className={`${styles.toggle} ${alarmOn ? styles.toggleOn : ''}`}
              onClick={handleAlarmToggle}
            >
              <div className={styles.toggleThumb} />
            </div>
          </div>

          {/* PC 알림 센터 알림 (웹 푸시): 앱을 닫아도 복약 시간에 Windows 알림으로 받기 */}
          <div className={styles.settingRow}>
            <div>
              <div className={styles.settingLabel}>PC 알림 센터 알림</div>
              <div className={styles.settingDesc}>
                {!loggedIn
                  ? '로그인하면 사용할 수 있어요'
                  : !isPushSupported()
                    ? '이 브라우저 또는 주소(HTTPS 아님)에서는 쓸 수 없어요'
                    : pushOn
                      ? '앱을 닫아도 복약 시간에 알림이 와요'
                      : '앱을 닫아도 알림을 받으려면 켜 주세요'}
              </div>
            </div>
            <div
              className={`${styles.toggle} ${pushOn ? styles.toggleOn : ''} ${(!loggedIn || !isPushSupported() || pushBusy) ? styles.toggleDisabled : ''}`}
              onClick={() => loggedIn && isPushSupported() && handlePushToggle()}
              role="switch"
              aria-checked={pushOn}
            >
              <div className={styles.toggleThumb} />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.disclaimer}>
        본 서비스는 의학적 소견을 대체하지 않습니다. 반드시 의사 또는 약사와 상담하세요.
      </div>

      {loggedIn && (
        <div className={styles.bottomSection}>
          <button className={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
        </div>
      )}

      <div style={{ height: '80px' }} />
      <BottomTab />
    </div>
  )
}