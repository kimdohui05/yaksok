import { useNavigate, useLocation } from 'react-router-dom'
import Icon from './Icon'
import styles from './BottomTab.module.css'

const tabs = [
  { path: '/home', icon: 'home', label: '홈' },
  { path: '/medicine', icon: 'pill', label: '약 목록' },
  { path: '/medicine/add', icon: 'plus', label: '약 추가', center: true },
  { path: '/schedule', icon: 'calendar', label: '일정' },
  { path: '/mypage', icon: 'profile', label: '내 정보' },
]

export default function BottomTab() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav className={styles.tabBar}>
      {tabs.map(tab => {
        const active = location.pathname === tab.path
        return (
          <button
            key={tab.path}
            type="button"
            className={`${styles.tabItem} ${tab.center ? styles.centerItem : ''} ${active ? styles.active : ''}`}
            onClick={() => navigate(tab.path)}
          >
            {tab.center ? (
              <span className={styles.fab}><Icon name="plus" size={24} strokeWidth={2.4} /></span>
            ) : (
              <Icon name={tab.icon} size={22} className={styles.tabIcon} />
            )}
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
