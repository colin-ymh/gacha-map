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
  name: "가챠샵 A",
  address: "서울시 강남구",
  lat: 37.5,
  lng: 127.0,
  description: "테스트",
  shop_id: null,
  submitter_name: "홍길동",
  submitter_contact: "010-1234-5678",
  status: "resolved",
  created_at: "2024-01-01T00:00:00Z",
};

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/reports/report-1/reject", {
    method: "POST",
    headers: {
      authorization: "Bearer valid-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const mockParams = { params: Promise.resolve({ id: "report-1" }) };

describe("POST /api/admin/reports/[id]/reject", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValue({
      ok: true,
      user: { id: "admin-uid" } as never,
    });
  });

  it("정상 처리 완료 시 report를 반환한다", async () => {
    const mock = createAdminSupabaseMock(mockReport, null, 1);
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({ adminNote: "중복 제보입니다." }),
      mockParams,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.report).toBeDefined();
    expect(mock._chain.update).toHaveBeenCalledWith({
      status: "resolved",
    });
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
    const res = await POST(makeRequest({ adminNote: "거부 사유" }), mockParams);

    expect(res.status).toBe(401);
  });

  it("adminNote가 없어도 처리 완료할 수 있다", async () => {
    const mock = createAdminSupabaseMock(mockReport, null, 1);
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({}), mockParams);

    expect(res.status).toBe(200);
  });

  it("adminNote가 문자열이 아니어도 처리 완료할 수 있다", async () => {
    const mock = createAdminSupabaseMock(mockReport, null, 1);
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ adminNote: 123 }), mockParams);

    expect(res.status).toBe(200);
  });

  it("제보를 찾을 수 없으면 404를 반환한다", async () => {
    const mock = createAdminSupabaseMock(
      null,
      { message: "Not found", code: "PGRST116" },
      0,
    );
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ adminNote: "거부 사유" }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("Supabase 에러 시 500을 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, { message: "DB error" }, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ adminNote: "거부 사유" }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("DB error");
  });
});
