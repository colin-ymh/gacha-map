import { vi } from "vitest";

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
    contains: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data, error, count }),
    single: vi.fn().mockResolvedValue({ data, error }),
    then: (
      resolve: (value: {
        data: unknown;
        error: typeof error;
        count: number;
      }) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve({ data, error, count }).then(resolve, reject),
  };

  return {
    from: vi.fn().mockReturnValue(chain),
    rpc: vi.fn().mockResolvedValue({ data, error }),
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: authUser }, error: null }),
    },
    _chain: chain,
  };
}

/**
 * insert/update를 포함한 어드민 API용 확장 mock.
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
    contains: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data, error, count }),
    single: vi.fn().mockResolvedValue({ data, error }),
    then: (
      resolve: (value: {
        data: unknown;
        error: typeof error;
        count: number;
      }) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve({ data, error, count }).then(resolve, reject),
  };

  return {
    from: vi.fn().mockReturnValue(chain),
    rpc: vi.fn().mockResolvedValue({ data, error }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    _chain: chain,
  };
}
