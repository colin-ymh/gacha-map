import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createAdminSupabaseMock,
  createSupabaseMock,
} from "@/test/mocks/supabase";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

const mockCreateAdminClient = vi.fn();
const mockCreateAuthenticatedClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => mockCreateAdminClient(),
  createAuthenticatedClient: () => mockCreateAuthenticatedClient(),
}));

vi.mock("sharp", () => ({
  default: vi.fn().mockReturnValue({
    rotate: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-jpeg")),
  }),
}));

vi.mock("@gacha-map/shared", () => ({
  containsProfanity: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/badges", () => ({
  tryLogBadgeCount: vi.fn().mockResolvedValue(false),
  checkAndAwardBadge: vi.fn().mockResolvedValue(undefined),
  checkAnomalies: vi.fn().mockResolvedValue(undefined),
}));

describe("GET /api/shops/[id]/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("리뷰 목록을 반환한다", async () => {
    const mockReviews = [
      {
        id: "review-1",
        shop_id: "shop-1",
        user_id: "user-1",
        content: "좋아요",
        image_urls: ["https://cdn.example.com/img1.jpg"],
        created_at: "2026-06-14T00:00:00Z",
        updated_at: "2026-06-14T00:00:00Z",
        user_profiles: [
          {
            nickname: "reviewer1",
            avatar_url: "https://cdn.example.com/avatar1.jpg",
            user_badges: {
              id: "ub-1",
              badge_definitions: {
                id: "badge-1",
                name: "Expert",
                icon_url: "https://cdn.example.com/badge.png",
              },
            },
          },
        ],
      },
    ];

    const mock = createAdminSupabaseMock(mockReviews, null, 1);
    mockCreateAdminClient.mockReturnValue(mock);
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {},
      user: null,
    });

    const { GET } = await import("../route");
    const req = new NextRequest("http://localhost/api/shops/shop-1/reviews");
    const res = await GET(req, {
      params: Promise.resolve({ id: "shop-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.reviews).toHaveLength(1);
    expect(data.reviews[0].id).toBe("review-1");
    expect(data.reviews[0].user.main_badge.name).toBe("Expert");
    expect(data.total).toBe(1);
    expect(data.hasMore).toBe(false);
  });

  it("DB 에러 시 500", async () => {
    const mock = createAdminSupabaseMock(null, { message: "Database error" });
    mockCreateAdminClient.mockReturnValue(mock);
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {},
      user: null,
    });

    const { GET } = await import("../route");
    const req = new NextRequest("http://localhost/api/shops/shop-1/reviews");
    const res = await GET(req, {
      params: Promise.resolve({ id: "shop-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Database error");
  });
});

describe("POST /api/shops/[id]/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("리뷰를 생성한다 (no files, content only)", async () => {
    const adminMock = createAdminSupabaseMock(null);
    const authMock = createAdminSupabaseMock(null);

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: authMock,
      user: { id: "user-1" },
    });

    adminMock._chain.maybeSingle.mockResolvedValueOnce({
      data: { id: "shop-1" },
      error: null,
    }); // shop active check

    authMock._chain.single.mockResolvedValueOnce({
      data: {
        id: "review-1",
        shop_id: "shop-1",
        user_id: "user-1",
        content: "좋아요",
        image_urls: [],
        created_at: "2026-06-14T00:00:00Z",
        updated_at: "2026-06-14T00:00:00Z",
        user_profiles: null,
      },
      error: null,
    }); // insert result

    mockCreateAdminClient.mockReturnValue(adminMock);

    // Create stub formData
    const fd = new FormData();
    fd.append("content", "좋아요");
    const stubRequest = {
      formData: async () => fd,
    } as unknown as NextRequest;

    const { POST } = await import("../route");
    const res = await POST(stubRequest, {
      params: Promise.resolve({ id: "shop-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.review.id).toBe("review-1");
    expect(data.review.content).toBe("좋아요");
  });

  it("인증 없으면 401", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {},
      user: null,
    });

    const fd = new FormData();
    fd.append("content", "테스트");
    const stubRequest = {
      formData: async () => fd,
    } as unknown as NextRequest;

    const { POST } = await import("../route");
    const res = await POST(stubRequest, {
      params: Promise.resolve({ id: "shop-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toMatch(/Unauthorized/);
  });

  it("샵이 없으면 404", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });

    const adminMock = createAdminSupabaseMock(null);
    adminMock._chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    }); // shop = null
    mockCreateAdminClient.mockReturnValue(adminMock);

    const fd = new FormData();
    fd.append("content", "테스트");
    const stubRequest = {
      formData: async () => fd,
    } as unknown as NextRequest;

    const { POST } = await import("../route");
    const res = await POST(stubRequest, {
      params: Promise.resolve({ id: "shop-missing" }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toMatch(/Shop not found/);
  });

  it("비속어 있으면 400", async () => {
    const { containsProfanity } = await import("@gacha-map/shared");
    vi.mocked(containsProfanity).mockReturnValueOnce(true);

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });

    const adminMock = createAdminSupabaseMock(null);
    adminMock._chain.maybeSingle.mockResolvedValueOnce({
      data: { id: "shop-1" },
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    const fd = new FormData();
    fd.append("content", "나쁜말");
    const stubRequest = {
      formData: async () => fd,
    } as unknown as NextRequest;

    const { POST } = await import("../route");
    const res = await POST(stubRequest, {
      params: Promise.resolve({ id: "shop-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("profanity");
  });

  it("content도 파일도 없으면 400", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });

    const adminMock = createAdminSupabaseMock(null);
    adminMock._chain.maybeSingle.mockResolvedValueOnce({
      data: { id: "shop-1" },
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    const fd = new FormData();
    const stubRequest = {
      formData: async () => fd,
    } as unknown as NextRequest;

    const { POST } = await import("../route");
    const res = await POST(stubRequest, {
      params: Promise.resolve({ id: "shop-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/Content or at least one image/);
  });
});
