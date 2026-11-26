# 약속 (YakSok)

처방약 복약 알림 서비스 (졸업작품)

## 폴더 구조

| 폴더 | 내용 | 원래 브랜치 |
|---|---|---|
| `backend/` | Spring Boot 4 (Java 21), MySQL(Docker), JWT, Gemini, 공공데이터 API, 웹 푸시 | `backend` |
| `frontend/` | React (Vite) | `front-A` |

## 실행

### 백엔드
1. IntelliJ 에서 `backend/` 폴더를 프로젝트로 연다 (Gradle 자동 인식)
2. DB 실행: `backend/` 폴더에서 `docker compose up -d`
3. 실행 설정 환경변수: `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
4. `YakSokApplication` 실행 (http://localhost:8080)

### 프론트엔드
1. `frontend/` 폴더에서 `npm install`
2. `frontend/.env` 의 `VITE_API_BASE_URL` 을 백엔드 주소로 설정
3. `npm run dev` (http://localhost:5173)

## 브랜치

- `backend`, `front-A`: 각자 작업
- `develop`: 두 작업을 `backend/`, `frontend/` 폴더로 합쳐서 테스트
- `master`: 테스트를 통과한 최종 버전
