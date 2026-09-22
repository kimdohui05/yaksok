import { useNavigate, useLocation } from 'react-router-dom'
import styles from './BottomTab.module.css'

const tabs = [
  { path: '/home', icon: '🏠', label: '홈' },
  { path: '/medicine', icon: '💊', label: '약 목록' },
  { path: '/medicine/add', icon: '➕', label: '약 추가' },
  { path: '/alarm', icon: '🔔', label: '알림' },
  { path: '/schedule', icon: '📅', label: '일정' },
]

export default function BottomTab() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav className={styles.tabBar}>
      {tabs.map(tab => (
        <div
          key={tab.path}
          className={`${styles.tabItem} ${location.pathname === tab.path ? styles.active : ''}`}
          onClick={() => navigate(tab.path)}
        >
          <span className={styles.tabIcon}>{tab.icon}</span>
          <span className={styles.tabLabel}>{tab.label}</span>
        </div>
      ))}
    </nav>
  )
}