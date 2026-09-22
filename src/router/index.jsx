import { Routes, Route, Navigate } from 'react-router-dom'
import HomePage from '../features/home/components/HomePage'
import MedicineListPage from '../features/medicine/components/MedicineListPage'
import MedicineAddPage from '../features/medicine/components/MedicineAddPage'
import AlarmPage from '../features/alarm/components/AlarmPage'
import SchedulePage from '../features/schedule/components/SchedulePage'

export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/medicine" element={<MedicineListPage />} />
      <Route path="/medicine/add" element={<MedicineAddPage />} />
      <Route path="/alarm" element={<AlarmPage />} />
      <Route path="/schedule" element={<SchedulePage />} />
      <Route path="*" element={<Navigate to="/home" />} />
    </Routes>
  )
}