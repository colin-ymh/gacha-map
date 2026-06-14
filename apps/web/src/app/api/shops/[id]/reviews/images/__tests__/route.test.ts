import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createAdminSupabaseMock } from "@/test/mocks/supabase";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

const mockCreateAdminClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

describe("GET /api/shops/[id]/reviews/images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("이미지 목록을 반환한다", async () => {
    const mockReviews = [
      {
        image_urls: [
          "https://cdn.example.com/a.jpg",
          "https://cdn.example.com/b.jpg",
        ],
      },
      {
        image_urls: ["https://cdn.example.com/c.jpg"],
      },
    ];

    const mock = createAdminSupabaseMock(mockReviews);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const req = new NextRequest(
      "http://localhost/api/shops/shop-1/reviews/images",
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "shop-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.images).toHaveLength(3);
    expect(data.total).toBe(3);
  });

  it("리뷰가 없으면 빈 배열", async () => {
    const mock = createAdminSupabaseMock([]);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const req = new NextRequest(
      "http://localhost/api/shops/shop-1/reviews/images",
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "shop-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.images).toHaveLength(0);
    expect(data.total).toBe(0);
  });

  it("DB 에러 시 500", async () => {
    const mock = createAdminSupabaseMock(null, { message: "Database error" });
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const req = new NextRequest(
      "http://localhost/api/shops/shop-1/reviews/images",
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "shop-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Database error");
  });
});
