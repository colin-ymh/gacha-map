import { vi } from "vitest";

function makeStorageMock() {
  const bucket = {
    upload: vi
      .fn()
      .mockResolvedValue({ data: { path: "mock/path.jpg" }, error: null }),
    remove: vi.fn().mockResolvedValue({ data: [], error: null }),
    getPublicUrl: vi
      .fn()
      .mockReturnValue({
        data: { publicUrl: "https://cdn.example.com/mock.jpg" },
      }),
  };
  return { from: vi.fn().mockReturnValue(bucket), _bucket: bucket };
}

/**
 * Supabase 쿼리 빌더 체인을 모킹하는 유틸.
 * range() 또는 single() 호출 시 지정된 data/error/count를 반환한다.
 */
export function createSupabaseMock(
  data: unknown,
  error: { message: string; code?: string } | null = null,
  count: number = 0,
  authUser: { id: string } | null = null,
) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data, error, count }),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    then: (
      resolve: (value: {
        data: unknown;
        error: typeof error;
        count: number;
      }) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve({ data, error, count }).then(resolve, reject),
  };

  const storage = makeStorageMock();

  return {
    from: vi.fn().mockReturnValue(chain),
    rpc: vi.fn().mockResolvedValue({ data, error }),
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: authUser }, error: null }),
    },
    storage,
    _chain: chain,
    _storage: storage._bucket,
  };
}

/**
 * insert/update/delete/upsert + storage + auth.admin을 포함한 어드민 API용 확장 mock.
 * from() 호출마다 같은 체인을 반환하므로, 테스트에서 _chain으로 검증 가능.
 */
export function createAdminSupabaseMock(
  data: unknown,
  error: { message: string; code?: string } | null = null,
  count: number = 0,
) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data, error, count }),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    then: (
      resolve: (value: {
        data: unknown;
        error: typeof error;
        count: number;
      }) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve({ data, error, count }).then(resolve, reject),
  };

  const storage = makeStorageMock();

  return {
    from: vi.fn().mockReturnValue(chain),
    rpc: vi.fn().mockResolvedValue({ data, error }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      admin: {
        deleteUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
        getUserById: vi
          .fn()
          .mockResolvedValue({ data: { user: null }, error: null }),
        generateLink: vi.fn().mockResolvedValue({
          data: { properties: { hashed_token: "mock-token" } },
          error: null,
        }),
      },
    },
    storage,
    _chain: chain,
    _storage: storage._bucket,
  };
}
