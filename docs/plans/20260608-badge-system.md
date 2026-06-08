# 배지 시스템 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자 행동(퀵리포트/리뷰/신고/위시리스트)에 따라 독립 배지 트랙을 부여하고, 대표 배지를 프로필 헤더와 리뷰 카드에 노출하는 게이미피케이션 시스템 구축

**Architecture:** DB 기반 배지 정의(어드민 수정 가능) + 서버사이드 배지 서비스 레이어 + 기존 API 라우트에 배지 카운트 훅 삽입. 주간 카운트 dedup으로 어뷰징 방지.

**Tech Stack:** Next.js App Router, Supabase (Postgres), TypeScript, React Native (Expo), styled-components

**Spec:** `docs/superpowers/specs/2026-06-08-badge-system-design.md`

---

## 파일 구조

### 신규 생성

```
supabase/migrations/20260608_badge_system.sql
packages/shared/src/types/badge.ts
apps/web/src/lib/badges/count.ts         # 주간 카운트 dedup
apps/web/src/lib/badges/earn.ts          # 배지 획득 체크
apps/web/src/lib/badges/anomaly.ts       # 이상 감지 + 어뷰징 플래그
apps/web/src/lib/badges/index.ts         # exports
apps/web/src/app/api/users/badges/route.ts        # GET 사용자 배지
apps/web/src/app/api/users/badges/main/route.ts   # PUT 대표 배지 설정
apps/web/src/app/[locale]/admin/badges/page.tsx   # 배지 정의 관리
apps/web/src/app/[locale]/admin/abuse-flags/page.tsx  # 어뷰징 플래그 관리
```

### 수정 대상

```
packages/shared/src/types/index.ts       # 기존 배지 상수 → 레거시 표시
supabase/migrations/                     # 새 마이그레이션
apps/web/src/app/api/shops/[id]/quick-report/route.ts   # 배지 서비스 연동
apps/web/src/app/api/shops/[id]/reviews/route.ts        # 배지 카운트 훅
apps/web/src/app/api/wishlist/route.ts                  # 배지 카운트 훅
apps/mobile/app/badges.tsx               # 신규 설계로 재작성 (untracked)
apps/web/src/app/[locale]/mypage/badges/page.tsx        # 신규 설계로 재작성 (untracked)
apps/mobile/app/(tabs)/profile.view.tsx  # 대표 배지 표시
apps/web/src/components/organisms/mypage/mypage-panel.view.tsx  # 대표 배지 표시
```

---

## Task 1: DB 마이그레이션

**Files:**

- Create: `supabase/migrations/20260608_badge_system.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- badge_definitions: 어드민이 관리하는 배지 정의
CREATE TABLE badge_definitions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  track text NOT NULL,
  tier smallint NOT NULL CHECK (tier IN (1, 2, 3)),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon_url text NOT NULL DEFAULT '',
  threshold integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(track, tier)
);

-- user_badges: 사용자가 획득한 배지
CREATE TABLE user_badges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_definition_id uuid NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_definition_id)
);

-- badge_count_log: 배지 카운트 주간 dedup
CREATE TABLE badge_count_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  week_start date NOT NULL,
  counted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, shop_id, action_type, week_start)
);

-- abuse_flags: 이상 행동 플래그
CREATE TABLE abuse_flags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flag_type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id)
);

-- user_profiles: 대표 배지 컬럼 추가
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS main_badge_id uuid REFERENCES user_badges(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_count_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "badge_definitions: read for all" ON badge_definitions FOR SELECT USING (true);
CREATE POLICY "badge_definitions: write for admin only" ON badge_definitions FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "user_badges: read for all" ON user_badges FOR SELECT USING (true);
CREATE POLICY "user_badges: insert by service role" ON user_badges FOR INSERT WITH CHECK (true);

CREATE POLICY "badge_count_log: insert by service role" ON badge_count_log FOR INSERT WITH CHECK (true);
CREATE POLICY "badge_count_log: read own" ON badge_count_log FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "abuse_flags: admin only" ON abuse_flags FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- 배지 정의 초기 데이터 (임계값은 어드민에서 수정 가능)
INSERT INTO badge_definitions (track, tier, name, description, threshold) VALUES
  ('quick_report', 1, '눈팅러', '처음으로 퀵리포트를 제출했어요', 1),
  ('quick_report', 2, '정보통', '꾸준히 현장 상황을 알려주고 있어요', 10),
  ('quick_report', 3, '가차신', '가차 현장의 전설이에요', 30),
  ('shop_review', 1, '수다쟁이', '처음으로 샵 리뷰를 남겼어요', 1),
  ('shop_review', 2, '리뷰어', '유용한 리뷰를 꾸준히 작성하고 있어요', 10),
  ('shop_review', 3, '구루', '리뷰계의 구루예요', 30),
  ('new_shop_report', 1, '발굴러', '새로운 샵을 처음 발굴했어요', 1),
  ('new_shop_report', 2, '탐험가', '지도를 넓혀가고 있어요', 5),
  ('new_shop_report', 3, '지도 제작자', '가차 지도의 개척자예요', 15),
  ('closed_shop_report', 1, '정리왕', '폐업 샵을 처음 신고했어요', 1),
  ('closed_shop_report', 2, '추적자', '현장 정보를 정확하게 유지하고 있어요', 5),
  ('closed_shop_report', 3, '현실주의자', '지도를 항상 최신으로 유지해요', 15),
  ('fix_info_report', 1, '꼼꼼이', '처음으로 정보 수정을 요청했어요', 1),
  ('fix_info_report', 2, '팩트체커', '틀린 정보를 바로잡고 있어요', 5),
  ('fix_info_report', 3, '진실 수호자', '정보 정확성의 수호자예요', 15),
  ('wishlist', 1, '찜 초보', '처음으로 샵을 위시리스트에 추가했어요', 1),
  ('wishlist', 2, '수집가', '마음에 드는 샵을 모으고 있어요', 10),
  ('wishlist', 3, '욕망 큐레이터', '취향의 아카이브를 완성했어요', 30),
  ('operator', 1, '공식 운영자', '관리자가 인증한 샵 운영자예요', 0);
```

