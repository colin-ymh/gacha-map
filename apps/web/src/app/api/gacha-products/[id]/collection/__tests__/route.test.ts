import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

const mockCreateAuthenticatedClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAuthenticatedClient: (req: unknown) =>
    mockCreateAuthenticatedClient(req),
}));

const mockGetProductCollectionDetail = vi.fn();
vi.mock("@/lib/gacha/rollStats", () => ({
  getProductCollectionDetail: (...args: unknown[]) =>
    mockGetProductCollectionDetail(...args),
}));

function makeRequest() {
  return new NextRequest(
    new URL("http://localhost/api/gacha-products/prod-1/collection"),
  );
}

const params = Promise.resolve({ id: "prod-1" });

describe("GET /api/gacha-products/[id]/collection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("비로그인이어도 401이 아니라 미수집 상태의 상세를 200으로 반환한다", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      user: null,
      supabase: {},
    });
    mockGetProductCollectionDetail.mockResolvedValue({
      productId: "prod-1",
      totalVariants: 2,
      collectedCount: 0,
      isComplete: false,
      variants: [],
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest(), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.collectedCount).toBe(0);
    expect(mockGetProductCollectionDetail).toHaveBeenCalledWith(
      expect.anything(),
      null,
      "prod-1",
    );
  });

  it("로그인 유저면 유저 id를 넘겨 집계한다", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      user: { id: "user-1" },
      supabase: {},
    });
    mockGetProductCollectionDetail.mockResolvedValue({
      productId: "prod-1",
      totalVariants: 2,
      collectedCount: 2,
      isComplete: true,
      variants: [],
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest(), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isComplete).toBe(true);
    expect(mockGetProductCollectionDetail).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "prod-1",
    );
  });
});
