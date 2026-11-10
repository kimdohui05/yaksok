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
      localStorage.setItem('nickname', name)
      navigate('/home', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, '이메일 또는 비밀번호가 올바르지 않습니다.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      {/* 로고 영역 */}
      <div className={styles.brand}>
        <div className={styles.logo}>💊</div>
        <div className={styles.logoText}>약속</div>
        <p className={styles.tagline}>나만의 복약 도우미</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label}>이메일</label>
          <input
            className={styles.input}
            type="email"
            name="email"
            placeholder="이메일 입력"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>비밀번호</label>
          <input
            className={styles.input}
            type="password"
            name="password"
            placeholder="비밀번호 입력"
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
          />
        </div>

        {error && <div className={styles.formError}>{error}</div>}

        <button
          className={styles.submitBtn}
          type="submit"
          disabled={loading}
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>

      <div className={styles.switchRow}>
        계정이 없으신가요?
        <button
          className={styles.switchLink}
          onClick={() => navigate('/signup')}
        >
          회원가입
        </button>
      </div>
    </div>
  )
}