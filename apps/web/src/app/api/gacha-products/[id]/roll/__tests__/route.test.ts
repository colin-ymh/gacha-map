import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

const mockCreateAuthenticatedClient = vi.fn();
const mockCreateAdminClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAuthenticatedClient: (req: unknown) =>
    mockCreateAuthenticatedClient(req),
  createAdminClient: () => mockCreateAdminClient(),
}));

vi.mock("@/lib/badges/earn", () => ({
  checkAndAwardBadge: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/gacha/rollStats", () => ({
  getProductRollStats: vi.fn().mockResolvedValue({
    totalCount: 3,
    todayCount: 1,
    variantStats: [],
  }),
}));

const VARIANTS = [
  {
    id: "var-1",
    product_id: "prod-1",
    name: "A",
    name_ko: null,
    name_en: null,
    image_url: null,
    sort_order: 1,
    status: "active",
  },
];

/** from(...).select().eq().eq().order() 를 await 하는 체인 */
function makeVariantsChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data, error }).then(resolve);
  return chain;
}

function makeAdminClient(consumed: unknown, consumeError: unknown = null) {
  const rpc = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: consumed, error: consumeError }),
  });
  return {
    from: vi.fn().mockReturnValue(makeVariantsChain(VARIANTS)),
    rpc,
    _rpc: rpc,
  };
}

function makeRequest() {
  return new NextRequest(
    new URL("http://localhost/api/gacha-products/prod-1/roll"),
    { method: "POST" },
  );
}

const params = Promise.resolve({ id: "prod-1" });

describe("POST /api/gacha-products/[id]/roll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAuthenticatedClient.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("쿼터가 남아있으면 RPC가 계산한 잔여 횟수를 그대로 반환한다", async () => {
    mockCreateAdminClient.mockReturnValue(
      makeAdminClient({
        roll_id: "roll-1",
        base: 5,
        bonus: 3,
        used_after: 4,
        remaining_after: 4,
      }),
    );

    const { POST } = await import("../route");
    const res = await POST(makeRequest(), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.rollId).toBe("roll-1");
    // 라우트가 base + bonus - used 를 다시 계산하면 안 된다.
    expect(body.permission.remainingToday).toBe(4);
    expect(body.permission.base).toBe(5);
    expect(body.permission.bonus).toBe(3);
    expect(body.permission.used).toBe(4);
  });

  it("쿼터가 소진되면 409 daily_limit을 반환하고 아무것도 저장하지 않는다", async () => {
    mockCreateAdminClient.mockReturnValue(
      makeAdminClient({
        roll_id: null,
        base: 5,
        bonus: 0,
        used_after: 5,
        remaining_after: 0,
      }),
    );

    const { POST } = await import("../route");
    const res = await POST(makeRequest(), { params });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.reason).toBe("daily_limit");
    expect(body.remainingToday).toBe(0);
    expect(body.used).toBe(5);
  });

  it("쿼터 확인과 저장을 하나의 RPC 호출로 처리한다", async () => {
    const admin = makeAdminClient({
      roll_id: "roll-2",
      base: 5,
      bonus: 0,
      used_after: 1,
      remaining_after: 4,
    });
    mockCreateAdminClient.mockReturnValue(admin);

    const { POST } = await import("../route");
    await POST(makeRequest(), { params });

    expect(admin._rpc).toHaveBeenCalledTimes(1);
    expect(admin._rpc).toHaveBeenCalledWith(
      "consume_daily_roll",
      expect.objectContaining({
        p_user_id: "user-1",
        p_product_id: "prod-1",
        p_variant_id: "var-1",
      }),
    );
  });

  it("로그인하지 않으면 401", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({ user: null });
    mockCreateAdminClient.mockReturnValue(makeAdminClient(null));

    const { POST } = await import("../route");
    const res = await POST(makeRequest(), { params });

    expect(res.status).toBe(401);
  });
});
