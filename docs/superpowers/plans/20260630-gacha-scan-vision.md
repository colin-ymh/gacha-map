# Gacha Scan (Vision LLM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 가챠 기계를 촬영하면 Claude Haiku Vision이 상품명과 가격을 추출해 제보 폼을 자동완성한다.

**Architecture:** 모바일에서 `expo-image-picker`로 사진 촬영 → 리사이즈/압축 후 base64로 `POST /api/gacha-scan` 전송 → 서버에서 Claude Haiku Vision 호출 후 `search_gacha_products` RPC로 상품 매칭 → 후보 목록과 price_krw 반환 → 모바일이 폼 자동완성.

**Tech Stack:** `@anthropic-ai/sdk` (claude-haiku-4-5-20251001), `expo-image-picker`, `expo-image-manipulator`, 기존 `check_rate_limit` RPC (rate_limits 테이블), 기존 `search_gacha_products` RPC

## Global Constraints

- 색상 상수: `apps/mobile/constants/colors.ts`에서 import, 절대 하드코딩 금지
- 개인 일일 한도: 10회 / 서비스 일일 한도: 100회 (24h 슬라이딩 윈도우)
- 한도 초과 시 클라이언트 메시지: "기능 점검 중입니다." (에러 스택 미노출)
- Claude 모델: `claude-haiku-4-5-20251001` (비용 최적화)
- 이미지: 클라이언트에서 1280px 리사이즈 + JPEG 0.7 압축 후 base64 전송
- ANTHROPIC_API_KEY: 서버 전용 (NEXT_PUBLIC_ 접두사 금지)
- 기존 vitest + createSupabaseMock 패턴으로 테스트 작성
- TypeScript strict 모드 준수

---

## File Map

```
신규:
  apps/web/src/lib/claude.ts                        Anthropic 클라이언트 팩토리
  apps/web/src/app/api/gacha-scan/route.ts          POST /api/gacha-scan 핸들러
  apps/web/src/app/api/gacha-scan/__tests__/route.test.ts

수정:
  apps/web/package.json                             @anthropic-ai/sdk 추가
  apps/web/src/app/api/gacha-products/route.ts      (변경 없음, 참고용)
  apps/mobile/app/gacha-report.tsx                  카메라 버튼 + 스캔 플로우
```

---

## Task 1: Anthropic SDK 설치 + 환경 설정

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/claude.ts`

**Interfaces:**
- Produces: `createClaudeClient(): Anthropic` — Task 2 API route에서 사용

- [ ] **Step 1: SDK 설치**

```bash
cd apps/web
pnpm add @anthropic-ai/sdk
```

Expected: `apps/web/package.json`에 `"@anthropic-ai/sdk": "^0.x.x"` 추가됨

- [ ] **Step 2: 환경 변수 추가**

`apps/web/.env.local` (또는 실제 사용 중인 env 파일)에 추가:

```
ANTHROPIC_API_KEY=sk-ant-...
```

`.env.local`이 `.gitignore`에 있는지 확인 후 추가. 커밋하지 않는다.

- [ ] **Step 3: claude.ts 작성**

`apps/web/src/lib/claude.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";

export function createClaudeClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing env: ANTHROPIC_API_KEY");
  return new Anthropic({ apiKey });
}
```

- [ ] **Step 4: TypeScript 컴파일 확인**

```bash
cd apps/web
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/src/lib/claude.ts ../../pnpm-lock.yaml
git commit -m "feat(web): add @anthropic-ai/sdk + claude client factory"
```

---

## Task 2: POST /api/gacha-scan 백엔드 라우트 (TDD)

**Files:**
- Create: `apps/web/src/app/api/gacha-scan/__tests__/route.test.ts`
- Create: `apps/web/src/app/api/gacha-scan/route.ts`

**Interfaces:**
- Consumes:
  - `createAuthenticatedClient(request)` from `@/lib/supabase/server` → `{ user }`
  - `createAdminClient()` from `@/lib/supabase/server` → supabase admin
  - `createClaudeClient()` from `@/lib/claude` → Anthropic client
  - `check_rate_limit(p_key, p_max, p_window_ms)` RPC → boolean
  - `search_gacha_products(q, p_manufacturer, p_limit, p_offset)` RPC → row[]
- Produces:
  - `POST /api/gacha-scan` → `{ candidates: GachaProductCandidate[], price_krw: number | null }`
  - 401 when unauthenticated
  - 429 when rate limit exceeded
  - 400 when image missing/too large
  - 500 on Claude/DB error

```typescript
// GachaProductCandidate 타입 (route 파일 내 선언)
interface GachaProductCandidate {
  id: string;
  name: string;
  name_ko: string | null;
  name_ja: string | null;
  manufacturer: string;
  official_image_url: string | null;
  price_jpy: number | null;
}
```

- [ ] **Step 1: 테스트 파일 작성 (failing)**

`apps/web/src/app/api/gacha-scan/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSupabaseMock } from "@/test/mocks/supabase";

