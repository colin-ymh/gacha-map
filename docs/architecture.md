# 아키텍처

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 4 |
| 백엔드 | Supabase (PostgreSQL + Auth) |
| 지도 | 네이버 Maps JS API v3 |
| 언어 | TypeScript 5 |

## 프로젝트 구조

```
src/
├── app/
│   ├── layout.tsx          # 루트 레이아웃 (Naver Maps 스크립트 로드)
│   ├── page.tsx            # 홈 (서버 컴포넌트, 지도 뷰)
│   ├── MapClient.tsx       # 홈 클라이언트 컴포넌트 (지도 + 사이드바)
│   ├── search/page.tsx     # 검색
│   ├── shop/[id]/page.tsx  # 샵 상세
│   ├── wishlist/page.tsx   # 찜 목록
│   ├── report/page.tsx     # 제보 폼
│   └── admin/              # 관리자 (인증 필요)
│       ├── layout.tsx
│       ├── page.tsx        # 대시보드
│       ├── shops/          # 샵 승인/거절
│       ├── reports/        # 제보 처리
│       ├── duplicates/     # 중복 후보
│       └── logs/           # 로그 (예정)
├── components/
│   ├── common/Header.tsx
│   ├── map/NaverMap.tsx
│   └── shop/ShopCard.tsx
├── lib/supabase/
│   ├── client.ts           # 브라우저 클라이언트
│   ├── server.ts           # 서버 클라이언트 + 관리자 클라이언트
│   └── middleware.ts       # 세션 갱신 + /admin 인증 가드
├── types/index.ts
└── proxy.ts                # Next.js 16 Proxy (구 Middleware)

supabase/
└── schema.sql              # 테이블, RLS, 인덱스 정의
```

## 데이터 흐름

```
요청
 │
 ├─ [proxy.ts] 세션 갱신 → /admin 미인증 시 /login 리다이렉트
 │
 ├─ [서버 컴포넌트] Supabase 쿼리 (쿠키 기반 세션)
 │     └─ RLS가 approved 샵만 반환
 │
 └─ [클라이언트 컴포넌트] props로 데이터 수신
       ├─ NaverMap: 마커 렌더링
       ├─ ShopCard: 목록 렌더링
       └─ 폼/버튼: 브라우저 클라이언트로 Supabase 직접 호출
```

## 서버 vs 클라이언트 컴포넌트

| 파일 | 종류 | 이유 |
|------|------|------|
| `page.tsx` (홈) | 서버 | 초기 데이터 fetch |
| `MapClient.tsx` | 클라이언트 | `useState`, `window.naver` |
| `NaverMap.tsx` | 클라이언트 | 브라우저 DOM, Naver Maps SDK |
| `search/page.tsx` | 서버 | URL 파라미터 기반 쿼리 |
| `shop/[id]/page.tsx` | 서버 | 정적 데이터 fetch |
| `wishlist/page.tsx` | 서버 | 인증 유저 데이터 fetch |
| `report/page.tsx` | 클라이언트 | 폼 제출 인터랙션 |
| Admin 테이블 컴포넌트 | 클라이언트 | 승인/거절 버튼 인터랙션 |

## 인증 구조

- Supabase Auth 사용
- 세션은 쿠키에 저장 (`@supabase/ssr`)
- `proxy.ts`가 모든 요청에서 세션을 갱신
- `/admin/*` 경로는 미인증 시 `/login`으로 리다이렉트
- 일반 유저 데이터는 RLS 정책으로 제어 (코드 레벨 인증 불필요)
