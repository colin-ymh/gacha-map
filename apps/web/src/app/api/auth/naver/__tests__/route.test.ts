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

describe("GET /api/auth/naver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.NAVER_CLIENT_ID = "test-naver-client-id";
  });

  it("NAVER_CLIENT_ID 미설정 시 503을 반환한다", async () => {
    delete process.env.NAVER_CLIENT_ID;
    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/auth/naver"));
    expect(res.status).toBe(503);
  });

  it("정상 요청 시 네이버 OAuth URL로 리다이렉트한다", async () => {
    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/auth/naver"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("https://nid.naver.com/oauth2.0/authorize");
    expect(location).toContain("client_id=test-naver-client-id");
  });

  it("oauth_state 쿠키를 설정한다", async () => {
    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/auth/naver"));
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("oauth_state=");
  });

  it("유효한 returnUrl이 있으면 oauth_return_url 쿠키를 설정한다", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      makeRequest("http://localhost/api/auth/naver?returnUrl=%2Fko%2Freport"),
    );
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("oauth_return_url=");
  });

  it("외부 도메인 returnUrl은 쿠키에 저장하지 않는다", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      makeRequest(
        "http://localhost/api/auth/naver?returnUrl=https%3A%2F%2Fevil.com",
      ),
    );
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).not.toContain("oauth_return_url=");
  });
});
