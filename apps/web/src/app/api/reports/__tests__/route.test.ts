import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

const { mockCreateClient, mockCreateAdminClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockCreateAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
  createAdminClient: () => mockCreateAdminClient(),
}));

const mockUser = { id: "user-1", email: "user@test.com" };

function makeRequest(body: unknown, ip = "203.0.113.10") {
  return new NextRequest(new URL("http://localhost/api/reports"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
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

  it("비로그인 상태에서도 유효한 제보를 생성한다", async () => {
    mockCreateClient.mockReturnValue(
      makeClientMock(null, { data: null, error: null }),
    );
    mockCreateAdminClient.mockReturnValue(
      makeClientMock(null, { data: { id: "report-1" }, error: null }),
    );

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({ report_type: "other", content: "테스트 제보 내용입니다." }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("report-1");
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

  it("shop_id가 UUID 형식이 아니면 400 반환", async () => {
    mockCreateClient.mockReturnValue(
      makeClientMock(mockUser, { data: null, error: null }),
    );

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({
        report_type: "fix_info",
        content: "테스트 제보 내용입니다.",
        shop_id: "not-a-uuid",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/shop_id/);
  });

  it("익명 제보자 이름과 연락처를 저장한다", async () => {
    const adminMock = makeClientMock(null, {
      data: { id: "report-1" },
      error: null,
    });
    mockCreateClient.mockReturnValue(
      makeClientMock(null, { data: null, error: null }),
    );
    mockCreateAdminClient.mockReturnValue(adminMock);

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({
        report_type: "other",
        content: "테스트 제보 내용입니다.",
        reporter_name: " 홍길동 ",
        reporter_contact: " test@example.com ",
      }),
    );

    expect(res.status).toBe(201);
    expect(adminMock._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        reporter_name: "홍길동",
        reporter_contact: "test@example.com",
      }),
    );
  });

  it("reporter_contact가 100자를 초과하면 400 반환", async () => {
    mockCreateClient.mockReturnValue(
      makeClientMock(null, { data: null, error: null }),
    );

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({
        report_type: "other",
        content: "테스트 제보 내용입니다.",
        reporter_contact: "a".repeat(101),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("로그인 상태에서 유효한 제보 시 201과 id 반환", async () => {
    mockCreateClient.mockReturnValue(
      makeClientMock(mockUser, { data: { id: "report-1" }, error: null }),
    );
    mockCreateAdminClient.mockReturnValue(
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
    mockCreateAdminClient.mockReturnValue(
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

  it("같은 IP에서 제한 횟수를 초과하면 429 반환", async () => {
    mockCreateClient.mockReturnValue(
      makeClientMock(null, { data: null, error: null }),
    );
    mockCreateAdminClient.mockReturnValue(
      makeClientMock(null, { data: { id: "report-1" }, error: null }),
    );

    const { POST } = await import("../route");
    const body = { report_type: "other", content: "테스트 제보 내용입니다." };

    for (let i = 0; i < 5; i += 1) {
      const res = await POST(makeRequest(body, "198.51.100.20"));
      expect(res.status).toBe(201);
    }

    const limited = await POST(makeRequest(body, "198.51.100.20"));
    expect(limited.status).toBe(429);
  });
});
