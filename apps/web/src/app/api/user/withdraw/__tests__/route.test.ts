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

describe("DELETE /api/user/withdraw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("사용자 계정을 삭제한다", async () => {
    const adminMock = createAdminSupabaseMock(null);
    adminMock.auth.admin.deleteUser.mockResolvedValue({
      data: {},
      error: null,
    });

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: adminMock,
      user: { id: "user-1" },
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    const req = new NextRequest("http://localhost/api/user/withdraw", {
      method: "DELETE",
      headers: { authorization: "Bearer tok" },
    });

    const { DELETE } = await import("../route");
    const res = await DELETE(req);

    expect(res.status).toBe(200);
    expect(adminMock.auth.admin.deleteUser).toHaveBeenCalledWith("user-1");
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("인증 없으면 401", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: createSupabaseMock(null),
      user: null,
    });

    const req = new NextRequest("http://localhost/api/user/withdraw", {
      method: "DELETE",
    });

    const { DELETE } = await import("../route");
    const res = await DELETE(req);

    expect(res.status).toBe(401);
  });

  it("deleteUser 실패 시 500", async () => {
    const adminMock = createAdminSupabaseMock(null);
    adminMock.auth.admin.deleteUser.mockResolvedValue({
      data: {},
      error: { message: "Delete failed" },
    });

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: adminMock,
      user: { id: "user-1" },
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    const req = new NextRequest("http://localhost/api/user/withdraw", {
      method: "DELETE",
      headers: { authorization: "Bearer tok" },
    });

    const { DELETE } = await import("../route");
    const res = await DELETE(req);

    expect(res.status).toBe(500);
  });
});
