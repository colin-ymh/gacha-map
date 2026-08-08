import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  ACTION_BONUS_MAX,
  DAILY_BASE_ROLLS,
  REFERRAL_BONUS_MAX,
} from "@/constants/gacha-roll";

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

/** 체이닝 메서드를 모두 자기 자신으로 돌려주고, await 하면 result를 준다 */
function makeChain(result: unknown, terminal?: Record<string, unknown>) {
  const chain: Record<string, unknown> = { ...terminal };
  for (const m of ["select", "eq", "gte", "order", "limit"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

const ROLLED_VARIANT = {
  id: "var-9",
  name: "이미 뽑은 것",
  name_ko: null,
  image_url: null,
};

function makeAdminClient(quota: unknown, variantCount = 3) {
  const rollsChain = makeChain(
    {},
    {
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          variant_id: "var-9",
          gacha_product_variants: ROLLED_VARIANT,
        },
        error: null,
      }),
    },
  );

  return {
    from: vi.fn((table: string) =>
      table === "gacha_product_variants"
        ? makeChain({ count: variantCount, error: null })
        : rollsChain,
    ),
    rpc: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: quota, error: null }),
    }),
  };
}

function makeRequest() {
  return new NextRequest(
    new URL("http://localhost/api/gacha-products/prod-1/roll-status"),
  );
}

const params = Promise.resolve({ id: "prod-1" });

describe("GET /api/gacha-products/[id]/roll-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAuthenticatedClient.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("오늘 이 상품을 이미 뽑았어도 쿼터가 남아있으면 다시 뽑을 수 있다", async () => {
    mockCreateAdminClient.mockReturnValue(
      makeAdminClient({ base: 5, bonus: 0, used: 1, remaining: 4 }),
    );

    const { GET } = await import("../route");
    const res = await GET(makeRequest(), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.canRoll).toBe(true);
    // 상품당 하루 1회 제한은 제거됐다.
    expect(body.reason).toBeUndefined();
    expect(body.quota.remaining).toBe(4);
    // 앱이 FAB 라벨을 "다시 뽑기"로 바꾸려면 오늘 뽑은 기록이 필요하다.
    expect(body.rolledVariant).toEqual(ROLLED_VARIANT);
  });

  it("어떤 경우에도 already_rolled를 반환하지 않는다", async () => {
    for (const quota of [
      { base: 5, bonus: 0, used: 1, remaining: 4 },
      { base: 5, bonus: 0, used: 5, remaining: 0 },
    ]) {
      mockCreateAdminClient.mockReturnValue(makeAdminClient(quota));

      const { GET } = await import("../route");
      const res = await GET(makeRequest(), { params });
      const body = await res.json();

      expect(body.reason).not.toBe("already_rolled");
    }
  });

  it("쿼터가 0이면 daily_limit과 마지막 뽑기 결과를 함께 내려준다", async () => {
    mockCreateAdminClient.mockReturnValue(
      makeAdminClient({ base: 5, bonus: 0, used: 5, remaining: 0 }),
    );

    const { GET } = await import("../route");
    const res = await GET(makeRequest(), { params });
    const body = await res.json();

    expect(body.canRoll).toBe(false);
    expect(body.reason).toBe("daily_limit");
    expect(body.rolledVariant).toEqual(ROLLED_VARIANT);
    expect(body.nextAvailableAt).toBeDefined();
  });

  it("활성 품목이 없으면 no_variants", async () => {
    mockCreateAdminClient.mockReturnValue(
      makeAdminClient({ base: 5, bonus: 0, used: 0, remaining: 5 }, 0),
    );

    const { GET } = await import("../route");
    const res = await GET(makeRequest(), { params });
    const body = await res.json();

    expect(body.canRoll).toBe(false);
    expect(body.reason).toBe("no_variants");
  });

  it("쿼터 조회 RPC 호출 시 action_bonus_max 파라미터를 포함한다", async () => {
    const admin = makeAdminClient({ base: 5, bonus: 0, used: 0, remaining: 5 });
    mockCreateAdminClient.mockReturnValue(admin);

    const { GET } = await import("../route");
    await GET(makeRequest(), { params });

    expect(admin.rpc).toHaveBeenCalledWith(
      "get_daily_roll_quota",
      expect.objectContaining({
        p_user_id: "user-1",
        p_base: DAILY_BASE_ROLLS,
        p_bonus_max: REFERRAL_BONUS_MAX,
        p_action_bonus_max: ACTION_BONUS_MAX,
      }),
    );
  });
});
