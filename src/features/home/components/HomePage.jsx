import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listMedications, isLoggedIn } from '../../medicine/api/medicationStore'
import BottomTab from '../../../components/common/BottomTab'
import Icon from '../../../components/common/Icon'
import { isPushSupported, enablePush } from '../../notification/push'
import { getUnreadCount } from '../../notification/notificationApi'
import { loadDoneCached, fetchDone, setDone } from '../../medicine/api/doseStore'
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

// "13:00" → "오후 1:00"
const toKoreanTime = (hhmm) => {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}`
}


export default function HomePage() {
  const navigate = useNavigate()
  const loggedIn = isLoggedIn()
  const nickname = localStorage.getItem('nickname') || '사용자'
  const [meds, setMeds] = useState([])
  const [doneSet, setDoneSet] = useState(() => loadDoneCached()) // 오늘 먹은 약 (서버 기준, 캐시로 먼저 그림)
  const [loading, setLoading] = useState(true)
  const [hasUnread, setHasUnread] = useState(false)
  // 처음 한 번만: 로그인했고, 아직 알림 허용 여부를 정하지 않았으면 PC 알림 안내
  const [showPushPrompt, setShowPushPrompt] = useState(() =>
    isLoggedIn() && isPushSupported() &&
    Notification.permission === 'default' &&
    localStorage.getItem('pushPromptDone') !== 'true'
  )

  const closePushPrompt = () => {
    localStorage.setItem('pushPromptDone', 'true')
    setShowPushPrompt(false)
  }

  // 권한 요청은 버튼을 누를 때 (브라우저가 페이지 열자마자 묻는 것을 막는 경우가 많음)
  const handleEnablePush = async () => {
    const result = await enablePush()
    if (!result.ok) alert(result.message)
    closePushPrompt()
  }

  useEffect(() => {
    listMedications()
      .then(data => {
        setMeds(data
          .map(m => ({ id: m.id, name: m.medicineName, time: formatTime(m.alarmTime) }))
          .sort((a, b) => a.time.localeCompare(b.time)))
      })
      .catch(err => console.error('약 목록 불러오기 실패', err))
      .finally(() => setLoading(false))
    fetchDone().then(setDoneSet).catch(() => {})
  }, [])

  // 페이지 포커스될 때마다 안 읽은 알림 확인 (서버 알림 기록 기준)
  useEffect(() => {
    if (!loggedIn) return
    const checkUnread = () => {
      getUnreadCount().then(count => setHasUnread(count > 0)).catch(() => {})
    }
    checkUnread()
    window.addEventListener('focus', checkUnread)
    return () => window.removeEventListener('focus', checkUnread)
  }, [loggedIn])

  // 먹었어요 / 취소: 서버에 저장 (먼저 먹은 약은 알림이 오지 않음)
  const toggleDone = async (id) => {
    const key = String(id)
    const done = !doneSet.has(key)
    const next = new Set(doneSet)
    if (done) next.add(key)
    else next.delete(key)
    setDoneSet(next)
    try {
      await setDone(id, done)
    } catch {
      setDoneSet(prev => {
        const back = new Set(prev)
        if (done) back.delete(key)
        else back.add(key)
        return back
      })
      alert('복용 기록을 저장하지 못했어요. 잠시 후 다시 시도해주세요.')
    }
  }

  const now = new Date()
  const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const isDone = (m) => doneSet.has(String(m.id))
  const doneCnt = meds.filter(isDone).length
  const totalCnt = meds.length
  const pct = totalCnt > 0 ? Math.round(doneCnt / totalCnt * 100) : 0
  // 아직 안 먹은 약 중 지금 이후 가장 빠른 것, 없으면 남은 것 중 첫 번째
  const pending = meds.filter(m => !isDone(m))
  const nextMed = pending.find(m => m.time >= nowStr) || pending[0]

  const status = (m) => {
    if (isDone(m)) return 'done'
    return m.time && m.time < nowStr ? 'missed' : 'upcoming'
  }

  const handleAlarmClick = () => {
    setHasUnread(false)
    navigate('/alarm')
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <div className={styles.logoRow}>
            <span className={styles.logoMark}><Icon name="pill" size={14} strokeWidth={2.4} /></span>
            <span className={styles.logoText}>YakSok</span>
          </div>
          <div className={styles.greeting}>{loggedIn ? `안녕하세요, ${nickname}님` : '안녕하세요!'}</div>
          <div className={styles.date}>
            {now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </div>
        {loggedIn ? (
          <button className={styles.alarmBtn} onClick={handleAlarmClick} aria-label="알림">
            <Icon name={hasUnread ? 'bellDot' : 'bell'} size={24} />
          </button>
        ) : (
          <button className={styles.loginBtn} onClick={() => navigate('/login')}>로그인</button>
        )}
      </header>

      <div className={styles.content}>
        {/* 게스트 안내: 로그인 없이도 쓸 수 있지만, 로그인하면 계정에 저장 */}
        {!loggedIn && (
          <div className={styles.guestBanner}>
            <div className={styles.guestText}>
              <div className={styles.guestTitle}>로그인 없이 사용 중이에요</div>
              <div className={styles.guestDesc}>등록한 약은 이 기기에만 저장돼요. 로그인하면 계정으로 옮겨져요.</div>
            </div>
            <button className={styles.guestBtn} onClick={() => navigate('/login')}>로그인</button>
          </div>
        )}

        {showPushPrompt && (
          <div className={styles.guestBanner}>
            <div className={styles.guestText}>
              <div className={styles.guestTitle}>복약 시간에 PC 알림을 받아볼까요?</div>
              <div className={styles.guestDesc}>앱을 닫아도 Windows 알림 센터로 알려드려요.</div>
            </div>
            <div className={styles.pushBtns}>
              <button className={styles.guestBtn} onClick={handleEnablePush}>알림 켜기</button>
              <button className={styles.laterBtn} onClick={closePushPrompt}>나중에</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className={styles.loading}>불러오는 중...</div>
        ) : totalCnt === 0 ? (
          <>
            {/* 처방전 촬영 카드 */}
            <div className={styles.heroCard}>
              <div className={styles.heroTitle}>처방전 촬영하기</div>
              <div className={styles.heroDesc}>사진 한 장으로 약 정보를 자동 정리해요</div>
              <button
                className={styles.heroBtn}
                onClick={() => navigate('/medicine/add', { state: { mode: 'photo' } })}
              >
                <Icon name="camera" size={16} /> 촬영 시작
              </button>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>오늘 복약 목록</span>
              </div>
              <div className={styles.emptyBox}>
                <span className={styles.emptyIcon}><Icon name="pill" size={22} /></span>
                <div className={styles.emptyTitle}>등록된 약이 없어요</div>
                <div className={styles.emptyDesc}>복용 중인 약을 추가해 보세요</div>
              </div>
              <button className={styles.addOutlineBtn} onClick={() => navigate('/medicine/add')}>
                <Icon name="plus" size={16} /> 약 추가하기
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 다음 복용 카드 */}
            {nextMed ? (
              <div className={styles.heroCard}>
                <div className={styles.heroLabel}>다음 복용 · {toKoreanTime(nextMed.time)}</div>
                <div className={styles.heroTitle}>{nextMed.name}</div>
                <button className={styles.heroBtn} onClick={() => toggleDone(nextMed.id)}>
                  <Icon name="check" size={16} /> 먹었어요
                </button>
              </div>
            ) : (
              <div className={styles.heroCard}>
                <div className={styles.heroLabel}>오늘 복약</div>
                <div className={styles.heroTitle}>오늘 약을 모두 먹었어요!</div>
              </div>
            )}

            {/* 오늘 복약 현황 */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>오늘 복약 현황</span>
                <span className={styles.cardBadge}>{doneCnt} / {totalCnt}</span>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${pct}%` }} />
              </div>
              <span className={styles.pct}>{pct}% 완료</span>
            </div>

            {/* 오늘 복약 목록 */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>오늘 복약 목록</span>
              </div>
              {meds.map(m => {
                const s = status(m)
                return (
                  <div key={m.id} className={styles.medItem} onClick={() => toggleDone(m.id)}>
                    <div className={styles.medInfo}>
                      <div className={`${styles.medName} ${s === 'done' ? styles.medNameDone : ''}`}>{m.name}</div>
                      <div className={styles.medTime}>{toKoreanTime(m.time)}</div>
                    </div>
                    {s === 'done' && (
                      <span className={styles.checkCircle}><Icon name="check" size={14} strokeWidth={3} /></span>
                    )}
                    {s === 'missed' && <span className={styles.missedTag}>놓침</span>}
                    {s === 'upcoming' && <span className={styles.upcomingTag}>예정</span>}
                  </div>
                )
              })}
              <button className={styles.addOutlineBtn} onClick={() => navigate('/medicine/add')}>
                <Icon name="plus" size={16} /> 약 추가하기
              </button>
            </div>
          </>
        )}

        <div className={styles.disclaimer}>
          본 서비스는 의학적 소견을 대체하지 않습니다.<br />반드시 의사 또는 약사와 상담하세요.
        </div>
      </div>

      <div style={{ height: '80px' }} />
      <BottomTab />
    </div>
  )
}