// next/headers mock
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

// Supabase server mock
const mockCreateAuthenticatedClient = vi.fn();
const mockCreateAdminClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAuthenticatedClient: () => mockCreateAuthenticatedClient(),
  createAdminClient: () => mockCreateAdminClient(),
}));

// Anthropic SDK mock
const mockMessagesCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockMessagesCreate };
  },
}));

// claude.ts는 SDK를 직접 인스턴스화하므로 env 세팅
vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

const mockProduct = {
  id: "prod-1",
  manufacturer: "BANDAI",
  name: "곰돌이 잠옷 가샤폰",
  name_ko: "곰돌이 잠옷 가샤폰",
  name_ja: "くまドリ パジャマ ガシャポン",
  name_en: null,
  official_image_url: "https://example.com/img.jpg",
  price_jpy: 400,
  total_count: 1,
};

function makeRequest(body: Record<string, unknown> = {}, token = "valid-token") {
  return new NextRequest("http://localhost/api/gacha-scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/gacha-scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 기본: 인증 성공, 레이트리밋 통과
    mockCreateAuthenticatedClient.mockReturnValue({
      user: { id: "user-1" },
    });

    const adminMock = createSupabaseMock([mockProduct], null, 0);
    // rate limit: true (통과)
    adminMock.rpc = vi.fn().mockImplementation((fn: string) => {
      if (fn === "check_rate_limit") return Promise.resolve({ data: true, error: null });
      if (fn === "search_gacha_products") return Promise.resolve({ data: [mockProduct], error: null });
      return Promise.resolve({ data: null, error: null });
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    // Claude 기본 응답
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '{"product_name":"곰돌이 잠옷","manufacturer":"BANDAI","price_krw":6500}',
        },
      ],
    });
  });

  it("인증 없으면 401 반환", async () => {
    mockCreateAuthenticatedClient.mockReturnValue({ user: null });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: "base64data" }));

    expect(res.status).toBe(401);
  });

  it("image 없으면 400 반환", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
  });

  it("image가 5MB 초과면 400 반환", async () => {
    const bigImage = "a".repeat(5_000_001);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: bigImage }));

    expect(res.status).toBe(400);
  });

  it("서비스 레이트리밋 초과 시 429 반환", async () => {
    const adminMock = createSupabaseMock(null, null, 0);
    adminMock.rpc = vi.fn().mockImplementation((fn: string, params: Record<string, unknown>) => {
      if (fn === "check_rate_limit" && params.p_key === "vision:service") {
        return Promise.resolve({ data: false, error: null });
      }
      return Promise.resolve({ data: true, error: null });
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: "base64data" }));

    expect(res.status).toBe(429);
  });

  it("개인 레이트리밋 초과 시 429 반환", async () => {
    const adminMock = createSupabaseMock(null, null, 0);
    adminMock.rpc = vi.fn().mockImplementation((fn: string, params: Record<string, unknown>) => {
      if (fn === "check_rate_limit" && (params.p_key as string).startsWith("vision:u:")) {
        return Promise.resolve({ data: false, error: null });
      }
      return Promise.resolve({ data: true, error: null });
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: "base64data" }));

    expect(res.status).toBe(429);
  });

  it("정상 스캔: candidates와 price_krw 반환", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: "base64data" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0].id).toBe("prod-1");
    expect(body.candidates[0].name_ko).toBe("곰돌이 잠옷 가샤폰");
    expect(body.price_krw).toBe(6500);
  });

  it("Claude가 상품명 null 반환하면 빈 candidates 반환", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [
        { type: "text", text: '{"product_name":null,"manufacturer":null,"price_krw":5000}' },
      ],
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: "base64data" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidates).toHaveLength(0);
    expect(body.price_krw).toBe(5000);
  });

  it("search_gacha_products 결과 없으면 빈 candidates 반환", async () => {
    const adminMock = createSupabaseMock(null, null, 0);
    adminMock.rpc = vi.fn().mockImplementation((fn: string) => {
      if (fn === "check_rate_limit") return Promise.resolve({ data: true, error: null });
      if (fn === "search_gacha_products") return Promise.resolve({ data: [], error: null });
      return Promise.resolve({ data: null, error: null });
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: "base64data" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidates).toHaveLength(0);
  });

  it("Claude JSON 파싱 실패 시 빈 candidates와 null price_krw 반환", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "죄송합니다, 인식 불가" }],
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: "base64data" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidates).toHaveLength(0);
    expect(body.price_krw).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd apps/web
