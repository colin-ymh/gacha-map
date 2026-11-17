import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createSupabaseMock,
  createAdminSupabaseMock,
} from "@/test/mocks/supabase";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

const mockCreateAuthenticatedClient = vi.fn();
const mockCreateAdminClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAuthenticatedClient: () => mockCreateAuthenticatedClient(),
  createAdminClient: () => mockCreateAdminClient(),
}));

const mockParams = { params: Promise.resolve({ id: "app-1" }) };

function deleteRequest() {
  return new NextRequest("http://localhost/api/shop-applications/app-1", {
    method: "DELETE",
    headers: { authorization: "Bearer tok" },
  });
}

describe("DELETE /api/shop-applications/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("본인의 pending 신청을 cancelled로 바꾼다", async () => {
    const adminMock = createAdminSupabaseMock(null);
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: adminMock,
      user: { id: "user-1" },
    });
    mockCreateAdminClient.mockReturnValue(adminMock);
    adminMock._chain.single.mockResolvedValueOnce({
      data: { id: "app-1", status: "cancelled" },
      error: null,
    });

    const { DELETE } = await import("../route");
    const res = await DELETE(deleteRequest(), mockParams);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "app-1", status: "cancelled" });
    // status 외의 컬럼은 절대 건드리지 않는다
    expect(adminMock._chain.update).toHaveBeenCalledWith({
      status: "cancelled",
    });
    // 본인 + pending 조건이 모두 걸려 있어야 한다
    expect(adminMock._chain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(adminMock._chain.eq).toHaveBeenCalledWith("status", "pending");
  });

  it("남의 신청이거나 이미 처리된 신청이면 404", async () => {
    const adminMock = createAdminSupabaseMock(null);
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: adminMock,
      user: { id: "user-1" },
    });
    mockCreateAdminClient.mockReturnValue(adminMock);
    adminMock._chain.single.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });

    const { DELETE } = await import("../route");
    const res = await DELETE(deleteRequest(), mockParams);

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("not_cancellable");
  });

  it("인증 없으면 401", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: createSupabaseMock(null),
      user: null,
    });

    const { DELETE } = await import("../route");
    const res = await DELETE(deleteRequest(), mockParams);

    expect(res.status).toBe(401);
  });
});