- [ ] **Step 2: 마이그레이션 적용 (dev)**

```bash
supabase db push --local
```

Expected: 마이그레이션 성공, 에러 없음

- [ ] **Step 3: 테이블 생성 확인**

```bash
supabase db diff --local
```

Expected: `badge_definitions`, `user_badges`, `badge_count_log`, `abuse_flags` 테이블 + `user_profiles.main_badge_id` 컬럼 확인

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260608_badge_system.sql
git commit -m "feat(db): add badge system tables and initial badge definitions"
```

---

## Task 2: 공유 타입 정의

**Files:**

- Create: `packages/shared/src/types/badge.ts`
- Modify: `packages/shared/src/types/index.ts`

- [ ] **Step 1: badge.ts 생성**

```typescript
export type BadgeTrack =
  | "quick_report"
  | "shop_review"
  | "new_shop_report"
  | "closed_shop_report"
  | "fix_info_report"
  | "wishlist"
  | "operator";

export type BadgeTier = 1 | 2 | 3;

export interface BadgeDefinition {
  id: string;
  track: BadgeTrack;
  tier: BadgeTier;
  name: string;
  description: string;
  icon_url: string;
  threshold: number;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_definition_id: string;
  earned_at: string;
  badge_definitions: BadgeDefinition;
}

export interface BadgeCountLogEntry {
  user_id: string;
  shop_id: string;
  action_type: BadgeTrack;
  week_start: string;
}

export interface AbuseFlag {
  id: string;
  user_id: string;
  flag_type:
    | "burst_activity"
    | "new_account_rapid_achievement"
    | "price_anomaly";
  detail: Record<string, unknown>;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}
```

- [ ] **Step 2: index.ts에서 기존 배지 상수 레거시 표시**

`packages/shared/src/types/index.ts`에서 기존 `BADGES`, `getEarnedBadges`, `getNewBadge` 위에 주석 추가:

```typescript
/** @deprecated DB 기반 배지 시스템으로 대체됨. 기존 quick-report 연동 제거 후 삭제 예정 */
```

- [ ] **Step 3: badge.ts를 index.ts에서 re-export**

`packages/shared/src/types/index.ts` 하단에 추가:

```typescript
export * from "./badge";
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/badge.ts packages/shared/src/types/index.ts
git commit -m "feat(types): add badge system types"
```

---

## Task 3: 배지 서비스 레이어

**Files:**

- Create: `apps/web/src/lib/badges/count.ts`
- Create: `apps/web/src/lib/badges/earn.ts`
- Create: `apps/web/src/lib/badges/anomaly.ts`
- Create: `apps/web/src/lib/badges/index.ts`

- [ ] **Step 1: count.ts 작성**

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import { BadgeTrack } from "@gacha-map/shared";

function getWeekStart(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

/**
 * 배지 카운트 로그에 삽입 시도.
 * 이미 이번 주에 같은 샵+행동 조합이 있으면 false 반환 (중복 카운트 방지).
 */
export async function tryLogBadgeCount(
  supabase: SupabaseClient,
  userId: string,
  shopId: string,
  actionType: BadgeTrack,
): Promise<boolean> {
  const { error } = await supabase.from("badge_count_log").insert({
    user_id: userId,
    shop_id: shopId,
    action_type: actionType,
    week_start: getWeekStart(),
  });
  // UNIQUE violation = 이미 이번 주에 카운트됨
  return !error;
}

export async function getBadgeCount(
  supabase: SupabaseClient,
  userId: string,
  track: BadgeTrack,
): Promise<number> {
  const { count } = await supabase
    .from("badge_count_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action_type", track);
  return count ?? 0;
}
```