npx vitest run src/app/api/gacha-scan/__tests__/route.test.ts
```

Expected: 전체 FAIL ("Cannot find module '../route'")

- [ ] **Step 3: API 라우트 구현**

`apps/web/src/app/api/gacha-scan/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient, createAdminClient } from "@/lib/supabase/server";
import { createClaudeClient } from "@/lib/claude";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 5_000_000;
const DAILY_WINDOW_MS = 86_400_000;
const USER_DAILY_LIMIT = 10;
const SERVICE_DAILY_LIMIT = 100;
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const SEARCH_LIMIT = 3;

interface GachaProductCandidate {
  id: string;
  name: string;
  name_ko: string | null;
  name_ja: string | null;
  manufacturer: string;
  official_image_url: string | null;
  price_jpy: number | null;
}

interface ClaudeExtraction {
  product_name: string | null;
  manufacturer: string | null;
  price_krw: number | null;
}

function extractJson(text: string): ClaudeExtraction {
  try {
    // JSON 블록만 추출 (마크다운 코드블록 대응)
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { product_name: null, manufacturer: null, price_krw: null };
    const parsed = JSON.parse(match[0]);
    return {
      product_name: typeof parsed.product_name === "string" ? parsed.product_name : null,
      manufacturer: typeof parsed.manufacturer === "string" ? parsed.manufacturer : null,
      price_krw: typeof parsed.price_krw === "number" ? Math.round(parsed.price_krw) : null,
    };
  } catch {
    return { product_name: null, manufacturer: null, price_krw: null };
  }
}

