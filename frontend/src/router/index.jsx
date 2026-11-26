import { Routes, Route, Navigate } from 'react-router-dom'
import HomePage from '../features/home/components/HomePage'
import MedicineListPage from '../features/medicine/components/MedicineListPage'
import MedicineAddPage from '../features/medicine/components/MedicineAddPage'
import AlarmPage from '../features/alarm/components/AlarmPage'
import SchedulePage from '../features/schedule/components/SchedulePage'
import LoginPage from '../features/auth/components/LoginPage'
import SignupPage from '../features/auth/components/SignupPage'
import MyPage from '../features/mypage/components/MyPage'

const isLoggedIn = () => !!localStorage.getItem('token')

function PublicRoute({ children }) {
  return isLoggedIn() ? <Navigate to="/home" replace /> : children
}

export default function Router() {
  return (
    <Routes>
      {/* 로그인 전(게스트)에도 약 등록·복용 설정을 쓸 수 있도록 홈부터 시작 */}
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
      {/* 게스트도 사용 가능 (게스트 데이터는 이 기기에 저장, 로그인하면 계정으로 옮김) */}
      <Route path="/home" element={<HomePage />} />
      <Route path="/medicine" element={<MedicineListPage />} />
      <Route path="/medicine/add" element={<MedicineAddPage />} />
      <Route path="/alarm" element={<AlarmPage />} />
      <Route path="/schedule" element={<SchedulePage />} />
      <Route path="/mypage" element={<MyPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}