import { Routes, Route, Navigate } from 'react-router-dom'
import HomePage from '../features/home/components/HomePage'
import MedicineListPage from '../features/medicine/components/MedicineListPage'
import MedicineAddPage from '../features/medicine/components/MedicineAddPage'
import AlarmPage from '../features/alarm/components/AlarmPage'
import SchedulePage from '../features/schedule/components/SchedulePage'
import LoginPage from '../features/auth/components/LoginPage'
import SignupPage from '../features/auth/components/SignupPage'

const isLoggedIn = () => !!localStorage.getItem('token')

// 로그인해야 볼 수 있는 화면
function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />
}

// 로그인하면 볼 필요 없는 화면 (로그인/회원가입)
function PublicRoute({ children }) {
  return isLoggedIn() ? <Navigate to="/home" replace /> : children
}

export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={isLoggedIn() ? '/home' : '/login'} replace />} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
      <Route path="/home" element={<PrivateRoute><HomePage /></PrivateRoute>} />
      <Route path="/medicine" element={<PrivateRoute><MedicineListPage /></PrivateRoute>} />
      <Route path="/medicine/add" element={<PrivateRoute><MedicineAddPage /></PrivateRoute>} />
      <Route path="/alarm" element={<PrivateRoute><AlarmPage /></PrivateRoute>} />
      <Route path="/schedule" element={<PrivateRoute><SchedulePage /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
