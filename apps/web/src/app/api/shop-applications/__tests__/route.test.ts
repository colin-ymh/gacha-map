import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createSupabaseMock,
  createAdminSupabaseMock,
} from "@/test/mocks/supabase";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

// validateBizReg는 실제 구현을 쓴다. 체크섬 검증이 라우트까지 실제로 연결돼
// 있는지가 이 테스트의 관심사이므로 mock으로 대체하면 의미가 없다.
vi.mock("@gacha-map/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@gacha-map/shared")>();
  return {
    ...actual,
    containsProfanity: vi.fn().mockReturnValue(false),
  };
});

const mockGeocodeKeyword = vi.fn();
vi.mock("@/lib/kakao/geocodeKeyword", () => ({
  geocodeKeyword: (q: string) => mockGeocodeKeyword(q),
}));

// 이미지 리사이즈는 이 테스트의 관심사가 아니다. 파이프라인만 통과시킨다.
vi.mock("sharp", () => ({
  default: () => ({
    rotate: () => ({
      resize: () => ({
        jpeg: () => ({ toBuffer: async () => Buffer.from("resized") }),
      }),
    }),
  }),
}));

const mockCreateAuthenticatedClient = vi.fn();
const mockCreateAdminClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAuthenticatedClient: () => mockCreateAuthenticatedClient(),
  createAdminClient: () => mockCreateAdminClient(),
}));

/** 실존 법인(삼성전자)의 사업자등록번호. 국세청 체크섬을 통과한다. */
const VALID_BIZ_REG = "124-81-00998";
const SHOP_ID = "550e8400-e29b-41d4-a716-446655440000";

function postRequest(body: Record<string, unknown>, withAuth = true) {
  return new NextRequest("http://localhost/api/shop-applications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? { authorization: "Bearer tok" } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** new_shop 신청의 최소 유효 페이로드. 좌표를 직접 주어 지오코딩을 건너뛴다. */
function newShopBody(overrides: Record<string, unknown> = {}) {
  return {
    type: "new_shop",
    business_registration_number: VALID_BIZ_REG,
    representative_name: "대표자",
    phone_number: "01012345678",
    shop_name: "가샤포 가게",
    address: "서울시 강남구",
    lat: 37.4979,
    lng: 127.0276,
    consent_privacy: true,
    ...overrides,
  };
}

function claimShopBody(overrides: Record<string, unknown> = {}) {
  return {
    type: "claim_shop",
    shop_id: SHOP_ID,
    business_registration_number: VALID_BIZ_REG,
    representative_name: "대표자",
    phone_number: "01012345678",
    consent_privacy: true,
    ...overrides,
  };
}

let storageUpload: ReturnType<typeof vi.fn>;
let storageRemove: ReturnType<typeof vi.fn>;

function authAs(userId: string | null) {
  if (userId === null) {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: createSupabaseMock(null),
      user: null,
    });
    return null;
  }
  const adminMock = createAdminSupabaseMock(null);

  storageUpload = vi.fn().mockResolvedValue({ error: null });
  storageRemove = vi.fn().mockResolvedValue({ error: null });
  (adminMock as unknown as { storage: unknown }).storage = {
    from: vi.fn().mockReturnValue({
      upload: storageUpload,
      remove: storageRemove,
    }),
  };

  mockCreateAuthenticatedClient.mockResolvedValue({
    supabase: adminMock,
    user: { id: userId },
  });
  mockCreateAdminClient.mockReturnValue(adminMock);
  return adminMock;
}

/**
 * new_shop 신청의 정상 경로는 multipart다. 증빙 서류가 필수이기 때문.
 */
function newShopRequest(
  overrides: Record<string, unknown> = {},
  fileCount = 1,
) {
  const form = new FormData();
  form.append("payload", JSON.stringify(newShopBody(overrides)));
  for (let i = 0; i < fileCount; i++) {
    form.append(
      "documents",
      new File([new Uint8Array([1, 2, 3])], `bizreg-${i}.jpg`, {
        type: "image/jpeg",
      }),
    );
  }
  return new NextRequest("http://localhost/api/shop-applications", {
    method: "POST",
    headers: { authorization: "Bearer tok" },
    body: form,
  });
}

