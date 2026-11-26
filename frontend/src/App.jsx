import { BrowserRouter } from 'react-router-dom'
import Router from './router/index.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Router />
      </div>
    </BrowserRouter>
  )
}