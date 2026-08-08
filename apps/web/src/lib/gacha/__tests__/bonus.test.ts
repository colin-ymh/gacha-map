import { describe, it, expect, vi, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { grantGachaBonusEvent } from "../bonus";

function makeClient(insertMock: ReturnType<typeof vi.fn>) {
  return {
    from: vi.fn().mockReturnValue({ insert: insertMock }),
  } as unknown as SupabaseClient;
}

describe("grantGachaBonusEvent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("정상 삽입 시 gacha_bonus_events에 insert한다", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const client = makeClient(insertMock);

    await grantGachaBonusEvent(client, "user-1", "review", "review-1");

    expect(client.from).toHaveBeenCalledWith("gacha_bonus_events");
    expect(insertMock).toHaveBeenCalledWith({
      user_id: "user-1",
      source_type: "review",
      source_id: "review-1",
    });
  });

  it("23505(중복) 에러는 조용히 무시한다", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const insertMock = vi
      .fn()
      .mockResolvedValue({ error: { code: "23505", message: "duplicate" } });
    const client = makeClient(insertMock);

    await expect(
      grantGachaBonusEvent(client, "user-1", "shop_report", "report-1"),
    ).resolves.toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("23505 외 에러는 throw하지 않고 로그만 남긴다", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const insertMock = vi
      .fn()
      .mockResolvedValue({ error: { code: "500", message: "db down" } });
    const client = makeClient(insertMock);

    await expect(
      grantGachaBonusEvent(client, "user-1", "gacha_report", "product-1"),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      "[grantGachaBonusEvent] failed",
      expect.objectContaining({ sourceType: "gacha_report" }),
    );
  });
});
