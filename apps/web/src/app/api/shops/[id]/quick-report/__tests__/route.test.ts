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

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => mockCreateAdminClient(),
  createAuthenticatedClient: async (...args: unknown[]) =>
    mockCreateAuthenticatedClient(...args),
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
  absentCount?: number;
}

/**
 * Builds a Supabase admin client mock where the same table can be called
 * multiple times (tracked by call index per table).
 *
 * Call order per table:
 *   shops:             [0] select+maybeSingle  [1] update+eq+eq (auto-hide)
 *   user_profiles:     [0] select+maybeSingle  [1] update+eq
 *   shop_quick_reports:[0] insert              [1] select+eq+eq+gte (count)
 */
function makeAdminClientMock({
  shop = { id: SHOP_ID, lat: 37.5, lng: 127.0 },
  profile = { role: "user", contribution_count: 0 },
  insertError = null,
  absentCount = 0,
}: AdminClientOptions = {}) {
  const shopUpdateMock = vi.fn().mockReturnThis();
  const shopUpdateEqMock = vi.fn().mockReturnThis();

  const shopsChains = [
    // call 0 — initial select
    {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: shop }),
    },
    // call 1 — auto-hide update
    {
      update: shopUpdateMock,
      eq: shopUpdateEqMock,
    },
  ];

  const profileUpdateEqMock = vi.fn().mockReturnThis();

  const profilesChains = [
    // call 0 — initial select
    {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: profile }),
    },
    // call 1 — contribution count update
    {
      update: vi.fn().mockReturnThis(),
      eq: profileUpdateEqMock,
    },
  ];

  const qrInsertMock = vi.fn().mockResolvedValue({ error: insertError });
  const qrGteMock = vi.fn().mockResolvedValue({ count: absentCount });

  const qrChains = [
    // call 0 — insert
    { insert: qrInsertMock },
    // call 1 — absent count query
    {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: qrGteMock,
    },
  ];

  const callCounts: Record<string, number> = {};

  const supabase = {
    from: vi.fn().mockImplementation((table: string) => {
      callCounts[table] = (callCounts[table] ?? 0) + 1;
      const idx = callCounts[table] - 1;

      if (table === "shops") return shopsChains[idx] ?? {};
      if (table === "user_profiles") return profilesChains[idx] ?? {};
      if (table === "shop_quick_reports") return qrChains[idx] ?? {};
      return {};
    }),
    _mocks: { shopUpdateMock, shopUpdateEqMock, qrInsertMock, qrGteMock },
  };

  return supabase;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("POST /api/shops/[id]/quick-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockHaversine.mockReturnValue(100); // within 500m by default
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

  it("gacha_present 성공 → 200, contribution_count 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: { id: USER_ID } });
    mockCreateAdminClient.mockReturnValue(
      makeAdminClientMock({ profile: { role: "user", contribution_count: 2 } }),
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
    expect(json.contribution_count).toBe(3);
  });

  it("gacha_absent 제보 횟수 2회 → 자동 숨김 미발동", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: { id: USER_ID } });
    const clientMock = makeAdminClientMock({ absentCount: 2 });
    mockCreateAdminClient.mockReturnValue(clientMock);

    const { POST } = await import("../route");
    const [req, ctx] = makeRequest({
      kind: "gacha_absent",
      user_lat: 37.5,
      user_lng: 127.0,
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    // shops.update should NOT be called (auto-hide not triggered)
    expect(clientMock._mocks.shopUpdateMock).not.toHaveBeenCalled();
  });

  it("gacha_absent 제보 횟수 3회 → shops.update(hidden + auto_absent_report) 호출", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: { id: USER_ID } });
    const clientMock = makeAdminClientMock({ absentCount: 3 });
    mockCreateAdminClient.mockReturnValue(clientMock);

    const { POST } = await import("../route");
    const [req, ctx] = makeRequest({
      kind: "gacha_absent",
      user_lat: 37.5,
      user_lng: 127.0,
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    expect(clientMock._mocks.shopUpdateMock).toHaveBeenCalledWith({
      status: "hidden",
      hidden_reason: "auto_absent_report",
    });
  });

  it("gacha_present는 자동 숨김 로직 실행하지 않음", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: { id: USER_ID } });
    const clientMock = makeAdminClientMock({ absentCount: 99 });
    mockCreateAdminClient.mockReturnValue(clientMock);

    const { POST } = await import("../route");
    const [req, ctx] = makeRequest({
      kind: "gacha_present",
      user_lat: 37.5,
      user_lng: 127.0,
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    // count query never called for gacha_present
    expect(clientMock._mocks.qrGteMock).not.toHaveBeenCalled();
    expect(clientMock._mocks.shopUpdateMock).not.toHaveBeenCalled();
  });

  it("이미 hidden인 샵은 auto-hide 업데이트 eq 필터에 status=active 조건 포함", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: { id: USER_ID } });
    const clientMock = makeAdminClientMock({ absentCount: 5 });
    mockCreateAdminClient.mockReturnValue(clientMock);

    const { POST } = await import("../route");
    const [req, ctx] = makeRequest({
      kind: "gacha_absent",
      user_lat: 37.5,
      user_lng: 127.0,
    });
    await POST(req, ctx);

    // eq called with status=active guard
    expect(clientMock._mocks.shopUpdateEqMock).toHaveBeenCalledWith(
      "status",
      "active",
    );
  });
});
