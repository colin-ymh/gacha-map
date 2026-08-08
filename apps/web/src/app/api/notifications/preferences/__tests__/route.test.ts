import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

const { mockCreateAuthenticatedClient } = vi.hoisted(() => ({
  mockCreateAuthenticatedClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAuthenticatedClient: async (...args: unknown[]) =>
    mockCreateAuthenticatedClient(...args),
}));

const USER_ID = "user-1";

function makeGetRequest() {
  return new NextRequest(
    new URL("http://localhost/api/notifications/preferences"),
    { method: "GET" },
  );
}

function makePatchRequest(body: unknown) {
  return new NextRequest(
    new URL("http://localhost/api/notifications/preferences"),
    {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
  );
}

function makeSupabaseMock({
  selectResult = { data: null, error: null },
  insertResult = { error: null },
  updateResult = { data: null, error: null },
}: {
  selectResult?: { data: unknown; error: unknown };
  insertResult?: { error: unknown };
  updateResult?: { data: unknown; error: unknown };
} = {}) {
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(selectResult),
  };
  const insertChain = {
    insert: vi.fn().mockResolvedValue(insertResult),
  };
  const updateChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(updateResult),
  };

  return {
    from: vi.fn().mockImplementation(() => ({
      ...selectChain,
      ...insertChain,
      ...updateChain,
    })),
  };
}

describe("GET /api/notifications/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("비로그인 시 401 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: makeSupabaseMock(),
      user: null,
    });

    const { GET } = await import("../route");
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("설정 row가 없으면 gacha_bonus를 포함한 기본값을 반환한다", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: makeSupabaseMock({ selectResult: { data: null, error: null } }),
      user: { id: USER_ID },
    });

    const { GET } = await import("../route");
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.preferences.gacha_bonus).toBe(true);
    expect(json.preferences.gacha_referral_bonus).toBe(true);
  });

  it("설정 row가 있으면 그대로 반환한다", async () => {
    const row = {
      user_id: USER_ID,
      report_result: true,
      shop_owner_activity: true,
      wishlist_news: true,
      badge: true,
      shop_owner_update: true,
      wishlist_product_update: true,
      product_wishlist_restock: true,
      gacha_bonus: false,
    };
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: makeSupabaseMock({ selectResult: { data: row, error: null } }),
      user: { id: USER_ID },
    });

    const { GET } = await import("../route");
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.preferences.gacha_bonus).toBe(false);
  });
});

describe("PATCH /api/notifications/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("비로그인 시 401 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: makeSupabaseMock(),
      user: null,
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(makePatchRequest({ gacha_bonus: false }));
    expect(res.status).toBe(401);
  });

  it("유효한 boolean 필드가 없으면 400 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: makeSupabaseMock(),
      user: { id: USER_ID },
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(makePatchRequest({ unknown_key: true }));
    expect(res.status).toBe(400);
  });

  it("gacha_bonus를 갱신할 수 있다", async () => {
    const updateResult = {
      data: {
        user_id: USER_ID,
        report_result: true,
        shop_owner_activity: true,
        wishlist_news: true,
        badge: true,
        shop_owner_update: true,
        wishlist_product_update: true,
        product_wishlist_restock: true,
        gacha_bonus: false,
        gacha_referral_bonus: true,
      },
      error: null,
    };
    const supabase = makeSupabaseMock({ updateResult });
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase,
      user: { id: USER_ID },
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(makePatchRequest({ gacha_bonus: false }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.preferences.gacha_bonus).toBe(false);
  });

  it("gacha_referral_bonus를 갱신할 수 있다", async () => {
    const updateResult = {
      data: {
        user_id: USER_ID,
        report_result: true,
        shop_owner_activity: true,
        wishlist_news: true,
        badge: true,
        shop_owner_update: true,
        wishlist_product_update: true,
        product_wishlist_restock: true,
        gacha_bonus: true,
        gacha_referral_bonus: false,
      },
      error: null,
    };
    const supabase = makeSupabaseMock({ updateResult });
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase,
      user: { id: USER_ID },
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(makePatchRequest({ gacha_referral_bonus: false }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.preferences.gacha_referral_bonus).toBe(false);
  });
});