export async function POST(request: NextRequest) {
  // 1. 인증
  const { user } = await createAuthenticatedClient(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. body 파싱
  let image: string | undefined;
  try {
    const body = await request.json();
    image = typeof body.image === "string" ? body.image : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!image) {
    return NextResponse.json({ error: "image is required" }, { status: 400 });
  }
  if (image.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image too large (max 5MB)" }, { status: 400 });
  }

  // 3. 레이트리밋 확인 (서비스 → 개인 순)
  const adminSupabase = createAdminClient();

  const { data: serviceAllowed } = await adminSupabase.rpc("check_rate_limit", {
    p_key: "vision:service",
    p_max: SERVICE_DAILY_LIMIT,
    p_window_ms: DAILY_WINDOW_MS,
  });
  if (!serviceAllowed) {
    return NextResponse.json({ error: "rate_limit" }, { status: 429 });
  }

  const { data: userAllowed } = await adminSupabase.rpc("check_rate_limit", {
    p_key: `vision:u:${user.id}`,
    p_max: USER_DAILY_LIMIT,
    p_window_ms: DAILY_WINDOW_MS,
  });
  if (!userAllowed) {
    return NextResponse.json({ error: "rate_limit" }, { status: 429 });
  }

  // 4. Claude Haiku Vision 호출
  let extraction: ClaudeExtraction = { product_name: null, manufacturer: null, price_krw: null };
  try {
    const claude = createClaudeClient();
    const message = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: image,
              },
            },
            {
              type: "text",
              text: `이 가샤폰 기계 사진에서 다음을 추출해주세요.
JSON만 반환 (다른 텍스트 없이):
{"product_name":"상품명(한국어우선,없으면일본어,모르면null)","manufacturer":"제조사(예:BANDAI,모르면null)","price_krw":기계LCD왼쪽숫자(없으면null)}`,
            },
          ],
        },
      ],
    });

    const text = message.content.find((c) => c.type === "text");
    if (text && text.type === "text") {
      extraction = extractJson(text.text);
    }
  } catch {
    // Claude 호출 실패: 빈 결과 반환 (500 대신 graceful degradation)
    return NextResponse.json({ candidates: [], price_krw: null });
  }

  // 5. 상품 검색
  const candidates: GachaProductCandidate[] = [];
  if (extraction.product_name) {
    const { data: rpcData } = await adminSupabase.rpc("search_gacha_products", {
      q: extraction.product_name,
      p_manufacturer: extraction.manufacturer ?? null,
      p_limit: SEARCH_LIMIT,
      p_offset: 0,
    });

    for (const row of rpcData ?? []) {
      candidates.push({
        id: row.id,
        name: row.name,
        name_ko: row.name_ko,
        name_ja: row.name_ja,
        manufacturer: row.manufacturer,
        official_image_url: row.official_image_url,
        price_jpy: row.price_jpy,
      });
    }
  }

  return NextResponse.json({ candidates, price_krw: extraction.price_krw });
}
```

- [ ] **Step 4: 테스트 실행**

```bash
cd apps/web
npx vitest run src/app/api/gacha-scan/__tests__/route.test.ts
```

Expected: 전체 PASS (9 tests)

- [ ] **Step 5: 전체 웹 테스트 확인**

```bash
cd apps/web
npx vitest run
```

Expected: 전체 PASS (기존 313 + 9 신규)

- [ ] **Step 6: TypeScript 확인**

```bash
cd apps/web
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/gacha-scan/
git commit -m "feat(api): POST /api/gacha-scan — Vision LLM 가챠 스캔 엔드포인트"
```

---

## Task 3: 모바일 gacha-report.tsx 스캔 플로우 추가

**Files:**
- Modify: `apps/mobile/app/gacha-report.tsx`

**Interfaces:**
- Consumes:
  - `POST /api/gacha-scan` → `{ candidates: GachaProductCandidate[], price_krw: number | null }`
  - `expo-image-picker` `launchCameraAsync` / `launchImageLibraryAsync`
  - `expo-image-manipulator` `manipulateAsync`
  - `getAuthHeaders()` from `@/lib/supabase`
- Produces:
  - 카메라 버튼 UI (searchSection 내부, GachaProductSearch 오른쪽)
  - 스캔 로딩 상태 오버레이
  - 후보 목록 인라인 picker (1개면 자동 선택, 2~3개면 선택 UI)
  - "기능 점검 중입니다." Alert (429 응답 시)

**GachaProductCandidate 타입 (모바일측):**
```typescript
interface ScanCandidate {
  id: string;
  name: string;
  name_ko: string | null;
  name_ja: string | null;
  manufacturer: string;
  official_image_url: string | null;
  price_jpy: number | null;
}
```

- [ ] **Step 1: import 추가**

`apps/mobile/app/gacha-report.tsx` 상단 import 블록에 추가:

```typescript
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
```

기존 import 목록에서 `THUMBNAIL_PLACEHOLDER` 옆에 `PRIMARY_BG` 없으면 불필요 — 새 색상은 기존 상수 사용.

- [ ] **Step 2: 타입 및 상태 추가**

기존 `useState` 선언들 아래에 추가:

```typescript
interface ScanCandidate {
  id: string;
  name: string;
  name_ko: string | null;
  name_ja: string | null;
  manufacturer: string;
  official_image_url: string | null;
  price_jpy: number | null;
}