- [ ] **Step 2: earn.ts 작성**

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import { BadgeDefinition, BadgeTrack } from "@gacha-map/shared";
import { getBadgeCount } from "./count";

/**
 * 배지 획득 체크 및 부여.
 * 새로 획득한 배지 반환, 없으면 null.
 */
export async function checkAndAwardBadge(
  supabase: SupabaseClient,
  userId: string,
  track: BadgeTrack,
): Promise<BadgeDefinition | null> {
  const currentCount = await getBadgeCount(supabase, userId, track);

  const { data: definitions } = await supabase
    .from("badge_definitions")
    .select("*")
    .eq("track", track)
    .order("tier", { ascending: true });

  if (!definitions?.length) return null;

  const { data: earnedBadges } = await supabase
    .from("user_badges")
    .select("badge_definition_id")
    .eq("user_id", userId)
    .in(
      "badge_definition_id",
      definitions.map((d) => d.id),
    );

  const earnedIds = new Set(
    (earnedBadges ?? []).map((b) => b.badge_definition_id),
  );

  // 아직 미획득인 배지 중 threshold 초과한 가장 높은 tier
  let newBadge: BadgeDefinition | null = null;
  for (const def of definitions) {
    if (currentCount >= def.threshold && !earnedIds.has(def.id)) {
      newBadge = def;
    }
  }

  if (!newBadge) return null;

  const { error } = await supabase.from("user_badges").insert({
    user_id: userId,
    badge_definition_id: newBadge.id,
  });

  return error ? null : newBadge;
}
```

- [ ] **Step 3: anomaly.ts 작성**

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import { BadgeTrack } from "@gacha-map/shared";

async function createAbuseFlag(
  supabase: SupabaseClient,
  userId: string,
  flagType: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from("abuse_flags")
    .insert({ user_id: userId, flag_type: flagType, detail });
}

export async function checkAnomalies(
  supabase: SupabaseClient,
  userId: string,
  actionType: BadgeTrack,
): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Check 1: 1시간 내 같은 유형 10건 이상
  const { count: recentCount } = await supabase
    .from("badge_count_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action_type", actionType)
    .gte("counted_at", oneHourAgo);

  if ((recentCount ?? 0) >= 10) {
    await createAbuseFlag(supabase, userId, "burst_activity", {
      actionType,
      count: recentCount,
    });
    return;
  }

  // Check 2: 가입 후 7일 이내 + tier 2 이상 배지 획득
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("created_at")
    .eq("id", userId)
    .single();

  if (!profile) return;

  const accountAgeDays =
    (Date.now() - new Date(profile.created_at).getTime()) /
    (1000 * 60 * 60 * 24);

  if (accountAgeDays < 7) {
    const { data: tier2Badges } = await supabase
      .from("user_badges")
      .select("badge_definitions(tier)")
      .eq("user_id", userId);

    const hasTier2 = tier2Badges?.some(
      (b: any) => (b.badge_definitions as any)?.tier >= 2,
    );
    if (hasTier2) {
      await createAbuseFlag(supabase, userId, "new_account_rapid_achievement", {
        accountAgeDays: Math.floor(accountAgeDays),
      });
    }
  }
}

/** 가격 이상값 플래그 (퀵리포트/가차상품 등록에서 직접 호출) */
export async function flagPriceAnomaly(
  supabase: SupabaseClient,
  userId: string,
  price: number,
  context: Record<string, unknown>,
): Promise<void> {
  if (price < 100 || price > 10000) {
    await createAbuseFlag(supabase, userId, "price_anomaly", {
      price,
      ...context,
    });
  }
}
```

- [ ] **Step 4: index.ts 작성**

```typescript
export { tryLogBadgeCount, getBadgeCount } from "./count";
export { checkAndAwardBadge } from "./earn";
export { checkAnomalies, flagPriceAnomaly } from "./anomaly";
```

- [ ] **Step 5: TypeScript 빌드 확인**

```bash
cd apps/web && rtk tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/badges/
git commit -m "feat(badges): add badge service layer (count, earn, anomaly)"
```

---

## Task 4: 배지 API 엔드포인트

**Files:**

- Create: `apps/web/src/app/api/users/badges/route.ts`
- Create: `apps/web/src/app/api/users/badges/main/route.ts`

- [ ] **Step 1: GET /api/users/badges 작성**

