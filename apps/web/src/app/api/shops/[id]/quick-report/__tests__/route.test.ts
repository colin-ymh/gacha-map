import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

const mockHaversine = vi.fn().mockReturnValue(100);
const mockGetNewBadge = vi.fn().mockReturnValue(null);

vi.mock("@gacha-map/shared", () => ({
  haversineDistanceMeters: (...args: unknown[]) => mockHaversine(...args),
  getNewBadge: (...args: unknown[]) => mockGetNewBadge(...args),
}));

const { mockCreateAdminClient, mockCreateAuthenticatedClient } = vi.hoisted(
  () => ({
    mockCreateAdminClient: vi.fn(),
    mockCreateAuthenticatedClient: vi.fn(),
  }),
);

const {
  mockTryLogBadgeCount,
  mockCheckAndAwardBadge,
  mockCheckAnomalies,
  mockGetWeekStart,
} = vi.hoisted(() => ({
  mockTryLogBadgeCount: vi.fn().mockResolvedValue(true),
  mockCheckAndAwardBadge: vi.fn().mockResolvedValue(null),
  mockCheckAnomalies: vi.fn().mockResolvedValue(undefined),
  mockGetWeekStart: vi.fn().mockReturnValue("2026-06-08"),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => mockCreateAdminClient(),
  createAuthenticatedClient: async (...args: unknown[]) =>
    mockCreateAuthenticatedClient(...args),
}));

