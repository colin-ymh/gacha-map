import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

function makeSupabaseMock(
  authUser: { id: string } | null,
  profileData: unknown,
  profileError: { message: string } | null = null,
) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: profileData, error: profileError }),
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUser },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue(chain),
    _chain: chain,
  };
}

describe("GET /api/users/profile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("미인증 시 401 반환", async () => {
    mockCreateClient.mockReturnValue(makeSupabaseMock(null, null));
    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("프로필 행이 없으면 기본 fallback 반환", async () => {
    mockCreateClient.mockReturnValue(makeSupabaseMock({ id: "uid-1" }, null));
    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.id).toBe("uid-1");
    expect(body.profile.nickname).toBeNull();
  });

  it("프로필 행이 있으면 반환", async () => {
    const profile = {
      id: "uid-1",
      name: "테스터",
      nickname: "nick",
      avatar_url: null,
      role: "user",
    };
    mockCreateClient.mockReturnValue(
      makeSupabaseMock({ id: "uid-1" }, profile),
    );
    const { GET } = await import("../route");
    const res = await GET();
    const body = await res.json();
    expect(body.profile.nickname).toBe("nick");
  });
});

describe("PATCH /api/users/profile", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeRequest(body: Record<string, string>) {
    return new Request("http://localhost/api/users/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as unknown as import("next/server").NextRequest;
  }

  it("미인증 시 401 반환", async () => {
    mockCreateClient.mockReturnValue(makeSupabaseMock(null, null));
    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ nickname: "test" }));
    expect(res.status).toBe(401);
  });

  it("nickname 20자 초과 시 400 반환", async () => {
    mockCreateClient.mockReturnValue(makeSupabaseMock({ id: "uid-1" }, null));
    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ nickname: "a".repeat(21) }));
    expect(res.status).toBe(400);
  });

  it("정상 저장 시 200 반환", async () => {
    const profile = {
      id: "uid-1",
      name: null,
      nickname: "newnick",
      avatar_url: null,
    };
    mockCreateClient.mockReturnValue(
      makeSupabaseMock({ id: "uid-1" }, profile),
    );
    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ nickname: "newnick" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.nickname).toBe("newnick");
  });
});