// 스캔 관련 상태
const [isScanLoading, setIsScanLoading] = useState(false);
const [scanCandidates, setScanCandidates] = useState<ScanCandidate[]>([]);
const [scannedPrice, setScannedPrice] = useState<number | null>(null);
```

- [ ] **Step 3: handleScan 함수 추가**

`handleSubmit` 위에 추가:

```typescript
const handleScan = useCallback(async () => {
  // 카메라 권한 요청
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(t("gacha.report.scanPermissionDenied"));
    return;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: "images",
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) return;

  const uri = result.assets[0].uri;

  setIsScanLoading(true);
  setScanCandidates([]);

  try {
    // 리사이즈 + 압축 + base64 변환
    const processed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }],
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      },
    );

    if (!processed.base64) throw new Error("base64 변환 실패");

    const { getAuthHeaders } = await import("@/lib/supabase");
    const headers = await getAuthHeaders();

    const res = await fetch(`${API_BASE}/api/gacha-scan`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ image: processed.base64 }),
    });

    if (res.status === 429) {
      Alert.alert(t("gacha.report.scanUnavailable"));
      return;
    }

    if (!res.ok) throw new Error();

    const data: { candidates: ScanCandidate[]; price_krw: number | null } =
      await res.json();

    if (data.candidates.length === 0) {
      Alert.alert(t("gacha.report.scanNoMatch"));
      return;
    }

    if (data.price_krw != null) {
      setPriceKrw(data.price_krw.toString());
    }
    setScannedPrice(data.price_krw);

    if (data.candidates.length === 1) {
      // 단일 결과: 자동 선택
      const c = data.candidates[0];
      setSelectedProduct({
        id: c.id,
        name: c.name,
        name_ko: c.name_ko,
        name_ja: c.name_ja,
        name_en: null,
        manufacturer: c.manufacturer,
        official_image_url: c.official_image_url,
        price_jpy: c.price_jpy,
        release_month: null,
        status: "active",
      });
      setScanCandidates([]);
    } else {
      // 복수 결과: 인라인 picker 표시
      setScanCandidates(data.candidates);
    }
  } catch {
    Alert.alert(t("gacha.report.scanError"));
  } finally {
    setIsScanLoading(false);
  }
}, [t]);
```

- [ ] **Step 4: 카메라 버튼 UI 추가**

`searchSection` View 내부, `GachaProductSearch` 아래 `modeToggle` TouchableOpacity 위에 삽입:

기존 코드:
```tsx
<View style={styles.searchSection}>
  <GachaProductSearch
    placeholder={t("gacha.report.searchPlaceholder")}
    onSelect={(product) => {
      setSelectedProduct(product);
    }}
    onResultsChange={setIsSearchDropdownOpen}
  />
  <TouchableOpacity onPress={switchToManual} style={styles.modeToggle}>
```

변경 후:
```tsx
<View style={styles.searchSection}>
  <View style={styles.searchRow}>
    <View style={{ flex: 1 }}>
      <GachaProductSearch
        placeholder={t("gacha.report.searchPlaceholder")}
        onSelect={(product) => {
          setSelectedProduct(product);
          setScanCandidates([]);
        }}
        onResultsChange={setIsSearchDropdownOpen}
      />
    </View>
    <TouchableOpacity
      onPress={handleScan}
      style={styles.scanBtn}
      disabled={isScanLoading}
    >
      {isScanLoading ? (
        <ActivityIndicator size="small" color={PRIMARY} />
      ) : (
        <Ionicons name="camera-outline" size={22} color={PRIMARY} />
      )}
    </TouchableOpacity>
  </View>
  <TouchableOpacity onPress={switchToManual} style={styles.modeToggle}>
