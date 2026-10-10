import client from '../../../api/client'

// POST /user/login  { email, password } → { token, name }
export const login = ({ email, password }) =>
  client.post('/user/login', { email, password }).then(res => res.data)

// POST /user/register  { email, password, name } → 200 (body 없음)
export const register = ({ email, password, name }) =>
  client.post('/user/register', { email, password, name })

// 서버 에러 메시지가 있으면 사용하고, 없으면 기본 문구
export const getErrorMessage = (err, fallback) => {
  if (!err.response) return '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  return err.response.data?.message || fallback
}
