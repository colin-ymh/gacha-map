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

const mockGetUserGachaCollections = vi.fn();
vi.mock("@/lib/gacha/rollStats", () => ({
  getUserGachaCollections: (...args: unknown[]) =>
    mockGetUserGachaCollections(...args),
}));

function makeRequest() {
  return new NextRequest(
    new URL("http://localhost/api/users/gacha-collections"),
  );
}

describe("GET /api/users/gacha-collections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("비로그인이면 401이 아니라 빈 목록을 200으로 반환한다", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: null });

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.collections).toEqual([]);
    expect(mockGetUserGachaCollections).not.toHaveBeenCalled();
  });

  it("로그인 유저면 집계 결과를 그대로 반환한다", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      user: { id: "user-1" },
      supabase: {},
    });
    mockGetUserGachaCollections.mockResolvedValue([
      {
        productId: "prod-a",
        productDisplayName: "A",
        productImageUrl: null,
        totalVariants: 2,
        collectedCount: 2,
        isComplete: true,
      },
    ]);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.collections).toHaveLength(1);
    expect(mockGetUserGachaCollections).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
    );
  });
});
