import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, getErrorMessage } from '../api/authApi'
import styles from './Auth.module.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email.trim() || !form.password) {
      setError('이메일과 비밀번호를 입력해 주세요.')
      return
    }

    setLoading(true)
    try {
      const { token, name } = await login({ email: form.email.trim(), password: form.password })
      localStorage.setItem('token', token)
      if (name) localStorage.setItem('nickname', name)
      navigate('/home', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, '이메일 또는 비밀번호가 올바르지 않습니다.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      {/* 로고 */}
      <div className={styles.brand}>
        <div className={styles.logo}>💊</div>
        <div className={styles.logoText}>약속</div>
        <div className={styles.tagline}>복약 관리를 시작해 보세요</div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">이메일</label>
          <input
            id="email"
            name="email"
            type="email"
            className={styles.input}
            placeholder="example@email.com"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">비밀번호</label>
          <input
            id="password"
            name="password"
            type="password"
            className={styles.input}
            placeholder="비밀번호를 입력하세요"
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
          />
        </div>

        {error && <div className={styles.formError}>{error}</div>}

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>

      <div className={styles.switchRow}>
        아직 계정이 없으신가요?
        <button className={styles.switchLink} onClick={() => navigate('/signup')}>회원가입</button>
      </div>
    </div>
  )
}
