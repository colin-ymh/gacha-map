import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createAdminSupabaseMock } from "@/test/mocks/supabase";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

const mockCreateAuthenticatedClient = vi.fn();
const mockCreateAdminClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAuthenticatedClient: () => mockCreateAuthenticatedClient(),
  createAdminClient: () => mockCreateAdminClient(),
}));

const mockClaudeCreate = vi.fn();
vi.mock("@/lib/claude", () => ({
  createClaudeClient: () => ({ messages: { create: mockClaudeCreate } }),
}));

const TEST_USER = { id: "user-1" };
const SMALL_IMAGE = "a".repeat(100);
const LARGE_IMAGE = "a".repeat(5_000_001);

const mockCandidateRow = {
  id: "prod-1",
  name: "ガシャポン A",
  name_ko: "가샤폰 A",
  name_ja: "ガシャポン A",
  manufacturer: "BANDAI",
  official_image_url: "https://example.com/img.jpg",
  price_jpy: 300,
  total_count: 1,
};

function makeVisionResponse(text: string) {
  return {
    ok: true,
    json: async () => ({
      responses: [{ textAnnotations: [{ description: text }] }],
    }),
  };
}

function makeClaudeResponse(product_name: string | null, manufacturer: string | null = null) {
  return {
    content: [{ type: "text", text: JSON.stringify({ product_name, manufacturer }) }],
  };
}

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/gacha-scan", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/gacha-scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GOOGLE_VISION_API_KEY", "test-vision-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
  });

  it("인증 없으면 401 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: null });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: SMALL_IMAGE }));

    expect(res.status).toBe(401);
  });

  it("image 필드 없으면 400 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: TEST_USER });
    mockCreateAdminClient.mockReturnValue(createAdminSupabaseMock(true));

    const { POST } = await import("../route");
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/image/i);
  });

  it("이미지 5MB 초과 시 400 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: TEST_USER });
    mockCreateAdminClient.mockReturnValue(createAdminSupabaseMock(true));

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: LARGE_IMAGE }));

    expect(res.status).toBe(400);
  });

  it("서비스 rate limit 초과 시 429 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: TEST_USER });
    const adminMock = createAdminSupabaseMock(false);
    mockCreateAdminClient.mockReturnValue(adminMock);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: SMALL_IMAGE }));

    expect(res.status).toBe(429);
  });

  it("유저 rate limit 초과 시 429 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: TEST_USER });
    const adminMock = createAdminSupabaseMock(true);
    adminMock.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });
    mockCreateAdminClient.mockReturnValue(adminMock);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: SMALL_IMAGE }));

    expect(res.status).toBe(429);
  });

  it("정상 동작 — 후보 목록과 price_krw 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: TEST_USER });
    const adminMock = createAdminSupabaseMock([mockCandidateRow]);
    adminMock.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: [mockCandidateRow], error: null });
    mockCreateAdminClient.mockReturnValue(adminMock);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeVisionResponse("BANDAI\n가샤폰 A\n₩3,000")));
    mockClaudeCreate.mockResolvedValue(makeClaudeResponse("가샤폰 A", "BANDAI"));

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: SMALL_IMAGE }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0].id).toBe("prod-1");
    expect(body.price_krw).toBe(3000);
  });

  it("OCR 텍스트 없으면 후보 빈 배열 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: TEST_USER });
    const adminMock = createAdminSupabaseMock(true);
    adminMock.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    mockCreateAdminClient.mockReturnValue(adminMock);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeVisionResponse("")));

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: SMALL_IMAGE }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidates).toHaveLength(0);
    expect(body.price_krw).toBeNull();
  });

  it("RPC 결과 없으면 후보 빈 배열 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: TEST_USER });
    const adminMock = createAdminSupabaseMock([]);
    adminMock.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    mockCreateAdminClient.mockReturnValue(adminMock);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeVisionResponse("없는상품 가샤폰")));
    mockClaudeCreate.mockResolvedValue(makeClaudeResponse("없는상품"));

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: SMALL_IMAGE }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidates).toHaveLength(0);
  });

  it("Vision API 실패 시 빈 결과 반환 (에러 노출 안 함)", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: TEST_USER });
    const adminMock = createAdminSupabaseMock(true);
    adminMock.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    mockCreateAdminClient.mockReturnValue(adminMock);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Vision API error")));

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: SMALL_IMAGE }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidates).toHaveLength(0);
    expect(body.price_krw).toBeNull();
    expect(body.error).toBeUndefined();
  });

  it("Haiku 실패 시 휴리스틱 fallback으로 product_name 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: TEST_USER });
    const adminMock = createAdminSupabaseMock([mockCandidateRow]);
    adminMock.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: [mockCandidateRow], error: null });
    mockCreateAdminClient.mockReturnValue(adminMock);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeVisionResponse("BANDAI\n가샤폰 A 시리즈\n₩3,000")));
    mockClaudeCreate.mockRejectedValue(new Error("Haiku error"));

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: SMALL_IMAGE }));
    const body = await res.json();

    expect(res.status).toBe(200);
    // fallback이 한국어 줄 추출 → search_gacha_products 호출됨
    expect(body.extracted_name).toBeTruthy();
  });
});