```typescript
// apps/web/src/app/api/users/badges/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: allDefinitions } = await supabase
    .from("badge_definitions")
    .select("*")
    .order("track")
    .order("tier");

  const { data: earnedBadges } = await supabase
    .from("user_badges")
    .select("*, badge_definitions(*)")
    .eq("user_id", user.id);

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("main_badge_id")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    definitions: allDefinitions ?? [],
    earned: earnedBadges ?? [],
    main_badge_id: profile?.main_badge_id ?? null,
  });
}
```

- [ ] **Step 2: PUT /api/users/badges/main 작성**

```typescript
// apps/web/src/app/api/users/badges/main/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function PUT(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { badge_id } = await req.json();

  // badge_id가 null이면 대표 배지 해제
  if (badge_id === null) {
    await supabase
      .from("user_profiles")
      .update({ main_badge_id: null })
      .eq("id", user.id);
    return NextResponse.json({ success: true });
  }

  // 본인 소유 배지인지 확인
  const { data: badge } = await supabase
    .from("user_badges")
    .select("id")
    .eq("id", badge_id)
    .eq("user_id", user.id)
    .single();

  if (!badge)
    return NextResponse.json({ error: "Badge not found" }, { status: 404 });

  await supabase
    .from("user_profiles")
    .update({ main_badge_id: badge_id })
    .eq("id", user.id);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: TypeScript 확인**

```bash
cd apps/web && rtk tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/users/badges/
git commit -m "feat(api): add GET /api/users/badges and PUT /api/users/badges/main"
```

---

## Task 5: 기존 API에 배지 카운트 훅 연동

**Files:**

- Modify: `apps/web/src/app/api/shops/[id]/quick-report/route.ts`
- Modify: `apps/web/src/app/api/shops/[id]/reviews/route.ts`
- Modify: `apps/web/src/app/api/wishlist/route.ts`

> **Note:** `apps/web/src/app/api/shops/[id]/reports/route.ts` (new_shop, closed, fix_info)도 같은 패턴으로 연동 필요. 파일 위치 확인 후 적용.

### 5-1: quick-report 연동

- [ ] **Step 1: 기존 contribution_count 로직 교체**

`apps/web/src/app/api/shops/[id]/quick-report/route.ts`에서:

기존 코드 (contribution_count 직접 증가 + getNewBadge 호출) 를 아래로 교체:

```typescript
import {
  tryLogBadgeCount,
  checkAndAwardBadge,
  checkAnomalies,
} from "@/lib/badges";

// 기존 contribution_count 증가 로직 제거 후 아래로 대체
const counted = await tryLogBadgeCount(
  supabase,
  user.id,
  shopId,
  "quick_report",
);
let newBadge = null;
if (counted) {
  newBadge = await checkAndAwardBadge(supabase, user.id, "quick_report");
  await checkAnomalies(supabase, user.id, "quick_report");
}

return NextResponse.json({
  success: true,
  new_badge: newBadge
    ? { id: newBadge.id, name: newBadge.name, icon_url: newBadge.icon_url }
    : null,
});
```

- [ ] **Step 2: 빌드 확인**

```bash
cd apps/web && rtk tsc --noEmit
```

### 5-2: 리뷰 API 연동

- [ ] **Step 3: reviews POST 핸들러 하단에 배지 카운트 추가**

`apps/web/src/app/api/shops/[id]/reviews/route.ts`의 POST 핸들러에서 리뷰 insert 성공 후:

```typescript
import {
  tryLogBadgeCount,
  checkAndAwardBadge,
  checkAnomalies,
} from "@/lib/badges";

// 리뷰 insert 성공 후 배지 처리 (shopId는 params에서, userId는 auth에서)
const counted = await tryLogBadgeCount(supabase, userId, shopId, "shop_review");
if (counted) {
  await checkAndAwardBadge(supabase, userId, "shop_review");
  await checkAnomalies(supabase, userId, "shop_review");
}
```

### 5-3: 위시리스트 API 연동

- [ ] **Step 4: wishlist POST 핸들러에 배지 카운트 추가**

`apps/web/src/app/api/wishlist/route.ts`의 POST 핸들러에서 wishlist insert 성공 후:

```typescript
import {
  tryLogBadgeCount,
  checkAndAwardBadge,
  checkAnomalies,
} from "@/lib/badges";

