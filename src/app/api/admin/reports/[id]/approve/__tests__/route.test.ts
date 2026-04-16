import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createAdminSupabaseMock } from "@/test/mocks/supabase";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

const mockCreateAdminClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  verifyAdminAuth: vi.fn(),
}));

const mockTemporalShop = {
  id: "report-1",
  name: "가챠샵 A",
  address: "서울시 강남구",
  lat: 37.5,
  lng: 127.0,
  description: "테스트",
  tags: ["피규어"],
  image_urls: [],
  shop_id: null,
  submitter_name: "홍길동",
  submitter_contact: "010-1234-5678",
  status: "approved",
  admin_note: null,
  created_at: "2024-01-01T00:00:00Z",
};

const mockNewShop = {
  id: "shop-new",
  name: "가챠샵 A",
  address: "서울시 강남구",
  lat: 37.5,
  lng: 127.0,
  tags: ["피규어"],
  is_authorized: false,
  status: "active",
  created_at: "2024-01-01T00:00:00Z",
};

const mockExistingShop = {
  id: "shop-existing",
  name: "기존 가챠샵",
  address: "서울시 강남구",
  lat: 37.5,
  lng: 127.0,
  tags: [],
  is_authorized: false,
  status: "active",
  created_at: "2023-01-01T00:00:00Z",
};

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(
    "http://localhost/api/admin/reports/report-1/approve",
    {
      method: "POST",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

const mockParams = { params: Promise.resolve({ id: "report-1" }) };

describe("POST /api/admin/reports/[id]/approve", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValue({
      ok: true,
      user: { id: "admin-uid" } as never,
    });
  });

  it("mode=new: 신규 샵을 생성하고 report와 shop을 반환한다", async () => {
    // from() calls: fetch temporal_shop → insert shop → update temporal_shop → fetch updated
    let callCount = 0;
    const mock = createAdminSupabaseMock(null, null, 0);
    mock.from = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // fetch temporal shop
        return {
          ...mock._chain,
          single: vi
            .fn()
            .mockResolvedValue({ data: mockTemporalShop, error: null }),
        };
      }
      if (callCount === 2) {
        // insert new shop
        return {
          ...mock._chain,
          single: vi.fn().mockResolvedValue({ data: mockNewShop, error: null }),
        };
      }
      if (callCount === 3) {
        // update temporal_shop status
        return {
          ...mock._chain,
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      // fetch updated temporal shop
      return {
        ...mock._chain,
        single: vi
          .fn()
          .mockResolvedValue({ data: mockTemporalShop, error: null }),
      };
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ mode: "new" }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.report).toBeDefined();
    expect(body.shop).toBeDefined();
  });

  it("mode=link: 기존 샵에 연결하고 is_authorized=true로 업데이트한다", async () => {
    let callCount = 0;
    const mock = createAdminSupabaseMock(null, null, 0);
    mock.from = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // fetch temporal shop
        return {
          ...mock._chain,
          single: vi
            .fn()
            .mockResolvedValue({ data: mockTemporalShop, error: null }),
        };
      }
      if (callCount === 2) {
        // verify existing shop
        return {
          ...mock._chain,
          single: vi
            .fn()
            .mockResolvedValue({ data: mockExistingShop, error: null }),
        };
      }
      if (callCount === 3) {
        // update shop is_authorized
        return {
          ...mock._chain,
          single: vi.fn().mockResolvedValue({
            data: { ...mockExistingShop, is_authorized: true },
            error: null,
          }),
        };
      }
      if (callCount === 4) {
        // update temporal_shop
        return {
          ...mock._chain,
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      // fetch updated temporal shop
      return {
        ...mock._chain,
        single: vi
          .fn()
          .mockResolvedValue({ data: mockTemporalShop, error: null }),
      };
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({ mode: "link", shopId: "shop-existing" }),
      mockParams,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.report).toBeDefined();
    expect(body.shop).toBeDefined();
  });

  it("인증 실패 시 401을 반환한다", async () => {
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }) as never,
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ mode: "new" }), mockParams);

    expect(res.status).toBe(401);
  });

  it("유효하지 않은 mode는 400을 반환한다", async () => {
    const mock = createAdminSupabaseMock(mockTemporalShop, null, 1);
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ mode: "invalid" }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid mode/);
  });

  it("mode=link에서 shopId가 없으면 400을 반환한다", async () => {
    const mock = createAdminSupabaseMock(mockTemporalShop, null, 1);
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ mode: "link" }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/shopId/);
  });

  it("제보를 찾을 수 없으면 404를 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mock.from = vi.fn().mockReturnValue({
      ...mock._chain,
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Not found", code: "PGRST116" },
      }),
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ mode: "new" }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });
});
