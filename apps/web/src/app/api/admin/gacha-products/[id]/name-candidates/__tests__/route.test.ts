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

const mockCandidate = {
  id: "cand-1",
  product_id: "prod-1",
  name: "테스트명",
  normalized_name: "테스트명",
  locale: "ko",
  source_type: "admin",
  source_name: "admin",
  source_url: null,
  source_product_key: null,
  confidence: null,
  status: "pending",
  is_primary: false,
  reviewed_by: null,
  reviewed_at: null,
  created_at: "2024-01-01T00:00:00Z",
};

const mockParams = { params: Promise.resolve({ id: "prod-1" }) };

function makeGetRequest() {
  return new NextRequest(
    "http://localhost/api/admin/gacha-products/prod-1/name-candidates",
    {
      headers: { authorization: "Bearer valid-token" },
    },
  );
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest(
    "http://localhost/api/admin/gacha-products/prod-1/name-candidates",
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

describe("GET /api/admin/gacha-products/[id]/name-candidates", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValue({
      ok: true,
      user: { id: "admin-uid" } as never,
    });
  });

  it("후보 목록을 반환한다", async () => {
    const mock = createAdminSupabaseMock([mockCandidate], null, 1);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeGetRequest(), mockParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0].id).toBe("cand-1");
  });

  it("인증 실패 시 401을 반환한다", async () => {
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }) as never,
    });

    const { GET } = await import("../route");
    const res = await GET(makeGetRequest(), mockParams);

    expect(res.status).toBe(401);
  });
});

describe("POST /api/admin/gacha-products/[id]/name-candidates", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValue({
      ok: true,
      user: { id: "admin-uid" } as never,
    });
  });

  it("후보를 생성한다", async () => {
    const mock = createAdminSupabaseMock(mockCandidate, null, 0);
    mock._chain.upsert.mockReturnThis();
    mock._chain.select.mockReturnThis();
    mock._chain.single.mockResolvedValueOnce({
      data: mockCandidate,
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const res = await POST(makePostRequest({ name: "테스트명" }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidate.id).toBe("cand-1");
    expect(mock._chain.upsert).toHaveBeenCalled();
  });

  it("is_primary=true && status=approved 시 RPC를 호출한다", async () => {
    const approvedCandidate = {
      ...mockCandidate,
      status: "approved",
      is_primary: true,
    };
    const mock = createAdminSupabaseMock(approvedCandidate, null, 0);
    mock._chain.upsert.mockReturnThis();
    mock._chain.select.mockReturnThis();
    mock._chain.single.mockResolvedValueOnce({
      data: approvedCandidate,
      error: null,
    });
    mock.rpc.mockResolvedValueOnce({
      data: approvedCandidate,
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const res = await POST(
      makePostRequest({
        name: "테스트명",
        status: "approved",
        is_primary: true,
      }),
      mockParams,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith(
      "approve_gacha_product_name_candidate",
      {
        candidate_id: "cand-1",
        reviewer_id: "admin-uid",
      },
    );
  });

  it("name이 없으면 400을 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const res = await POST(makePostRequest({}), mockParams);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid name/);
  });

  it("잘못된 source_type은 400을 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const res = await POST(
      makePostRequest({
        name: "테스트명",
        source_type: "invalid_source",
      }),
      mockParams,
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid source_type/);
  });

  it("잘못된 status는 400을 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const res = await POST(
      makePostRequest({
        name: "테스트명",
        status: "invalid_status",
      }),
      mockParams,
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid status/);
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
    const res = await POST(makePostRequest({ name: "테스트명" }), mockParams);

    expect(res.status).toBe(401);
  });
});