const counted = await tryLogBadgeCount(supabase, userId, shopId, "wishlist");
if (counted) {
  await checkAndAwardBadge(supabase, userId, "wishlist");
  await checkAnomalies(supabase, userId, "wishlist");
}
```

- [ ] **Step 5: 전체 빌드 확인**

```bash
cd apps/web && rtk tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/shops/ apps/web/src/app/api/wishlist/
git commit -m "feat(badges): wire badge counting into quick-report, reviews, wishlist APIs"
```

> **TODO:** 신고 API (new_shop / closed / fix_info) 파일 위치 파악 후 같은 패턴으로 `new_shop_report`, `closed_shop_report`, `fix_info_report` 트랙 연동

---

## Task 6: 배지 페이지 UI — 웹

**Files:**

- Modify (rewrite): `apps/web/src/app/[locale]/mypage/badges/page.tsx`

- [ ] **Step 1: 배지 페이지 재작성**

```typescript
// apps/web/src/app/[locale]/mypage/badges/page.tsx
'use client'
import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { BadgeDefinition, UserBadge } from '@gacha-map/shared'
import COLORS from '@/styles/color'

interface BadgesPageData {
  definitions: BadgeDefinition[]
  earned: UserBadge[]
  main_badge_id: string | null
}

const TRACK_LABELS: Record<string, string> = {
  quick_report: '퀵리포트',
  shop_review: '샵 리뷰',
  new_shop_report: '신규샵 제보',
  closed_shop_report: '폐업 신고',
  fix_info_report: '정보수정',
  wishlist: '위시리스트',
  operator: '운영자',
}

export default function BadgesPage() {
  const [data, setData] = useState<BadgesPageData | null>(null)

  useEffect(() => {
    fetch('/api/users/badges').then((r) => r.json()).then(setData)
  }, [])

  if (!data) return <Loading>로딩 중...</Loading>

  const earnedIds = new Set(data.earned.map((b) => b.badge_definition_id))
  const operatorBadge = data.earned.find(
    (b) => (b.badge_definitions as BadgeDefinition).track === 'operator'
  )

  const tracks = Object.keys(TRACK_LABELS).filter((t) => t !== 'operator')

  async function setMainBadge(badgeId: string | null) {
    await fetch('/api/users/badges/main', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ badge_id: badgeId }),
    })
    setData((prev) => prev ? { ...prev, main_badge_id: badgeId } : prev)
  }

  return (
    <Container>
      {operatorBadge && (
        <OperatorSection>
          <OperatorBadge>
            <BadgeIcon>🏪</BadgeIcon>
            <BadgeName>{(operatorBadge.badge_definitions as BadgeDefinition).name}</BadgeName>
          </OperatorBadge>
        </OperatorSection>
      )}

      {tracks.map((track) => {
        const trackDefs = data.definitions.filter((d) => d.track === track)
        return (
          <TrackSection key={track}>
            <TrackTitle>{TRACK_LABELS[track]}</TrackTitle>
            <BadgeGrid>
              {trackDefs.map((def) => {
                const earned = earnedIds.has(def.id)
                const userBadge = data.earned.find((b) => b.badge_definition_id === def.id)
                const isMain = userBadge?.id === data.main_badge_id
                return (
                  <BadgeCard
                    key={def.id}
                    $earned={earned}
                    $isMain={isMain}
                    onClick={() => {
                      if (!earned || !userBadge) return
                      setMainBadge(isMain ? null : userBadge.id)
                    }}
                  >
                    {earned ? (
                      <>
                        <BadgeIcon>{def.icon_url || '🏅'}</BadgeIcon>
                        <BadgeName>{def.name}</BadgeName>
                        {isMain && <MainLabel>대표</MainLabel>}
                      </>
                    ) : (
                      <>
                        <LockIcon>🔒</LockIcon>
                        <LockedName>???</LockedName>
                      </>
                    )}
                  </BadgeCard>
                )
              })}
            </BadgeGrid>
          </TrackSection>
        )
      })}
    </Container>
  )
}

