import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockCreateUser = vi.fn();
const mockListUsers = vi.fn();
const mockGenerateLink = vi.fn();
const mockAdminClient = {
  auth: {
    admin: {
      createUser: mockCreateUser,
      listUsers: mockListUsers,
      generateLink: mockGenerateLink,
    },
  },
};

function makeRequest(url: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(new URL(url));
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  return req;
}

function setupKakaoApiMocks(
  email = "user@kakao.com",
  nickname = "테스터",
  kakaoId = 12345,
) {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "test-token",
        token_type: "bearer",
        expires_in: 3600,
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: kakaoId,
        kakao_account: { email, profile: { nickname } },
      }),
    });
  mockCreateUser.mockResolvedValue({
    data: { user: { id: "uid-1" } },
    error: null,
  });
  mockGenerateLink.mockResolvedValue({
    data: {
      properties: {
        action_link: "https://auth.supabase.co/confirm?token=xyz",
      },
    },
    error: null,
  });
}

describe("GET /api/auth/kakao/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KAKAO_CLIENT_ID = "test-kakao-client-id";
    process.env.KAKAO_CLIENT_SECRET = "test-kakao-secret";
    vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never);
  });

  // CSRF 검증
  it("code 없을 때 login?error=invalid_state 로 리다이렉트한다", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      makeRequest("http://localhost/api/auth/kakao/callback?state=abc", {
        oauth_state: "abc",
      }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=invalid_state");
  });

  it("state 불일치 시 login?error=invalid_state 로 리다이렉트한다", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      makeRequest(
        "http://localhost/api/auth/kakao/callback?code=testcode&state=wrong",
        { oauth_state: "correct" },
      ),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=invalid_state");
  });

  it("state 쿠키 없을 때 login?error=invalid_state 로 리다이렉트한다", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      makeRequest(
        "http://localhost/api/auth/kakao/callback?code=testcode&state=abc",
      ),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=invalid_state");
  });

  // Happy path
  it("정상 플로우: magic link URL로 리다이렉트한다", async () => {
    setupKakaoApiMocks();
    const { GET } = await import("../route");
    const res = await GET(
      makeRequest(
        "http://localhost/api/auth/kakao/callback?code=authcode&state=abc",
        { oauth_state: "abc" },
      ),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("supabase.co/confirm");
  });

  it("oauth_return_url 쿠키가 있으면 generateLink redirectTo에 반영한다", async () => {
    setupKakaoApiMocks();
    const { GET } = await import("../route");
    await GET(
      makeRequest(
        "http://localhost/api/auth/kakao/callback?code=authcode&state=abc",
        { oauth_state: "abc", oauth_return_url: "/ko/report" },
      ),
    );
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { redirectTo: "http://localhost/ko/report" },
      }),
    );
  });

  it("외부 도메인 oauth_return_url은 '/'로 기본 처리한다", async () => {
    setupKakaoApiMocks();
    const { GET } = await import("../route");
    await GET(
      makeRequest(
        "http://localhost/api/auth/kakao/callback?code=authcode&state=abc",
        { oauth_state: "abc", oauth_return_url: "https://evil.com/path" },
      ),
    );
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { redirectTo: "http://localhost/" },
      }),
    );
  });

  it("Kakao 토큰 API 실패 시 login?error=kakao_failed로 리다이렉트한다", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    const { GET } = await import("../route");
    const res = await GET(
      makeRequest(
        "http://localhost/api/auth/kakao/callback?code=authcode&state=abc",
        { oauth_state: "abc" },
      ),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=kakao_failed");
  });
});
