import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseMock } from "@/test/mocks/supabase";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  verifyAdminAuth: vi.fn(),
}));

const mockCreateAdminClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

const mockParams = { params: Promise.resolve({ id: "app-1" }) };

function getRequest() {
  return new NextRequest(
    "http://localhost/api/admin/shop-applications/app-1/documents",
    { method: "GET", headers: { authorization: "Bearer tok" } },
  );
}

function adminMockWithStorage(
  appRow: unknown,
  signed: Array<{ path: string; signedUrl: string }> | null,
  signError: { message: string } | null = null,
) {
  const mock = createAdminSupabaseMock(null);
  mock._chain.maybeSingle.mockResolvedValueOnce({ data: appRow, error: null });
  const createSignedUrls = vi
    .fn()
    .mockResolvedValue({ data: signed, error: signError });
  (mock as unknown as { storage: unknown }).storage = {
    from: vi.fn().mockReturnValue({ createSignedUrls }),
  };
  return { mock, createSignedUrls };
}

describe("GET /api/admin/shop-applications/[id]/documents", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValue({
      ok: true,
      user: { id: "admin-uid" } as never,
    });
  });

  it("첨부된 서류의 단기 서명 URL을 반환한다", async () => {
    const { mock, createSignedUrls } = adminMockWithStorage(
      { id: "app-1", document_paths: ["user-1/a.jpg", "user-1/b.pdf"] },
      [
        { path: "user-1/a.jpg", signedUrl: "https://signed/a" },
        { path: "user-1/b.pdf", signedUrl: "https://signed/b" },
      ],
    );
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(getRequest(), mockParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.documents).toEqual([
      { path: "user-1/a.jpg", url: "https://signed/a" },
      { path: "user-1/b.pdf", url: "https://signed/b" },
    ]);
    // 만료가 없는 URL을 만들면 안 된다
    expect(createSignedUrls).toHaveBeenCalledWith(
      ["user-1/a.jpg", "user-1/b.pdf"],
      300,
    );
  });

  it("첨부가 없으면 빈 배열", async () => {
    const { mock } = adminMockWithStorage(
      { id: "app-1", document_paths: null },
      null,
    );
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(getRequest(), mockParams);

    expect(res.status).toBe(200);
    expect((await res.json()).documents).toEqual([]);
  });

  it("없는 신청이면 404", async () => {
    const { mock } = adminMockWithStorage(null, null);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(getRequest(), mockParams);

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("not_found");
  });

  it("admin이 아니면 verifyAdminAuth의 응답을 그대로 돌려준다", async () => {
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as never);

    const { GET } = await import("../route");
    const res = await GET(getRequest(), mockParams);

    expect(res.status).toBe(403);
  });
});
