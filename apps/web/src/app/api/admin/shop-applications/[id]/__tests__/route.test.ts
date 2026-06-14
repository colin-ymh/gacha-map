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

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/shop-applications/app-1", {
    method: "PATCH",
    headers: {
      authorization: "Bearer valid-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const mockParams = { params: Promise.resolve({ id: "app-1" }) };

describe("PATCH /api/admin/shop-applications/[id]", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValue({
      ok: true,
      user: { id: "admin-uid" } as never,
    });
  });

  it("approve action 호출 시 rpc가 호출되고 200을 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mock.rpc.mockResolvedValueOnce({
      data: { id: "app-1", status: "approved" },
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ action: "approve" }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe("app-1");
    expect(body.status).toBe("approved");
    expect(mock.rpc).toHaveBeenCalledWith("approve_shop_owner_application", {
      application_id: "app-1",
      note: null,
    });
  });

  it("reject action 호출 시 update가 호출되고 200을 반환한다", async () => {
    const mock = createAdminSupabaseMock(
      { id: "app-1", status: "rejected" },
      null,
      0,
    );
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ action: "reject" }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe("app-1");
    expect(body.status).toBe("rejected");
    expect(mock._chain.update).toHaveBeenCalledWith({
      status: "rejected",
      admin_note: null,
    });
  });

  it("잘못된 action은 400을 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ action: "invalid" }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/action must be approve or reject/);
  });

  it("approve 시 'not found' 에러는 404를 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mock.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Application not found" },
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ action: "approve" }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("approve 시 'not in pending' 에러는 409를 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mock.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Application is not in pending status" },
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ action: "approve" }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already processed/i);
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
    const res = await PATCH(makeRequest({ action: "approve" }), mockParams);

    expect(res.status).toBe(401);
  });
});
