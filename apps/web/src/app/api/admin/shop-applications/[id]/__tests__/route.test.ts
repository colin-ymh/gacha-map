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
      force: false,
    });
  });

  it("force: true를 전달하면 RPC에 그대로 넘긴다 (중복 샵 경고 오버라이드)", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mock.rpc.mockResolvedValueOnce({ data: null, error: null });
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    await PATCH(makeRequest({ action: "approve", force: true }), mockParams);

    expect(mock.rpc).toHaveBeenCalledWith("approve_shop_owner_application", {
      application_id: "app-1",
      note: null,
      force: true,
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

  // RPC가 던지는 식별자는 마이그레이션의 RAISE EXCEPTION 문자열과 1:1이다.
  // (supabase/migrations/20260824_shop_application_hardening.sql)
  it.each([
    ["application_not_found", 404, "application_not_found"],
    ["application_not_pending", 409, "application_not_pending"],
    ["shop_already_owned", 409, "shop_already_owned"],
    ["missing_coordinates", 400, "missing_coordinates"],
    ["possible_duplicate_shop", 409, "possible_duplicate_shop"],
    ["shop_not_active", 400, "shop_not_active"],
    ["shop_not_found", 404, "shop_not_found"],
  ])(
    "approve 시 RPC 예외 %s 는 %i 로 매핑된다",
    async (rpcMessage, status, code) => {
      const mock = createAdminSupabaseMock(null, null, 0);
      mock.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: `${rpcMessage}` },
      });
      mockCreateAdminClient.mockReturnValue(mock);

      const { PATCH } = await import("../route");
      const res = await PATCH(makeRequest({ action: "approve" }), mockParams);
      const body = await res.json();

      expect(res.status).toBe(status);
      expect(body.code).toBe(code);
    },
  );

  it("매핑되지 않은 RPC 에러는 500 server_error", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mock.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "connection reset by peer" },
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ action: "approve" }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("server_error");
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
