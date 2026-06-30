import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createAdminSupabaseMock, createSupabaseMock } from "@/test/mocks/supabase";

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

    mockClaudeCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"product_name":"가샤폰 A","manufacturer":"BANDAI","price_krw":3000}' }],
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: SMALL_IMAGE }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0].id).toBe("prod-1");
    expect(body.price_krw).toBe(3000);
  });

  it("product_name null이면 후보 빈 배열 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: TEST_USER });
    const adminMock = createAdminSupabaseMock(true);
    adminMock.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    mockCreateAdminClient.mockReturnValue(adminMock);

    mockClaudeCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"product_name":null,"manufacturer":null,"price_krw":null}' }],
    });

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

    mockClaudeCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"product_name":"없는상품","manufacturer":null,"price_krw":null}' }],
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: SMALL_IMAGE }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidates).toHaveLength(0);
  });

  it("Claude API 실패 시 빈 결과 반환 (에러 노출 안 함)", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: TEST_USER });
    const adminMock = createAdminSupabaseMock(true);
    adminMock.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    mockCreateAdminClient.mockReturnValue(adminMock);

    mockClaudeCreate.mockRejectedValue(new Error("Claude API error"));

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: SMALL_IMAGE }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidates).toHaveLength(0);
    expect(body.price_krw).toBeNull();
    expect(body.error).toBeUndefined();
  });

  it("JSON 파싱 불가 응답 시 빈 결과 반환", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: TEST_USER });
    const adminMock = createAdminSupabaseMock(true);
    adminMock.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    mockCreateAdminClient.mockReturnValue(adminMock);

    mockClaudeCreate.mockResolvedValue({
      content: [{ type: "text", text: "죄송합니다, 이미지를 인식할 수 없습니다." }],
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ image: SMALL_IMAGE }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidates).toHaveLength(0);
    expect(body.price_krw).toBeNull();
  });
});
