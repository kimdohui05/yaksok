import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  headers: {
    'ngrok-skip-browser-warning': 'true'
  }
})

client.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  res => res,
  err => {
    // 로그인/회원가입 요청 실패는 화면에서 직접 처리
    const isAuthRequest = err.config?.url?.startsWith('/user/')
    if (err.response?.status === 401 && !isAuthRequest) {
      localStorage.clear()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default client