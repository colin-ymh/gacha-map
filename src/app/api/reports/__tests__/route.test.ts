import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createAdminSupabaseMock } from "@/test/mocks/supabase";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

const mockUser = { id: "user-1", email: "user@test.com" };

function makeRequest(body: unknown) {
  return new NextRequest(new URL("http://localhost/api/reports"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeClientMock(
  user: typeof mockUser | null,
  insertResult: { data: unknown; error: unknown },
) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(insertResult),
  };
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn().mockReturnValue(chain),
    _chain: chain,
  };
}

describe("POST /api/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("비로그인 상태에서 401 반환", async () => {
    mockCreateClient.mockReturnValue(
      makeClientMock(null, { data: null, error: null }),
    );

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({ report_type: "other", content: "테스트 제보 내용입니다." }),
    );
    expect(res.status).toBe(401);
  });

  it("유효하지 않은 report_type이면 400 반환", async () => {
    mockCreateClient.mockReturnValue(
      makeClientMock(mockUser, { data: null, error: null }),
    );

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({
        report_type: "invalid",
        content: "테스트 제보 내용입니다.",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("content가 10자 미만이면 400 반환", async () => {
    mockCreateClient.mockReturnValue(
      makeClientMock(mockUser, { data: null, error: null }),
    );

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({ report_type: "other", content: "짧음" }),
    );
    expect(res.status).toBe(400);
  });

  it("로그인 상태에서 유효한 제보 시 201과 id 반환", async () => {
    mockCreateClient.mockReturnValue(
      makeClientMock(mockUser, { data: { id: "report-1" }, error: null }),
    );

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({ report_type: "other", content: "테스트 제보 내용입니다." }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("report-1");
  });

  it("DB 에러 시 500 반환", async () => {
    mockCreateClient.mockReturnValue(
      makeClientMock(mockUser, {
        data: null,
        error: { message: "DB error" },
      }),
    );

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({ report_type: "other", content: "테스트 제보 내용입니다." }),
    );
    expect(res.status).toBe(500);
  });
});