vi.mock("@/lib/badges", () => ({
  tryLogBadgeCount: (...args: unknown[]) => mockTryLogBadgeCount(...args),
  checkAndAwardBadge: (...args: unknown[]) => mockCheckAndAwardBadge(...args),
  checkAnomalies: (...args: unknown[]) => mockCheckAnomalies(...args),
  getWeekStart: () => mockGetWeekStart(),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const SHOP_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const USER_ID = "bbbbbbbb-0000-0000-0000-000000000001";

function makeRequest(
  body: Record<string, unknown>,
  shopId = SHOP_ID,
): [NextRequest, { params: Promise<{ id: string }> }] {
  return [
    new NextRequest(
      new URL(`http://localhost/api/shops/${shopId}/quick-report`),
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      },
    ),
    { params: Promise.resolve({ id: shopId }) },
  ];
}

interface AdminClientOptions {
  shop?: { id: string; lat: number; lng: number } | null;
  profile?: { role: string; contribution_count: number } | null;
  insertError?: { code?: string; message?: string } | null;
}

/**
 * Builds a Supabase admin client mock where the same table can be called
 * multiple times (tracked by call index per table).
 *
 * Call order per table:
 *   shops:             [0] select+maybeSingle
 *   user_profiles:     [0] select+maybeSingle
 *   shop_quick_reports:[0] insert
 */
function makeAdminClientMock({
  shop = { id: SHOP_ID, lat: 37.5, lng: 127.0 },
  profile = { role: "user", contribution_count: 0 },
  insertError = null,
}: AdminClientOptions = {}) {
  const shopsChains = [
    // call 0 — initial select
    {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: shop }),
    },
  ];

  const profilesChains = [
    // call 0 — initial select
    {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: profile }),
    },
  ];

  const qrInsertMock = vi.fn().mockResolvedValue({ error: insertError });

  const qrChains = [
    // call 0 — insert
    { insert: qrInsertMock },
  ];

  const callCounts: Record<string, number> = {};
  const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });

  const supabase = {
    from: vi.fn().mockImplementation((table: string) => {
      callCounts[table] = (callCounts[table] ?? 0) + 1;
      const idx = callCounts[table] - 1;

      if (table === "shops") return shopsChains[idx] ?? {};
      if (table === "user_profiles") return profilesChains[idx] ?? {};
      if (table === "shop_quick_reports") return qrChains[idx] ?? {};
      return {};
    }),
    rpc: rpcMock,
    _mocks: { qrInsertMock, rpcMock },
  };

  return supabase;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("POST /api/shops/[id]/quick-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockHaversine.mockReturnValue(100); // within 500m by default
    mockTryLogBadgeCount.mockResolvedValue(true);
    mockCheckAndAwardBadge.mockResolvedValue(null);
    mockCheckAnomalies.mockResolvedValue(undefined);
    mockGetWeekStart.mockReturnValue("2026-06-08");
  });

  it("비로그인 시 401 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: null });

    const { POST } = await import("../route");
    const [req, ctx] = makeRequest({
      kind: "gacha_present",
      user_lat: 37.5,
      user_lng: 127.0,
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(401);
  });

  it("kind 미전달 시 400 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: { id: USER_ID } });
    mockCreateAdminClient.mockReturnValue(makeAdminClientMock());

    const { POST } = await import("../route");
    const [req, ctx] = makeRequest({
      kind: "invalid_kind",
      user_lat: 37.5,
      user_lng: 127.0,
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("user_lat/user_lng 미전달 시 400 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: { id: USER_ID } });
    mockCreateAdminClient.mockReturnValue(makeAdminClientMock());

    const { POST } = await import("../route");
    const [req, ctx] = makeRequest({ kind: "gacha_present" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("샵이 없으면 404 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: { id: USER_ID } });
    mockCreateAdminClient.mockReturnValue(makeAdminClientMock({ shop: null }));

    const { POST } = await import("../route");
    const [req, ctx] = makeRequest({
      kind: "gacha_present",
      user_lat: 37.5,
      user_lng: 127.0,
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  it("500m 초과 시 일반 유저 → 403 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: { id: USER_ID } });
    mockCreateAdminClient.mockReturnValue(
      makeAdminClientMock({ profile: { role: "user", contribution_count: 0 } }),
    );
    mockHaversine.mockReturnValue(600); // 600m — too far

    const { POST } = await import("../route");
    const [req, ctx] = makeRequest({
      kind: "gacha_present",
      user_lat: 37.5,
      user_lng: 127.0,
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.distance_m).toBeDefined();
  });

  it("어드민은 500m 초과해도 403 미발생", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: { id: USER_ID } });
    mockCreateAdminClient.mockReturnValue(
      makeAdminClientMock({
        profile: { role: "admin", contribution_count: 5 },
      }),
    );
    mockHaversine.mockReturnValue(9999); // far away

    const { POST } = await import("../route");
    const [req, ctx] = makeRequest({
      kind: "gacha_present",
      user_lat: 0,
      user_lng: 0,
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
  });

  it("중복 제보 시 409 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: { id: USER_ID } });
    mockCreateAdminClient.mockReturnValue(
      makeAdminClientMock({
        insertError: { code: "23505", message: "duplicate" },
      }),
    );

    const { POST } = await import("../route");
    const [req, ctx] = makeRequest({
      kind: "gacha_present",
      user_lat: 37.5,
      user_lng: 127.0,
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(409);
  });

  it("gacha_present 성공 → 200, badge 처리 실행", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: { id: USER_ID } });
    const clientMock = makeAdminClientMock({
      profile: { role: "user", contribution_count: 2 },
    });
    mockCreateAdminClient.mockReturnValue(
      clientMock,
    );

    const { POST } = await import("../route");
    const [req, ctx] = makeRequest({
      kind: "gacha_present",
      user_lat: 37.5,
      user_lng: 127.0,
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.new_badge).toBeNull();
    expect(mockTryLogBadgeCount).toHaveBeenCalledWith(
      clientMock,
      USER_ID,
      SHOP_ID,
      "quick_report",
    );
    expect(mockCheckAndAwardBadge).toHaveBeenCalledWith(
      clientMock,
      USER_ID,
      "quick_report",
    );
    expect(mockCheckAnomalies).toHaveBeenCalledWith(
      clientMock,
      USER_ID,
      "quick_report",
    );
  });

  it("gacha_absent 성공 → auto-hide RPC 호출", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: { id: USER_ID } });
    const clientMock = makeAdminClientMock();
    mockCreateAdminClient.mockReturnValue(clientMock);

    const { POST } = await import("../route");
    const [req, ctx] = makeRequest({
      kind: "gacha_absent",
      user_lat: 37.5,
      user_lng: 127.0,
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    expect(clientMock._mocks.rpcMock).toHaveBeenCalledWith(
      "auto_hide_shop_if_absent",
      { p_shop_id: SHOP_ID },
    );
  });

  it("gacha_absent 성공 시 새 뱃지가 있으면 응답에 포함한다", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: { id: USER_ID } });
    const clientMock = makeAdminClientMock();
    mockCreateAdminClient.mockReturnValue(clientMock);
    mockCheckAndAwardBadge.mockResolvedValue({
      id: "badge-1",
      name: "제보자",
      icon_url: "/badge.png",
    });

    const { POST } = await import("../route");
    const [req, ctx] = makeRequest({
      kind: "gacha_absent",
      user_lat: 37.5,
      user_lng: 127.0,
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      new_badge: {
        id: "badge-1",
        name: "제보자",
        icon_url: "/badge.png",
      },
    });
  });

  it("gacha_present는 자동 숨김 로직 실행하지 않음", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: { id: USER_ID } });
    const clientMock = makeAdminClientMock();
    mockCreateAdminClient.mockReturnValue(clientMock);

    const { POST } = await import("../route");
    const [req, ctx] = makeRequest({
      kind: "gacha_present",
      user_lat: 37.5,
      user_lng: 127.0,
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    expect(clientMock._mocks.rpcMock).not.toHaveBeenCalled();
  });

  it("badge count 중복이면 뱃지/이상징후 검사를 실행하지 않는다", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: { id: USER_ID } });
    const clientMock = makeAdminClientMock();
    mockCreateAdminClient.mockReturnValue(clientMock);
    mockTryLogBadgeCount.mockResolvedValue(false);

    const { POST } = await import("../route");
    const [req, ctx] = makeRequest({
      kind: "gacha_present",
      user_lat: 37.5,
      user_lng: 127.0,
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    expect(mockCheckAndAwardBadge).not.toHaveBeenCalled();
    expect(mockCheckAnomalies).not.toHaveBeenCalled();
  });
});
