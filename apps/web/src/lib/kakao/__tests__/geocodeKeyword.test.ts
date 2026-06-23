import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { geocodeKeyword } from "../geocodeKeyword";

const MOCK_KEY = "test-kakao-key";

function mockFetchResponse(body: unknown, status = 200) {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status }),
  );
}

describe("geocodeKeyword", () => {
  beforeEach(() => {
    process.env.KAKAO_REST_API_KEY = MOCK_KEY;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    delete process.env.KAKAO_REST_API_KEY;
    vi.unstubAllGlobals();
  });

  it("유효한 응답이면 lat/lng를 반환한다", async () => {
    mockFetchResponse({ documents: [{ x: "126.9234", y: "37.5082" }] });

    const result = await geocodeKeyword("신도림");
    expect(result).toEqual({ lat: 37.5082, lng: 126.9234 });
  });

  it("documents가 비어있으면 null을 반환한다", async () => {
    mockFetchResponse({ documents: [] });

    const result = await geocodeKeyword("없는지역xyz");
    expect(result).toBeNull();
  });

  it("좌표가 숫자로 파싱되지 않으면 null을 반환한다", async () => {
    mockFetchResponse({ documents: [{ x: "invalid", y: "invalid" }] });

    const result = await geocodeKeyword("테스트");
    expect(result).toBeNull();
  });

  it("API key가 없으면 fetch를 호출하지 않고 null을 반환한다", async () => {
    delete process.env.KAKAO_REST_API_KEY;

    const result = await geocodeKeyword("신도림");

    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("HTTP 응답이 ok가 아니면 null을 반환한다", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }));

    const result = await geocodeKeyword("신도림");
    expect(result).toBeNull();
  });

  it("fetch가 네트워크 오류를 throw하면 null을 반환한다", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network error"));

    const result = await geocodeKeyword("신도림");
    expect(result).toBeNull();
  });

  it("올바른 Authorization 헤더와 keyword API URL로 호출한다", async () => {
    mockFetchResponse({ documents: [] });

    await geocodeKeyword("홍대입구");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "dapi.kakao.com/v2/local/search/keyword.json?query=",
      ),
      expect.objectContaining({
        headers: { Authorization: `KakaoAK ${MOCK_KEY}` },
      }),
    );
  });

  it("쿼리가 URL 인코딩되어 전달된다", async () => {
    mockFetchResponse({ documents: [] });

    await geocodeKeyword("신도림 역");

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url as string).toContain(encodeURIComponent("신도림 역"));
  });
});
