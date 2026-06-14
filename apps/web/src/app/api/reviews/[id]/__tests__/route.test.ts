import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createSupabaseMock,
  createAdminSupabaseMock,
} from "@/test/mocks/supabase";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

vi.mock("sharp", () => ({
  default: vi.fn().mockReturnValue({
    rotate: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("fake")),
  }),
}));

vi.mock("@gacha-map/shared", () => ({
  containsProfanity: vi.fn().mockReturnValue(false),
}));

const mockCreateAuthenticatedClient = vi.fn();
const mockCreateAdminClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAuthenticatedClient: () => mockCreateAuthenticatedClient(),
  createAdminClient: () => mockCreateAdminClient(),
}));

describe("PATCH /api/reviews/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("리뷰를 수정한다 (파일 없음, 콘텐츠만)", async () => {
    const adminMock = createAdminSupabaseMock({
      id: "review-1",
      shop_id: "shop-1",
      user_id: "user-1",
      image_urls: [],
    });

    const updateMock = createAdminSupabaseMock({
      id: "review-1",
      shop_id: "shop-1",
      user_id: "user-1",
      content: "updated content",
      image_urls: [],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
      user_profiles: [{ nickname: "user-nick", avatar_url: null }],
    });

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: adminMock,
      user: { id: "user-1" },
    });
    mockCreateAdminClient.mockReturnValue(updateMock);

    // First maybeSingle for review lookup, second for update
    adminMock._chain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: "review-1",
        shop_id: "shop-1",
        user_id: "user-1",
        image_urls: [],
      },
      error: null,
    });

    const formData = new FormData();
    formData.append("content", "updated content");
    const req = new NextRequest("http://localhost/api/reviews/review-1", {
      method: "PATCH",
      headers: { authorization: "Bearer tok" },
      body: formData,
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "review-1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.review.id).toBe("review-1");
    expect(body.review.content).toBe("updated content");
  });

  it("인증 없으면 401", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: createSupabaseMock(null),
      user: null,
    });

    const formData = new FormData();
    formData.append("content", "test");
    const req = new NextRequest("http://localhost/api/reviews/review-1", {
      method: "PATCH",
      body: formData,
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "review-1" }),
    });

    expect(res.status).toBe(401);
  });

  it("작성자가 아니면 403", async () => {
    const adminMock = createAdminSupabaseMock({
      id: "review-1",
      shop_id: "shop-1",
      user_id: "other-user",
      image_urls: [],
    });

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: adminMock,
      user: { id: "user-1" },
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    adminMock._chain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: "review-1",
        shop_id: "shop-1",
        user_id: "other-user",
        image_urls: [],
      },
      error: null,
    });

    const formData = new FormData();
    formData.append("content", "test");
    const req = new NextRequest("http://localhost/api/reviews/review-1", {
      method: "PATCH",
      body: formData,
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "review-1" }),
    });

    expect(res.status).toBe(403);
  });

  it("리뷰가 없으면 404", async () => {
    const adminMock = createAdminSupabaseMock(null);

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: adminMock,
      user: { id: "user-1" },
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    adminMock._chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const formData = new FormData();
    formData.append("content", "test");
    const req = new NextRequest("http://localhost/api/reviews/review-1", {
      method: "PATCH",
      body: formData,
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "review-1" }),
    });

    expect(res.status).toBe(404);
  });

  it("콘텐츠도 파일도 없으면 400", async () => {
    const adminMock = createAdminSupabaseMock({
      id: "review-1",
      shop_id: "shop-1",
      user_id: "user-1",
      image_urls: ["https://example.com/image.jpg"],
    });

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: adminMock,
      user: { id: "user-1" },
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    adminMock._chain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: "review-1",
        shop_id: "shop-1",
        user_id: "user-1",
        image_urls: ["https://example.com/image.jpg"],
      },
      error: null,
    });

    const formData = new FormData();
    const req = new NextRequest("http://localhost/api/reviews/review-1", {
      method: "PATCH",
      body: formData,
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "review-1" }),
    });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/reviews/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("리뷰를 삭제하고 204를 반환한다", async () => {
    const adminMock = createAdminSupabaseMock({
      id: "review-1",
      user_id: "user-1",
      image_urls: [],
      shop_id: "shop-1",
    });

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: adminMock,
      user: { id: "user-1" },
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    adminMock._chain.maybeSingle
      .mockResolvedValueOnce({
        data: {
          id: "review-1",
          user_id: "user-1",
          image_urls: [],
          shop_id: "shop-1",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { role: "user" },
        error: null,
      });

    const req = new NextRequest("http://localhost/api/reviews/review-1", {
      method: "DELETE",
      headers: { authorization: "Bearer tok" },
    });

    const { DELETE } = await import("../route");
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "review-1" }),
    });

    expect(res.status).toBe(204);
  });

  it("인증 없으면 401", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: createSupabaseMock(null),
      user: null,
    });

    const req = new NextRequest("http://localhost/api/reviews/review-1", {
      method: "DELETE",
    });

    const { DELETE } = await import("../route");
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "review-1" }),
    });

    expect(res.status).toBe(401);
  });

  it("작성자나 어드민이 아니면 403", async () => {
    const adminMock = createAdminSupabaseMock({
      id: "review-1",
      user_id: "other-user",
      image_urls: [],
      shop_id: "shop-1",
    });

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: adminMock,
      user: { id: "user-1" },
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    adminMock._chain.maybeSingle
      .mockResolvedValueOnce({
        data: {
          id: "review-1",
          user_id: "other-user",
          image_urls: [],
          shop_id: "shop-1",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { role: "user" },
        error: null,
      });

    const req = new NextRequest("http://localhost/api/reviews/review-1", {
      method: "DELETE",
      headers: { authorization: "Bearer tok" },
    });

    const { DELETE } = await import("../route");
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "review-1" }),
    });

    expect(res.status).toBe(403);
  });

  it("리뷰가 없으면 404", async () => {
    const adminMock = createAdminSupabaseMock(null);

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: adminMock,
      user: { id: "user-1" },
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    adminMock._chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const req = new NextRequest("http://localhost/api/reviews/review-1", {
      method: "DELETE",
      headers: { authorization: "Bearer tok" },
    });

    const { DELETE } = await import("../route");
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "review-1" }),
    });

    expect(res.status).toBe(404);
  });
});
