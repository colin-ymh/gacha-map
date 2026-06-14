import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockExchangeCodeForSession = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  }),
}));

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/auth/callback");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

describe("GET /api/auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("code가 있으면 세션을 교환하고 / 로 리다이렉트한다", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({ error: null });

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ code: "auth-code-123" }));

    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("location")).toContain("/");
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("auth-code-123");
  });

  it("code가 없으면 /login?error=missing_code 로 리다이렉트한다", async () => {
    const { GET } = await import("../route");
    const res = await GET(makeRequest());

    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("location")).toContain("/login?error=missing_code");
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("exchangeCodeForSession 실패 시 /login?error=exchange_failed 로 리다이렉트한다", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      error: { message: "Token invalid" },
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ code: "bad-code" }));

    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("location")).toContain(
      "/login?error=exchange_failed",
    );
  });

  it("next 파라미터가 있고 안전하면 해당 경로로 리다이렉트한다", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({ error: null });

    const { GET } = await import("../route");
    const res = await GET(
      makeRequest({ code: "code-123", next: "http://localhost/maps" }),
    );

    expect(res.headers.get("location")).toContain("/maps");
  });

  it("next 파라미터가 외부 도메인이면 / 로 리다이렉트한다", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({ error: null });

    const { GET } = await import("../route");
    const res = await GET(
      makeRequest({ code: "code-123", next: "http://evil.com/attack" }),
    );

    expect(res.headers.get("location")).toContain("/");
    expect(res.headers.get("location")).not.toContain("evil.com");
  });
});