```

- [ ] **Step 5: 스캔 후보 인라인 picker UI 추가**

`selectedCard` View 위에 삽입 (content View 내부):

기존 코드 (`{selectedProduct && (...)}` 블록 위에):
```tsx
{scanCandidates.length > 0 && (
  <View style={styles.candidatesBox}>
    <Text style={styles.candidatesLabel}>
      {t("gacha.report.scanPickOne")}
    </Text>
    {scanCandidates.map((c) => (
      <TouchableOpacity
        key={c.id}
        style={styles.candidateRow}
        onPress={() => {
          setSelectedProduct({
            id: c.id,
            name: c.name,
            name_ko: c.name_ko,
            name_ja: c.name_ja,
            name_en: null,
            manufacturer: c.manufacturer,
            official_image_url: c.official_image_url,
            price_jpy: c.price_jpy,
            release_month: null,
            status: "active",
          });
          setScanCandidates([]);
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.candidateName} numberOfLines={2}>
          {c.name_ko ?? c.name_ja ?? c.name}
        </Text>
        <Text style={styles.candidateMfr}>{c.manufacturer}</Text>
      </TouchableOpacity>
    ))}
  </View>
)}
```

- [ ] **Step 6: StyleSheet에 스타일 추가**

기존 `StyleSheet.create({...})` 내부에 추가:

```typescript
searchRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
},
scanBtn: {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: GRAY_100,
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
},
candidatesBox: {
  backgroundColor: GRAY_100,
  borderRadius: 8,
  padding: 12,
  gap: 8,
},
candidatesLabel: {
  fontSize: 13,
  fontWeight: "600",
  color: TEXT_DARK,
  marginBottom: 4,
},
candidateRow: {
  paddingVertical: 10,
  paddingHorizontal: 8,
  backgroundColor: WHITE,
  borderRadius: 6,
  gap: 2,
},
candidateName: {
  fontSize: 13,
  fontWeight: "600",
  color: TEXT_DARK,
},
candidateMfr: {
  fontSize: 11,
  color: TEXT_GRAY,
},
```

- [ ] **Step 7: i18n 키 추가**

`apps/mobile/messages/ko.json` (또는 사용 중인 i18n 파일)에 추가:

파일 구조 확인:
```bash
ls apps/mobile/messages/
```

`gacha.report` 섹션에 추가:
```json
"scanPermissionDenied": "카메라 권한이 필요합니다.",
"scanUnavailable": "기능 점검 중입니다.",
"scanNoMatch": "상품을 찾지 못했어요. 직접 검색해주세요.",
"scanError": "스캔 중 오류가 발생했어요. 다시 시도해주세요.",
"scanPickOne": "어떤 상품인가요?"
```

`apps/mobile/messages/ja.json`, `apps/mobile/messages/zh.json`에도 동일 키 추가 (번역값은 아래):

`ja.json`:
```json
"scanPermissionDenied": "カメラのアクセス許可が必要です。",
"scanUnavailable": "機能メンテナンス中です。",
"scanNoMatch": "商品が見つかりませんでした。検索してください。",
"scanError": "スキャン中にエラーが発生しました。",
"scanPickOne": "どの商品ですか？"
```

`zh.json`:
```json
"scanPermissionDenied": "需要相机权限。",
"scanUnavailable": "功能维护中。",
"scanNoMatch": "未找到商品，请手动搜索。",
"scanError": "扫描时出现错误，请重试。",
"scanPickOne": "是哪个商品？"
```

- [ ] **Step 8: TypeScript 확인**

```bash
cd apps/mobile
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/app/gacha-report.tsx apps/mobile/messages/
git commit -m "feat(mobile): 가챠 기계 사진 스캔으로 상품+가격 자동완성"
```

---

## Verification (전체 완료 후)

- [ ] **백엔드 단위 테스트**
  ```bash
  cd apps/web && npx vitest run src/app/api/gacha-scan/
  ```
  Expected: 9 PASS

- [ ] **전체 웹 테스트**
  ```bash
  cd apps/web && npx vitest run
  ```
  Expected: 전체 PASS

- [ ] **TypeScript (web + mobile)**
  ```bash
  cd apps/web && npx tsc --noEmit
  npx tsc --noEmit  # mobile
  ```
  Expected: 0 errors 양쪽

- [ ] **실기기 E2E 확인 (manual)**
  1. 개발 빌드로 앱 실행
  2. 샵 상세 → 제보하기 → 가챠 제보
  3. 카메라 아이콘 탭
  4. 가챠 기계 촬영
  5. 상품 자동 선택 + 가격 자동입력 확인
  6. 429 시 "기능 점검 중입니다." Alert 확인

- [ ] **레이트리밋 확인 (Supabase SQL)**
  ```sql
  SELECT key, count, reset_at FROM rate_limits WHERE key LIKE 'vision:%';
  ```
  스캔 후 `vision:service`와 `vision:u:{userId}` row 생성 확인

- [ ] **색상 하드코딩 없음**
  ```bash
  grep -n "#[0-9a-fA-F]" apps/mobile/app/gacha-report.tsx
  ```
  Expected: 신규 추가된 색상 없음
