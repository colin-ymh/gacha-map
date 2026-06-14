import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockCreateUser = vi.fn();
const mockListUsers = vi.fn();
const mockGenerateLink = vi.fn();
const mockVerifyOtp = vi.fn();
const mockAdminClient = {
  auth: {
    admin: {
      createUser: mockCreateUser,
      listUsers: mockListUsers,
      generateLink: mockGenerateLink,
    },
  },
};
const mockServerClient = {
  auth: {
    verifyOtp: mockVerifyOtp,
  },
};

function makeRequest(url: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(new URL(url));
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  return req;
}

function makeState(returnUrl?: string) {
  const nonce = "abc";
  return returnUrl
    ? `${nonce}.${Buffer.from(returnUrl).toString("base64url")}`
    : nonce;
}

function makeCallbackRequest(returnUrl?: string) {
  const state = makeState(returnUrl);
  return makeRequest(
    `http://localhost/api/auth/kakao/callback?code=authcode&state=${encodeURIComponent(state)}`,
    { oauth_state: state },
  );
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
        hashed_token: "hashed-token",
      },
    },
    error: null,
  });
  mockVerifyOtp.mockResolvedValue({
    data: {
      session: {
        access_token: "access-token",
        refresh_token: "refresh-token",
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
    vi.mocked(createClient).mockResolvedValue(mockServerClient as never);
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
  it("정상 플로우: 기본 returnUrl로 리다이렉트한다", async () => {
    setupKakaoApiMocks();
    const { GET } = await import("../route");
    const res = await GET(makeCallbackRequest());
    expect(res.status).toBe(307);
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      token_hash: "hashed-token",
      type: "email",
    });
    expect(res.headers.get("location")).toBe("http://localhost/");
  });

  it("state에 returnUrl이 있으면 generateLink redirectTo에 반영한다", async () => {
    setupKakaoApiMocks();
    const { GET } = await import("../route");
    await GET(makeCallbackRequest("/ko/report"));
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { redirectTo: "http://localhost/ko/report" },
      }),
    );
  });

  it("앱 딥링크 returnUrl이면 hash fragment에 세션 토큰을 담아 리다이렉트한다", async () => {
    setupKakaoApiMocks();
    const { GET } = await import("../route");
    const res = await GET(makeCallbackRequest("gacha-map://auth/callback"));
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { redirectTo: "gacha-map://auth/callback" },
      }),
    );
    expect(res.headers.get("location")).toBe(
      "gacha-map://auth/callback#access_token=access-token&refresh_token=refresh-token",
    );
  });

  it("외부 도메인 returnUrl은 '/'로 기본 처리한다", async () => {
    setupKakaoApiMocks();
    const { GET } = await import("../route");
    await GET(makeCallbackRequest("https://evil.com/path"));
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
