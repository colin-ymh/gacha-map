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

const mockParams = {
  params: Promise.resolve({ id: "prod-1", candidateId: "cand-1" }),
};

function makePatchRequest(body: Record<string, unknown>) {
  return new NextRequest(
    "http://localhost/api/admin/gacha-products/prod-1/name-candidates/cand-1",
    {
      method: "PATCH",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

describe("PATCH /api/admin/gacha-products/[id]/name-candidates/[candidateId]", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValue({
      ok: true,
      user: { id: "admin-uid" } as never,
    });
  });

  it("approve(status=approved) 시 maybeSingle으로 존재 확인 후 RPC를 호출한다", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mock._chain.maybeSingle.mockResolvedValueOnce({
      data: { id: "cand-1" },
      error: null,
    });
    mock.rpc.mockResolvedValueOnce({
      data: { ...mockCandidate, status: "approved" },
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(
      makePatchRequest({ status: "approved" }),
      mockParams,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidate.status).toBe("approved");
    expect(mock.rpc).toHaveBeenCalledWith(
      "approve_gacha_product_name_candidate",
      {
        candidate_id: "cand-1",
        reviewer_id: "admin-uid",
      },
    );
  });

  it("is_primary=true 시 RPC를 호출한다", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mock._chain.maybeSingle.mockResolvedValueOnce({
      data: { id: "cand-1" },
      error: null,
    });
    mock.rpc.mockResolvedValueOnce({
      data: { ...mockCandidate, is_primary: true },
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makePatchRequest({ is_primary: true }), mockParams);
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

  it("approve 경로에서 후보를 찾을 수 없으면 404를 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mock._chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(
      makePatchRequest({ status: "approved" }),
      mockParams,
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("이름 업데이트만 수행한다", async () => {
    const mock = createAdminSupabaseMock(
      { ...mockCandidate, name: "새이름", normalized_name: "새이름" },
      null,
      0,
    );
    mock._chain.maybeSingle.mockResolvedValueOnce({
      data: { is_primary: false },
      error: null,
    });
    mock._chain.update.mockReturnThis();
    mock._chain.select.mockReturnThis();
    mock._chain.single.mockResolvedValueOnce({
      data: { ...mockCandidate, name: "새이름", normalized_name: "새이름" },
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makePatchRequest({ name: "새이름" }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidate.name).toBe("새이름");
  });

  it("status=rejected로 업데이트한다", async () => {
    const mock = createAdminSupabaseMock(
      { ...mockCandidate, status: "rejected" },
      null,
      0,
    );
    mock._chain.update.mockReturnThis();
    mock._chain.select.mockReturnThis();
    mock._chain.single.mockResolvedValueOnce({
      data: { ...mockCandidate, status: "rejected" },
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(
      makePatchRequest({ status: "rejected" }),
      mockParams,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidate.status).toBe("rejected");
    expect(mock._chain.update).toHaveBeenCalled();
  });

  it("name과 status 둘 다 없으면 400을 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makePatchRequest({}), mockParams);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/At least one editable field/);
  });

  it("잘못된 status 값은 400을 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(
      makePatchRequest({ status: "invalid_status" }),
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

    const { PATCH } = await import("../route");
    const res = await PATCH(
      makePatchRequest({ status: "rejected" }),
      mockParams,
    );

    expect(res.status).toBe(401);
  });
});