describe("GET /api/shop-applications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("신청 목록을 반환한다", async () => {
    const applications = [
      { id: "app-1", type: "new_shop", user_id: "user-1", status: "pending" },
    ];

    const adminMock = createAdminSupabaseMock(applications);
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: adminMock,
      user: { id: "user-1" },
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    const req = new NextRequest("http://localhost/api/shop-applications", {
      method: "GET",
      headers: { authorization: "Bearer tok" },
    });

    const { GET } = await import("../route");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applications).toHaveLength(1);
    expect(body.applications[0].id).toBe("app-1");
    expect(body.total).toBe(1);
  });

  it("인증 없으면 401", async () => {
    authAs(null);

    const req = new NextRequest("http://localhost/api/shop-applications", {
      method: "GET",
    });

    const { GET } = await import("../route");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });
});

describe("POST /api/shop-applications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("new_shop 신청을 생성한다", async () => {
    const adminMock = authAs("user-1")!;
    // 중복 pending 조회 -> 없음
    adminMock._chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    // insert
    adminMock._chain.single.mockResolvedValueOnce({
      data: { id: "app-1" },
      error: null,
    });

    const { POST } = await import("../route");
    const res = await POST(newShopRequest());

    expect(res.status).toBe(201);
    expect((await res.json()).id).toBe("app-1");
    // 좌표를 직접 줬으므로 지오코딩은 호출되지 않아야 한다
    expect(mockGeocodeKeyword).not.toHaveBeenCalled();
  });

  it("claim_shop 신청을 생성한다", async () => {
    const adminMock = authAs("user-1")!;
    adminMock._chain.maybeSingle
      // 대상 샵 조회 -> active, 주인 없음
      .mockResolvedValueOnce({
        data: { id: SHOP_ID, status: "active", owner_id: null },
        error: null,
      })
      // 중복 pending 조회 -> 없음
      .mockResolvedValueOnce({ data: null, error: null });

    adminMock._chain.single.mockResolvedValueOnce({
      data: { id: "app-1" },
      error: null,
    });

    const { POST } = await import("../route");
    const res = await POST(postRequest(claimShopBody()));

    expect(res.status).toBe(201);
    expect((await res.json()).id).toBe("app-1");
  });

  it("잘못된 type이면 400", async () => {
    authAs("user-1");
    const { POST } = await import("../route");
    const res = await POST(postRequest(newShopBody({ type: "invalid_type" })));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("invalid_type");
  });

  it("business_registration_number 없으면 400", async () => {
    authAs("user-1");
    const { POST } = await import("../route");
    const res = await POST(
      postRequest(newShopBody({ business_registration_number: undefined })),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("biz_reg_required");
  });

  it("사업자등록번호 자릿수가 틀리면 400 biz_reg_invalid_length", async () => {
    authAs("user-1");
    const { POST } = await import("../route");
    const res = await POST(
      postRequest(newShopBody({ business_registration_number: "123456789" })),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("biz_reg_invalid_length");
  });

  it("사업자등록번호 체크섬이 틀리면 400 biz_reg_invalid_checksum", async () => {
    authAs("user-1");
    const { POST } = await import("../route");
    const res = await POST(
      // 마지막 자리만 8 -> 7 로 변형
      postRequest(
        newShopBody({ business_registration_number: "124-81-00997" }),
      ),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("biz_reg_invalid_checksum");
  });

  it("개인정보 동의가 없으면 400 consent_required", async () => {
    authAs("user-1");
    const { POST } = await import("../route");
    const res = await POST(
      postRequest(newShopBody({ consent_privacy: undefined })),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("consent_required");
  });

  it("claim_shop에 잘못된 shop_id UUID면 400", async () => {
    authAs("user-1");
    const { POST } = await import("../route");
    const res = await POST(
      postRequest(claimShopBody({ shop_id: "not-a-uuid" })),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("invalid_shop_id");
  });

  it("이미 주인이 있는 샵은 claim할 수 없다 (400 shop_already_owned)", async () => {
    const adminMock = authAs("user-1")!;
    adminMock._chain.maybeSingle.mockResolvedValueOnce({
      data: { id: SHOP_ID, status: "active", owner_id: "other-user" },
      error: null,
    });

    const { POST } = await import("../route");
    const res = await POST(postRequest(claimShopBody()));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("shop_already_owned");
  });

  it("new_shop에 shop_name 없으면 400", async () => {
    authAs("user-1");
    const { POST } = await import("../route");
    const res = await POST(postRequest(newShopBody({ shop_name: undefined })));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("shop_name_required");
  });

  it("좌표가 없으면 주소로 지오코딩해서 채운다", async () => {
    const adminMock = authAs("user-1")!;
    mockGeocodeKeyword.mockResolvedValueOnce({ lat: 37.1, lng: 127.2 });
    adminMock._chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    adminMock._chain.single.mockResolvedValueOnce({
      data: { id: "app-1" },
      error: null,
    });

    const { POST } = await import("../route");
    const res = await POST(newShopRequest({ lat: undefined, lng: undefined }));

    expect(res.status).toBe(201);
    expect(mockGeocodeKeyword).toHaveBeenCalledWith("서울시 강남구");
    expect(adminMock._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 37.1, lng: 127.2 }),
    );
  });

  it("좌표도 없고 지오코딩도 실패하면 400 geocode_failed (0,0 저장 금지)", async () => {
    authAs("user-1");
    mockGeocodeKeyword.mockResolvedValueOnce(null);

    const { POST } = await import("../route");
    const res = await POST(newShopRequest({ lat: undefined, lng: undefined }));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("geocode_failed");
  });

  it("같은 사업자번호로 pending 중인 new_shop이 있으면 409", async () => {
    const adminMock = authAs("user-1")!;
    adminMock._chain.maybeSingle.mockResolvedValueOnce({
      data: { id: "existing-app" },
      error: null,
    });

    const { POST } = await import("../route");
    const res = await POST(newShopRequest());

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("duplicate_pending");
  });

  it("유니크 인덱스 위반(동시 요청)은 409로 변환한다", async () => {
    const adminMock = authAs("user-1")!;
    adminMock._chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    adminMock._chain.single.mockResolvedValueOnce({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });

    const { POST } = await import("../route");
    const res = await POST(newShopRequest());

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("duplicate_pending");
  });

  it("동의 시각은 서버가 기록한다 (클라이언트 값 무시)", async () => {
    const adminMock = authAs("user-1")!;
    adminMock._chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    adminMock._chain.single.mockResolvedValueOnce({
      data: { id: "app-1" },
      error: null,
    });

    const { POST } = await import("../route");
    await POST(
      newShopRequest({ consent_privacy_at: "1999-01-01T00:00:00.000Z" }),
    );

    const inserted = adminMock._chain.insert.mock.calls[0][0];
    expect(inserted.consent_privacy_at).not.toBe("1999-01-01T00:00:00.000Z");
    expect(Date.parse(inserted.consent_privacy_at)).toBeGreaterThan(
      Date.now() - 10_000,
    );
  });

  it("new_shop인데 증빙 서류가 없으면 400 document_required", async () => {
    authAs("user-1");
    const { POST } = await import("../route");
    // JSON 요청은 파일을 실을 수 없으므로 항상 서류 없음이 된다
    const res = await POST(postRequest(newShopBody()));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("document_required");
  });

  it("업로드한 서류 경로를 document_paths에 저장한다", async () => {
    const adminMock = authAs("user-1")!;
    adminMock._chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    adminMock._chain.single.mockResolvedValueOnce({
      data: { id: "app-1" },
      error: null,
    });

    const { POST } = await import("../route");
    await POST(newShopRequest({}, 2));

    expect(storageUpload).toHaveBeenCalledTimes(2);
    const inserted = adminMock._chain.insert.mock.calls[0][0];
    expect(inserted.document_paths).toHaveLength(2);
    // 경로는 반드시 신청자 폴더 아래여야 한다
    for (const path of inserted.document_paths as string[]) {
      expect(path.startsWith("user-1/")).toBe(true);
    }
  });

  it("insert가 실패하면 올린 서류를 지운다 (고아 개인정보 방지)", async () => {
    const adminMock = authAs("user-1")!;
    adminMock._chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    adminMock._chain.single.mockResolvedValueOnce({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });

    const { POST } = await import("../route");
    const res = await POST(newShopRequest());

    expect(res.status).toBe(409);
    expect(storageRemove).toHaveBeenCalledTimes(1);
    expect(storageRemove.mock.calls[0][0]).toHaveLength(1);
  });

  it("서류가 4개 이상이면 400", async () => {
    authAs("user-1");
    const { POST } = await import("../route");
    const res = await POST(newShopRequest({}, 4));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("too_many_documents");
  });

  it("허용되지 않은 파일 형식이면 400", async () => {
    authAs("user-1");
    const form = new FormData();
    form.append("payload", JSON.stringify(newShopBody()));
    form.append(
      "documents",
      new File([new Uint8Array([1])], "evil.svg", { type: "image/svg+xml" }),
    );
    const req = new NextRequest("http://localhost/api/shop-applications", {
      method: "POST",
      headers: { authorization: "Bearer tok" },
      body: form,
    });

    const { POST } = await import("../route");
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("document_invalid_type");
  });

  it("인증 없으면 401", async () => {
    authAs(null);
    const { POST } = await import("../route");
    const res = await POST(postRequest(newShopBody(), false));

    expect(res.status).toBe(401);
  });
});