const Container = styled.div`
  padding: 16px;
  max-width: 480px;
  margin: 0 auto;
`
const Loading = styled.div`padding: 24px; text-align: center;`
const OperatorSection = styled.div`
  margin-bottom: 24px;
  padding: 16px;
  border-radius: 12px;
  background: ${COLORS.PRIMARY_LIGHT ?? '#f0f8ff'};
`
const OperatorBadge = styled.div`display: flex; align-items: center; gap: 8px;`
const TrackSection = styled.div`margin-bottom: 24px;`
const TrackTitle = styled.h3`font-size: 14px; font-weight: 600; margin-bottom: 12px;`
const BadgeGrid = styled.div`display: flex; gap: 12px; flex-wrap: wrap;`
const BadgeCard = styled.div<{ $earned: boolean; $isMain: boolean }>`
  width: 80px;
  padding: 12px 8px;
  border-radius: 12px;
  text-align: center;
  cursor: ${({ $earned }) => ($earned ? 'pointer' : 'default')};
  opacity: ${({ $earned }) => ($earned ? 1 : 0.4)};
  border: 2px solid ${({ $isMain }) => ($isMain ? COLORS.PRIMARY ?? '#4a90e2' : 'transparent')};
  background: ${({ $earned }) => ($earned ? '#fff' : '#f5f5f5')};
`
const BadgeIcon = styled.div`font-size: 28px; margin-bottom: 4px;`
const BadgeName = styled.div`font-size: 10px; font-weight: 500; word-break: keep-all;`
const MainLabel = styled.div`
  font-size: 9px; color: ${COLORS.PRIMARY ?? '#4a90e2'}; margin-top: 2px; font-weight: 600;
`
const LockIcon = styled.div`font-size: 28px; margin-bottom: 4px; filter: grayscale(1);`
const LockedName = styled.div`font-size: 10px; color: #aaa;`
```

> **Note:** `COLORS.PRIMARY`, `COLORS.PRIMARY_LIGHT` 등 실제 색상 상수는 `apps/web/src/styles/color.ts` 확인 후 맞게 수정.

- [ ] **Step 2: TypeScript 확인**

```bash
cd apps/web && rtk tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/[locale]/mypage/badges/"
git commit -m "feat(web): rewrite badges page with new badge system design"
```

---

## Task 7: 배지 페이지 UI — 모바일

**Files:**

- Modify (rewrite): `apps/mobile/app/badges.tsx`

- [ ] **Step 1: 모바일 배지 페이지 재작성**

```typescript
// apps/mobile/app/badges.tsx
import { useEffect, useState } from 'react'
import { ScrollView, TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BadgeDefinition, UserBadge } from '@gacha-map/shared'
import COLORS from '@/constants/colors'

interface BadgesPageData {
  definitions: BadgeDefinition[]
  earned: UserBadge[]
  main_badge_id: string | null
}

const TRACK_LABELS: Record<string, string> = {
  quick_report: '퀵리포트',
  shop_review: '샵 리뷰',
  new_shop_report: '신규샵 제보',
  closed_shop_report: '폐업 신고',
  fix_info_report: '정보수정',
  wishlist: '위시리스트',
  operator: '운영자',
}

