// 서버가 보낸 message가 있으면 그대로 보여주고, 없으면 기본 문구
export const getErrorMessage = (err, fallback) => {
  if (!err?.response) return '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  return err.response.data?.message || fallback
}
