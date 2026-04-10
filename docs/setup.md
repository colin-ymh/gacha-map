# 개발 환경 설정

## 요구 사항

- Node.js 20+
- npm
- Supabase 프로젝트
- 네이버 클라우드 플랫폼 계정 (Maps API)

## 설치

```bash
npm install
```

## 환경 변수

`.env` 파일을 생성하고 아래 값을 채워 넣으세요.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Naver Maps
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=<ncp-key-id>
```

| 변수 | 용도 | 공개 여부 |
|------|------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 공개 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라이언트용 익명 키 | 공개 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 관리자 키 (RLS 우회) | **비공개** |
| `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` | 네이버 지도 API 키 | 공개 |

> `SUPABASE_SERVICE_ROLE_KEY`는 절대 클라이언트 코드에서 사용하지 마세요.


## 개발 서버 실행

```bash
npm run dev
```

`http://localhost:3000`에서 확인할 수 있습니다.

## 빌드 및 배포

```bash
npm run build
npm run start
```