export default function BadgesScreen() {
  const [data, setData] = useState<BadgesPageData | null>(null)

  useEffect(() => {
    // 실제 API 호출은 Supabase 클라이언트 또는 fetch로 구현
    // 모바일 API 패턴은 기존 profile.tsx 참고
    fetch('/api/users/badges').then((r) => r.json()).then(setData)
  }, [])

  if (!data) return (
    <SafeAreaView style={styles.center}>
      <Text>로딩 중...</Text>
    </SafeAreaView>
  )

  const earnedIds = new Set(data.earned.map((b) => b.badge_definition_id))
  const operatorBadge = data.earned.find(
    (b) => (b.badge_definitions as BadgeDefinition).track === 'operator'
  )
  const tracks = Object.keys(TRACK_LABELS).filter((t) => t !== 'operator')

  async function setMainBadge(badgeId: string | null) {
    await fetch('/api/users/badges/main', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ badge_id: badgeId }),
    })
    setData((prev) => prev ? { ...prev, main_badge_id: badgeId } : prev)
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {operatorBadge && (
          <View style={styles.operatorSection}>
            <Text style={styles.operatorBadgeName}>
              🏪 {(operatorBadge.badge_definitions as BadgeDefinition).name}
            </Text>
          </View>
        )}

        {tracks.map((track) => {
          const trackDefs = data.definitions.filter((d) => d.track === track)
          return (
            <View key={track} style={styles.trackSection}>
              <Text style={styles.trackTitle}>{TRACK_LABELS[track]}</Text>
              <View style={styles.badgeRow}>
                {trackDefs.map((def) => {
                  const earned = earnedIds.has(def.id)
                  const userBadge = data.earned.find((b) => b.badge_definition_id === def.id)
                  const isMain = userBadge?.id === data.main_badge_id
                  return (
                    <TouchableOpacity
                      key={def.id}
                      style={[styles.badgeCard, isMain && styles.mainCard, !earned && styles.lockedCard]}
                      onPress={() => {
                        if (!earned || !userBadge) return
                        setMainBadge(isMain ? null : userBadge.id)
                      }}
                      disabled={!earned}
                    >
                      <Text style={styles.badgeIcon}>{earned ? (def.icon_url || '🏅') : '🔒'}</Text>
                      <Text style={[styles.badgeName, !earned && styles.lockedName]}>
                        {earned ? def.name : '???'}
                      </Text>
                      {isMain && <Text style={styles.mainLabel}>대표</Text>}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16 },
  operatorSection: {
    padding: 16, marginBottom: 24, borderRadius: 12,
    backgroundColor: COLORS.PRIMARY_LIGHT ?? '#f0f8ff',
  },
  operatorBadgeName: { fontSize: 14, fontWeight: '600' },
  trackSection: { marginBottom: 24 },
  trackTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badgeCard: {
    width: 80, padding: 12, borderRadius: 12,
    alignItems: 'center', backgroundColor: '#fff',
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  mainCard: { borderColor: COLORS.PRIMARY ?? '#4a90e2' },
  lockedCard: { opacity: 0.4, backgroundColor: '#f5f5f5' },
  badgeIcon: { fontSize: 28, marginBottom: 4 },
  badgeName: { fontSize: 10, fontWeight: '500', textAlign: 'center' },
  lockedName: { color: '#aaa' },
  mainLabel: { fontSize: 9, color: COLORS.PRIMARY ?? '#4a90e2', fontWeight: '600', marginTop: 2 },
})
```

> **Note:** 모바일 API 호출 방식은 기존 `profile.tsx`의 패턴(Supabase 클라이언트 또는 fetch 기반)에 맞게 조정 필요.

- [ ] **Step 2: TypeScript 확인**

```bash
cd apps/mobile && rtk tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/badges.tsx
git commit -m "feat(mobile): rewrite badges screen with new badge system"
```

---

## Task 8: 프로필 헤더 대표 배지 표시

**Files:**

- Modify: `apps/mobile/app/(tabs)/profile.view.tsx`
- Modify: `apps/web/src/components/organisms/mypage/mypage-panel.view.tsx`

> **Note:** `AuthProfile` Redux 상태에 `main_badge` 필드 추가 필요. 기존 `fetchUserAsync` thunk (`/api/users/profile`) 수정하여 `user_profiles.main_badge_id → user_badges → badge_definitions` join으로 배지 정보 포함.

- [ ] **Step 1: /api/users/profile 응답에 main_badge 추가**

기존 `/api/users/profile` (또는 `fetchUserAsync`에서 호출하는 Supabase 쿼리)에서:

```typescript
const { data: profile } = await supabase
  .from("user_profiles")
  .select(
    `
    *,
    user_badges!main_badge_id(
      id,
      badge_definitions(id, name, icon_url, track, tier)
    )
  `,
  )
  .eq("id", user.id)
  .single();
```

응답에 `main_badge: { id, name, icon_url } | null` 포함.

- [ ] **Step 2: AuthProfile 타입에 main_badge 추가**

Redux `AuthProfile` 인터페이스에:

```typescript
main_badge: { id: string; name: string; icon_url: string } | null
```

- [ ] **Step 3: 모바일 profile.view.tsx에 배지 표시**

프로필 헤더 닉네임 아래에:

```tsx
{
  mainBadge && (
    <View style={styles.badgeRow}>
      <Text style={styles.badgeIcon}>{mainBadge.icon_url || "🏅"}</Text>
      <Text style={styles.badgeName}>{mainBadge.name}</Text>
    </View>
  );
}
```

- [ ] **Step 4: 웹 mypage-panel.view.tsx에 배지 표시**

프로필 헤더 닉네임 아래에 (styled-component 방식):

```tsx
{
  mainBadge && (
    <MainBadgeRow>
      <BadgeIcon>{mainBadge.icon_url || "🏅"}</BadgeIcon>
      <BadgeName>{mainBadge.name}</BadgeName>
    </MainBadgeRow>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(tabs)/profile.view.tsx apps/web/src/components/organisms/mypage/
git commit -m "feat(profile): display main badge in profile header"
```

---

## Task 9: 리뷰 카드에 배지 표시

**Files:** 리뷰 카드 컴포넌트 (탐색 필요)

> **Note:** 리뷰 카드 컴포넌트 위치 파악 필요. `apps/web/src/components/organisms/` 또는 `atoms/molecules/` 에서 review 관련 컴포넌트 확인.

- [ ] **Step 1: 리뷰 카드 컴포넌트 위치 파악**

```bash
grep -r "ReviewCard\|review-card\|ReviewItem" apps/web/src/components/ --include="*.tsx" -l
```

- [ ] **Step 2: 리뷰 API 응답에 user main_badge 포함**

`/api/shops/[id]/reviews` GET 쿼리에서 user_profiles join 시 `main_badge_id → user_badges → badge_definitions` 포함.

- [ ] **Step 3: 리뷰 카드 작성자 이름 옆에 배지 아이콘 표시**

```tsx
<AuthorRow>
  <AuthorName>{review.user.nickname}</AuthorName>
  {review.user.main_badge && (
    <BadgeIcon title={review.user.main_badge.name}>
      {review.user.main_badge.icon_url || "🏅"}
    </BadgeIcon>
  )}
</AuthorRow>
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(review): show main badge icon next to reviewer name"
```

---

## Task 10: 어드민 — 배지 정의 관리

**Files:**

- Create: `apps/web/src/app/[locale]/admin/badges/page.tsx`
- Create: `apps/web/src/app/api/admin/badges/route.ts`
- Create: `apps/web/src/app/api/admin/badges/[id]/route.ts`
- Modify: `apps/web/src/app/[locale]/admin/layout.tsx` (내비 항목 추가)

- [ ] **Step 1: 어드민 배지 API 작성**

```typescript
// apps/web/src/app/api/admin/badges/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { verifyAdminAuth } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  if (!(await verifyAdminAuth(supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data } = await supabase
    .from("badge_definitions")
    .select("*")
    .order("track")
    .order("tier");
  return NextResponse.json(data ?? []);
}
```

```typescript
// apps/web/src/app/api/admin/badges/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { verifyAdminAuth } from "@/lib/supabase/admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createRouteHandlerClient({ cookies });
  if (!(await verifyAdminAuth(supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const allowed = ["name", "description", "icon_url", "threshold"];
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k)),
  );
  const { data, error } = await supabase
    .from("badge_definitions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
```

- [ ] **Step 2: 어드민 배지 페이지 UI 작성**

`apps/web/src/app/[locale]/admin/badges/page.tsx` — 기존 `admin/reports/page.tsx` 패턴 따라 작성:

- 배지 정의 목록 테이블 (track, tier, name, threshold)
- 인라인 편집 (이름, 설명, 임계값, 아이콘 URL)
- 저장 버튼 → PATCH 호출

- [ ] **Step 3: 어드민 레이아웃에 배지 메뉴 추가**

`apps/web/src/app/[locale]/admin/layout.tsx` 내비 항목에 `{ label: '배지 관리', href: '/admin/badges' }` 추가

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/[locale]/admin/badges/" apps/web/src/app/api/admin/badges/
git commit -m "feat(admin): add badge definitions management page"
```

---

## Task 11: 어드민 — 어뷰징 플래그 관리

**Files:**

- Create: `apps/web/src/app/[locale]/admin/abuse-flags/page.tsx`
- Create: `apps/web/src/app/api/admin/abuse-flags/route.ts`
- Create: `apps/web/src/app/api/admin/abuse-flags/[id]/route.ts`

- [ ] **Step 1: 어뷰징 플래그 API**

```typescript
// apps/web/src/app/api/admin/abuse-flags/route.ts
// GET: 미검토 플래그 목록 (reviewed_at IS NULL)
// 기존 /api/admin/reports/ 패턴 참고
```

```typescript
// apps/web/src/app/api/admin/abuse-flags/[id]/route.ts
// PATCH: { action: 'dismiss' | 'warn' } → reviewed_at, reviewed_by 업데이트
```

- [ ] **Step 2: 어뷰징 플래그 페이지 UI**

`apps/web/src/app/[locale]/admin/abuse-flags/page.tsx`:

- 미검토 플래그 목록 (user_id, flag_type, detail, created_at)
- "dismiss" / "경고" 버튼

- [ ] **Step 3: 어드민 레이아웃에 메뉴 추가**

```typescript
{ label: '어뷰징 플래그', href: '/admin/abuse-flags' }
```

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/[locale]/admin/abuse-flags/" apps/web/src/app/api/admin/abuse-flags/
git commit -m "feat(admin): add abuse flags review page"
```

---

## 리스크 / 미결 사항

1. **기존 contribution_count 마이그레이션**: 기존 사용자의 `contribution_count` 를 `badge_count_log`로 소급할지 결정 필요. 소급 시 별도 one-time migration script 작성 필요.

2. **신고 API 위치 미확인**: `new_shop`, `closed`, `fix_info` 신고를 처리하는 API 라우트 파일 위치 탐색 후 Task 5와 동일한 패턴으로 연동.

3. **모바일 API 호출 패턴**: 모바일은 fetch 또는 Supabase 직접 쿼리 중 어느 패턴 사용하는지 `profile.tsx` 확인 후 badges.tsx에 맞게 조정.

4. **배지 아이콘**: 현재 이모지 fallback 사용. 실제 이미지 에셋 사용 시 Supabase Storage bucket 설정 필요.

5. **운영자 배지 부여 플로우**: 기존 shop-applications 승인 시 자동 부여할지, 별도 어드민 액션으로 부여할지 결정 필요. 결정 후 `/api/admin/shop-applications/[id]/route.ts` 에 `checkAndAwardBadge(userId, 'operator')` 연동.

6. **색상 상수**: `COLORS.PRIMARY`, `COLORS.PRIMARY_LIGHT` 등 실제 값은 `apps/web/src/styles/color.ts` 와 `apps/mobile/constants/colors.ts` 확인 후 적용.
