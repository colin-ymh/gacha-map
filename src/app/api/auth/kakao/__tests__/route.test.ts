import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>();
  return {
    ...actual,
    randomBytes: vi.fn(() => Buffer.from("deadbeef00112233", "hex")),
  };
});

function makeRequest(url: string) {
  return new NextRequest(new URL(url));
}

describe("GET /api/auth/kakao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.KAKAO_CLIENT_ID = "test-kakao-client-id";
  });

  it("KAKAO_CLIENT_ID 미설정 시 503을 반환한다", async () => {
    delete process.env.KAKAO_CLIENT_ID;
    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/auth/kakao"));
    expect(res.status).toBe(503);
  });

  it("정상 요청 시 카카오 OAuth URL로 리다이렉트한다", async () => {
    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/auth/kakao"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("https://kauth.kakao.com/oauth/authorize");
    expect(location).toContain("client_id=test-kakao-client-id");
  });

  it("oauth_state 쿠키를 설정한다", async () => {
    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/auth/kakao"));
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("oauth_state=");
  });

  it("유효한 returnUrl이 있으면 oauth_return_url 쿠키를 설정한다", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      makeRequest("http://localhost/api/auth/kakao?returnUrl=%2Fko%2Freport"),
    );
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("oauth_return_url=");
  });

  it("외부 도메인 returnUrl은 쿠키에 저장하지 않는다", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      makeRequest(
        "http://localhost/api/auth/kakao?returnUrl=https%3A%2F%2Fevil.com",
      ),
    );
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).not.toContain("oauth_return_url=");
  });
});
