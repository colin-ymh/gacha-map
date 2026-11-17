import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authenticate, admin, query } = vi.hoisted(() => ({
  authenticate: vi.fn(),
  admin: vi.fn(),
  query: {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    ilike: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createAuthenticatedClient: authenticate,
  createAdminClient: admin,
}));

import { GET } from "./route";

const request = (q: string) =>
  new NextRequest(`http://localhost/api/shop-applications/shop-candidates?q=${encodeURIComponent(q)}`);

describe("shop application candidates", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authenticate.mockResolvedValue({ user: { id: "requester" } });
    admin.mockReturnValue({ from: () => query });
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.is.mockReturnValue(query);
    query.ilike.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockResolvedValue({ data: [], error: null });
  });

  it("requires authentication before querying the catalog", async () => {
    authenticate.mockResolvedValue({ user: null });
    expect((await GET(request("가챠코너"))).status).toBe(401);
    expect(admin).not.toHaveBeenCalled();
  });

  it("returns no candidates for a short query and rejects oversized input", async () => {
    expect(await (await GET(request("가_*"))).json()).toEqual({ candidates: [] });
    expect((await GET(request("가".repeat(101)))).status).toBe(400);
    expect(admin).not.toHaveBeenCalled();
  });

  it("queries only unowned shops and ranks and deduplicates their names", async () => {
    query.limit.mockResolvedValue({
      data: [
        { id: "typo", name: "가카코너", address: null, owner_id: null },
        { id: "other", name: "다른매장", address: "가챠코너로", owner_id: null },
        { id: "prefix", name: "가챠코너 강남점", address: "강남구", owner_id: null },
        { id: "exact", name: "가챠 코너", address: "마포구", owner_id: null },
      ],
      error: null,
    });
    const res = await GET(request(" 가챠_코너 "));
    expect(await res.json()).toEqual({
      candidates: [
        { id: "exact", name: "가챠 코너", address: "마포구", claimable: true },
        { id: "prefix", name: "가챠코너 강남점", address: "강남구", claimable: true },
        { id: "typo", name: "가카코너", address: null, claimable: true },
      ],
    });
    expect(query.eq).toHaveBeenCalledWith("status", "active");
    expect(query.is).toHaveBeenCalledWith("owner_id", null);
    expect(query.select).toHaveBeenCalledWith("id, name, address");
    expect(query.ilike).toHaveBeenCalledWith("name", "가%챠%코%너");
    expect(query.limit).toHaveBeenCalledWith(60);
  });

  it("caps the response and hides database failures from the client", async () => {
    query.limit.mockResolvedValue({
      data: Array.from({ length: 8 }, (_, index) => ({
        id: String(index), name: `가챠코너 ${index}호점`, address: null, owner_id: null,
      })),
      error: null,
    });
    expect((await (await GET(request("가챠코너"))).json()).candidates).toHaveLength(5);
    query.limit.mockResolvedValue({ data: null, error: { message: "internal" } });
    const res = await GET(request("가챠코너"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Unable to search shops" });
  });
});
