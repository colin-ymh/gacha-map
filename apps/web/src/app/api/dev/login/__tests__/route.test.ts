import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createAdminSupabaseMock } from "@/test/mocks/supabase";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

const mockCreateAdminClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

const mockVerifyOtp = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: { verifyOtp: mockVerifyOtp },
  }),
}));

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/dev/login");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

describe("GET /api/dev/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("NODE_ENV=production 이면 404를 반환한다", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const { GET } = await import("../route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(404);
  });

  it("유저를 찾아 매직링크로 로그인 리다이렉트한다", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const mock = createAdminSupabaseMock({ id: "user-1" }, null, 0);
    mock.auth.admin.getUserById.mockResolvedValueOnce({
      data: { user: { email: "test@example.com" } },
      error: null,
    });
    mock.auth.admin.generateLink.mockResolvedValueOnce({
      data: { properties: { hashed_token: "mock-token-123" } },
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(mock);
    mockVerifyOtp.mockResolvedValueOnce({ error: null });

    const { GET } = await import("../route");
    const res = await GET(makeRequest());

    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("location")).toContain("/");
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      token_hash: "mock-token-123",
      type: "magiclink",
    });
  });

  it("admin 롤이면 /admin/shops 로 리다이렉트한다", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const mock = createAdminSupabaseMock({ id: "admin-1" }, null, 0);
    mock.auth.admin.getUserById.mockResolvedValueOnce({
      data: { user: { email: "admin@example.com" } },
      error: null,
    });
    mock.auth.admin.generateLink.mockResolvedValueOnce({
      data: { properties: { hashed_token: "admin-token" } },
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(mock);
    mockVerifyOtp.mockResolvedValueOnce({ error: null });

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ role: "admin" }));

    expect(res.headers.get("location")).toContain("/admin/shops");
  });

  it("유저 프로필이 없으면 404를 반환한다", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const mock = createAdminSupabaseMock(null, { message: "No rows found" }, 0);
    mock._chain.single.mockResolvedValueOnce({
      data: null,
      error: { message: "No rows found" },
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("user");
  });

  it("유저에게 이메일이 없으면 500을 반환한다", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const mock = createAdminSupabaseMock({ id: "user-1" }, null, 0);
    mock.auth.admin.getUserById.mockResolvedValueOnce({
      data: { user: { email: null } },
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
  });

  it("generateLink 실패 시 500을 반환한다", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const mock = createAdminSupabaseMock({ id: "user-1" }, null, 0);
    mock.auth.admin.getUserById.mockResolvedValueOnce({
      data: { user: { email: "test@example.com" } },
      error: null,
    });
    mock.auth.admin.generateLink.mockResolvedValueOnce({
      data: { properties: {} },
      error: { message: "Failed to generate link" },
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
  });

  it("verifyOtp 실패 시 500을 반환한다", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const mock = createAdminSupabaseMock({ id: "user-1" }, null, 0);
    mock.auth.admin.getUserById.mockResolvedValueOnce({
      data: { user: { email: "test@example.com" } },
      error: null,
    });
    mock.auth.admin.generateLink.mockResolvedValueOnce({
      data: { properties: { hashed_token: "token" } },
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(mock);
    mockVerifyOtp.mockResolvedValueOnce({
      error: { message: "Token expired" },
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
  });
});
