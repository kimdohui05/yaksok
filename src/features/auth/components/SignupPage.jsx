import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { register, getErrorMessage } from '../api/authApi'
import styles from './Auth.module.css'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 백엔드 RegisterDto 검증 규칙과 동일하게 맞춤
const validate = ({ name, email, password, passwordConfirm }) => {
  const errors = {}
  const trimmedName = name.trim()
  if (!trimmedName) errors.name = '이름을 입력해 주세요.'
  else if (trimmedName.length < 3 || trimmedName.length > 5) errors.name = '이름은 3글자 ~ 5글자 사이여야 합니다.'

  if (!email.trim()) errors.email = '이메일을 입력해 주세요.'
  else if (!EMAIL_REGEX.test(email.trim())) errors.email = '올바른 이메일 형식이 아닙니다.'

  if (!password) errors.password = '비밀번호를 입력해 주세요.'
  else if (password.length < 4) errors.password = '비밀번호는 4자 이상이어야 합니다.'

  if (!passwordConfirm) errors.passwordConfirm = '비밀번호를 한 번 더 입력해 주세요.'
  else if (password !== passwordConfirm) errors.passwordConfirm = '비밀번호가 일치하지 않습니다.'

  return errors
}

const fields = [
  { name: 'name', label: '이름', type: 'text', placeholder: '3~5글자', autoComplete: 'name' },
  { name: 'email', label: '이메일', type: 'email', placeholder: 'example@email.com', autoComplete: 'email' },
  { name: 'password', label: '비밀번호', type: 'password', placeholder: '4자 이상', autoComplete: 'new-password' },
  { name: 'passwordConfirm', label: '비밀번호 확인', type: 'password', placeholder: '비밀번호를 다시 입력하세요', autoComplete: 'new-password' },
]

export default function SignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', passwordConfirm: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
    setErrors({ ...errors, [name]: undefined })
    setFormError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)
    try {
      const name = form.name.trim()
      await register({ email: form.email.trim(), password: form.password, name })
      // 로그인 응답에 이름이 없어서 가입 시 입력한 이름을 저장해 둠
      localStorage.setItem('nickname', name)
      alert('가입이 완료되었습니다! 로그인해 주세요.')
      navigate('/login', { replace: true })
    } catch (err) {
      setFormError(getErrorMessage(err, '가입에 실패했습니다. 이미 가입된 이메일인지 확인해 주세요.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>←</button>
        <h1 className={styles.title}>회원가입</h1>
        <div className={styles.headerSpacer} />
      </header>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {fields.map(f => (
          <div key={f.name} className={styles.field}>
            <label className={styles.label} htmlFor={f.name}>{f.label}</label>
            <input
              id={f.name}
              name={f.name}
              type={f.type}
              className={`${styles.input} ${errors[f.name] ? styles.inputError : ''}`}
              placeholder={f.placeholder}
              value={form[f.name]}
              onChange={handleChange}
              autoComplete={f.autoComplete}
            />
            {errors[f.name] && <span className={styles.fieldError}>{errors[f.name]}</span>}
          </div>
        ))}

        {formError && <div className={styles.formError}>{formError}</div>}

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? '가입 중...' : '가입하기'}
        </button>
      </form>

      <div className={styles.switchRow}>
        이미 계정이 있으신가요?
        <button className={styles.switchLink} onClick={() => navigate('/login')}>로그인</button>
      </div>
    </div>
  )
}
