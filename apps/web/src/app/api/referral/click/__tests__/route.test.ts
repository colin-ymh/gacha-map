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

const mockEnqueueNotification = vi.fn().mockResolvedValue(null);
vi.mock("@/lib/notifications/sendPush", () => ({
  enqueueNotification: (...args: unknown[]) => mockEnqueueNotification(...args),
}));

const CODE = "ABCDEFGHJK";
const INVITER_ID = "inviter-1";

function makeAdminClient(
  inviter: { id: string } | null = { id: INVITER_ID },
  rateLimitAllowed = true,
  shouldNotify = true,
) {
  const rpc = vi.fn().mockImplementation(async (fn: string) => {
    if (fn === "check_rate_limit") {
      return { data: rateLimitAllowed, error: null };
    }
    if (fn === "record_referral_click") {
      return { data: shouldNotify, error: null };
    }
    return { data: null, error: null };
  });

  const profilesChain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: inviter, error: null }),
  };

  return {
    from: vi.fn((table: string) =>
      table === "user_profiles" ? profilesChain : {},
    ),
    rpc,
  };
}

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(new URL("http://localhost/api/referral/click"), {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/referral/click", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAuthenticatedClient.mockResolvedValue({ user: null });
    mockEnqueueNotification.mockResolvedValue(null);
  });

  it("정상 유입이면 클릭을 기록하고 방문자 쿠키를 심는다", async () => {
    const admin = makeAdminClient();
    mockCreateAdminClient.mockReturnValue(admin);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ code: CODE }));

    expect(res.status).toBe(204);
    expect(admin.rpc).toHaveBeenCalledWith(
      "record_referral_click",
      expect.objectContaining({ p_inviter_id: INVITER_ID }),
    );
    expect(res.cookies.get("gm_vid")?.value).toBeTruthy();
    expect(res.cookies.get("gm_vid")?.httpOnly).toBe(true);
  });

  it("RPC가 true를 돌려주면(오늘 상한 이내) 초대자에게 푸시를 보낸다", async () => {
    const admin = makeAdminClient({ id: INVITER_ID }, true, true);
    mockCreateAdminClient.mockReturnValue(admin);

    const { POST } = await import("../route");
    await POST(makeRequest({ code: CODE }));

    expect(mockEnqueueNotification).toHaveBeenCalledWith(
      admin,
      INVITER_ID,
      "gacha_referral_bonus",
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ type: "gacha_referral_bonus" }),
    );
  });

  it("RPC가 false를 돌려주면(상한 초과/중복/알림 꺼짐) 푸시를 안 보낸다", async () => {
    const admin = makeAdminClient({ id: INVITER_ID }, true, false);
    mockCreateAdminClient.mockReturnValue(admin);

    const { POST } = await import("../route");
    await POST(makeRequest({ code: CODE }));

    expect(mockEnqueueNotification).not.toHaveBeenCalled();
  });

  it("링크 미리보기 크롤러는 집계하지 않는다", async () => {
    const admin = makeAdminClient();
    mockCreateAdminClient.mockReturnValue(admin);

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({ code: CODE }, { "user-agent": "facebookexternalhit/1.1" }),
    );

    expect(res.status).toBe(204);
    expect(admin.rpc).not.toHaveBeenCalledWith(
      "record_referral_click",
      expect.anything(),
    );
  });

  it("카카오톡 인앱 브라우저는 진짜 사용자이므로 집계한다", async () => {
    const admin = makeAdminClient();
    mockCreateAdminClient.mockReturnValue(admin);

    const { POST } = await import("../route");
    await POST(
      makeRequest(
        { code: CODE },
        {
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) KAKAOTALK 10.0.0",
        },
      ),
    );

    expect(admin.rpc).toHaveBeenCalledWith(
      "record_referral_click",
      expect.anything(),
    );
  });

  it("자기 링크를 자기가 열면 보상하지 않는다", async () => {
    const admin = makeAdminClient();
    mockCreateAdminClient.mockReturnValue(admin);
    mockCreateAuthenticatedClient.mockResolvedValue({
      user: { id: INVITER_ID },
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ code: CODE }));

    expect(res.status).toBe(204);
    expect(admin.rpc).not.toHaveBeenCalledWith(
      "record_referral_click",
      expect.anything(),
    );
  });

  it("존재하지 않는 코드는 조용히 무시한다", async () => {
    const admin = makeAdminClient(null);
    mockCreateAdminClient.mockReturnValue(admin);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ code: CODE }));

    expect(res.status).toBe(204);
    expect(admin.rpc).not.toHaveBeenCalledWith(
      "record_referral_click",
      expect.anything(),
    );
  });

  it("형식이 맞지 않는 코드는 DB를 조회하지 않는다", async () => {
    const admin = makeAdminClient();
    mockCreateAdminClient.mockReturnValue(admin);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ code: "not-a-code" }));

    expect(res.status).toBe(204);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("rate limit에 걸리면 기록하지 않는다", async () => {
    const admin = makeAdminClient({ id: INVITER_ID }, false);
    mockCreateAdminClient.mockReturnValue(admin);

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({ code: CODE }, { "x-forwarded-for": "1.2.3.4" }),
    );

    expect(res.status).toBe(204);
    expect(admin.rpc).not.toHaveBeenCalledWith(
      "record_referral_click",
      expect.anything(),
    );
  });

  it("기존 방문자 쿠키가 있으면 그대로 재사용한다", async () => {
    const admin = makeAdminClient();
    mockCreateAdminClient.mockReturnValue(admin);

    const existing = "11111111-1111-1111-1111-111111111111";
    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({ code: CODE }, { cookie: `gm_vid=${existing}` }),
    );

    expect(admin.rpc).toHaveBeenCalledWith(
      "record_referral_click",
      expect.objectContaining({ p_visitor_id: existing }),
    );
    // 이미 있는 쿠키는 다시 심지 않는다.
    expect(res.cookies.get("gm_vid")).toBeUndefined();
  });
});
