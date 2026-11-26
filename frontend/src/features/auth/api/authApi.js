import client from '../../../api/client'

// POST /user/login  { email, password } → { token }
export const login = ({ email, password }) =>
  client.post('/user/login', { email, password }).then(res => res.data)

// POST /user/register  { email, password, name } → 200 (body 없음)
export const register = ({ email, password, name }) =>
  client.post('/user/register', { email, password, name })

// 서버 에러 메시지가 있으면 사용하고, 없으면 기본 문구 (공통 함수 재사용)
export { getErrorMessage } from '../../../api/errorMessage'
