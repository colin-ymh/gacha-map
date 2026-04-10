import { vi } from "vitest";

/**
 * Supabase 쿼리 빌더 체인을 모킹하는 유틸.
 * range() 또는 single() 호출 시 지정된 data/error/count를 반환한다.
 */
export function createSupabaseMock(
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
    range: vi.fn().mockResolvedValue({ data, error, count }),
    single: vi.fn().mockResolvedValue({ data, error }),
  };

  return {
    from: vi.fn().mockReturnValue(chain),
    _chain: chain,
  };
}
