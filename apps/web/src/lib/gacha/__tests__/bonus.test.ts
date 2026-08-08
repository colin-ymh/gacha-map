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

  it("RPC가 true를 돌려주면(오늘 상한 이내) true를 반환한다 — 푸시는 안 보낸다, 호출부가 토스트로 알린다", async () => {
    const { client, rpc } = makeClient((fn) =>
      fn === "grant_gacha_bonus_event" ? true : null,
    );

    const granted = await grantGachaBonusEvent(
      client,
      "user-1",
      "review",
      "review-1",
    );

    expect(granted).toBe(true);
    expect(rpc).toHaveBeenCalledWith("grant_gacha_bonus_event", {
      p_user_id: "user-1",
      p_source_type: "review",
      p_source_id: "review-1",
      p_action_bonus_max: expect.any(Number),
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalledWith(
      "enqueue_notification",
      expect.anything(),
    );
  });

  it("RPC가 false를 돌려주면(상한 초과/중복) false를 반환한다", async () => {
    const { client, rpc } = makeClient((fn) =>
      fn === "grant_gacha_bonus_event" ? false : null,
    );

    const granted = await grantGachaBonusEvent(
      client,
      "user-1",
      "shop_report",
      "report-1",
    );

    expect(granted).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("RPC 에러는 throw하지 않고 로그만 남기고 false를 반환한다", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "db down" } });
    const client = { rpc } as unknown as SupabaseClient;

    await expect(
      grantGachaBonusEvent(client, "user-1", "gacha_report", "product-1"),
    ).resolves.toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      "[grantGachaBonusEvent] failed",
      expect.objectContaining({ sourceType: "gacha_report" }),
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
