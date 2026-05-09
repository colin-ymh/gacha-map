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

const mockReport = {
  id: "report-1",
  status: "reviewed",
};

function makeRequest() {
  return new NextRequest(
    "http://localhost/api/admin/reports/report-1/approve",
    {
      method: "POST",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
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

  it("정상 승인 시 reviewed 상태의 report를 반환한다", async () => {
    const mock = createAdminSupabaseMock(mockReport, null, 1);
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const res = await POST(makeRequest(), mockParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.report).toBeDefined();
    expect(mock._chain.update).toHaveBeenCalledWith({ status: "reviewed" });
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
    const res = await POST(makeRequest(), mockParams);

    expect(res.status).toBe(401);
  });

  it("제보를 찾을 수 없으면 404를 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, {
      message: "Not found",
      code: "PGRST116",
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const res = await POST(makeRequest(), mockParams);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });
});
