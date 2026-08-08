import { describe, it, expect, vi, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { grantGachaBonusEvent } from "../bonus";

function makeClient(rpcImpl: (fn: string, args: unknown) => unknown) {
  const rpc = vi.fn().mockImplementation(async (fn: string, args: unknown) => ({
    data: rpcImpl(fn, args),
    error: null,
  }));
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("grantGachaBonusEvent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("RPC가 true를 돌려주면(오늘 상한 이내 + 알림 켜짐) 푸시를 보낸다", async () => {
    const { client, rpc } = makeClient((fn) =>
      fn === "grant_gacha_bonus_event" ? true : null,
    );

    await grantGachaBonusEvent(client, "user-1", "review", "review-1");

    expect(rpc).toHaveBeenCalledWith("grant_gacha_bonus_event", {
      p_user_id: "user-1",
      p_source_type: "review",
      p_source_id: "review-1",
      p_action_bonus_max: expect.any(Number),
    });
    expect(rpc).toHaveBeenCalledWith(
      "enqueue_notification",
      expect.objectContaining({
        p_user_id: "user-1",
        p_category: "gacha_bonus",
      }),
    );
  });

  it("RPC가 false를 돌려주면(상한 초과/중복/알림 꺼짐) 푸시를 안 보낸다", async () => {
    const { client, rpc } = makeClient((fn) =>
      fn === "grant_gacha_bonus_event" ? false : null,
    );

    await grantGachaBonusEvent(client, "user-1", "shop_report", "report-1");

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalledWith(
      "enqueue_notification",
      expect.anything(),
    );
  });

  it("RPC 에러는 throw하지 않고 로그만 남기고 푸시도 안 보낸다", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "db down" } });
    const client = { rpc } as unknown as SupabaseClient;

    await expect(
      grantGachaBonusEvent(client, "user-1", "gacha_report", "product-1"),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      "[grantGachaBonusEvent] failed",
      expect.objectContaining({ sourceType: "gacha_report" }),
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
