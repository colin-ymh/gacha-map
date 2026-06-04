import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, act } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { render } from "@/test/render";
import type { Shop } from "@/types";

// Header, NaverMap, ShopList 모킹으로 MapClient 로직에만 집중
vi.mock("@/components/organisms/common/header", () => ({
  default: () => <div data-testid="header" />,
}));

vi.mock("@/components/organisms/map/naver-map", () => {
  let clickCount = 0;

  return {
    default: ({
      onBoundsChange,
      onShopClick,
    }: {
      onBoundsChange?: (b: unknown) => void;
      onShopClick?: (shop: Shop) => void;
      shops?: Shop[];
      selectedShopId?: string;
    }) => (
      <div
        data-testid="naver-map"
        onClick={() => {
          clickCount += 1;
          onBoundsChange?.({
            swLat: 37.0 + clickCount * 0.2,
            swLng: 126.5,
            neLat: 38.0 + clickCount * 0.2,
            neLng: 127.5,
          });
        }}
        onDoubleClick={() =>
          onShopClick?.({
            id: "shop-clicked",
            name: "클릭된 샵",
            address: null,
            lat: 37.5,
            lng: 127.0,
            description: null,
            phone: null,
            opening_hours: null,
            tags: [],
            status: "active",
            is_authorized: true,
            place_id: null,
            candidate_group_id: null,
            reported_by: null,
            created_at: "",
            updated_at: "",
          })
        }
      />
    ),
  };
});

vi.mock("@/components/organisms/common/shop-list", () => ({
  default: ({
    shops,
    isLoading,
    onShopSelect,
  }: {
    shops: Shop[];
    isLoading?: boolean;
    onShopSelect?: (id: string) => void;
    emptyMessage?: string;
    showCount?: boolean;
    selectedShopId?: string;
  }) => (
    <div data-testid="shop-list">
      {isLoading && <span data-testid="loading">로딩 중</span>}
      {shops.map((s) => (
        <button key={s.id} onClick={() => onShopSelect?.(s.id)}>
          {s.name}
        </button>
      ))}
    </div>
  ),
}));

const mockShops: Shop[] = [
  {
    id: "shop-1",
    name: "샵 1",
    address: "주소 1",
    lat: 37.5,
    lng: 127.0,
    description: null,
    phone: null,
    opening_hours: null,
    tags: [],
    status: "active",
    is_authorized: true,
    place_id: null,
    candidate_group_id: null,
    reported_by: null,
    created_at: "",
    updated_at: "",
  },
];

describe("MapClient", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ shops: mockShops, total: mockShops.length }),
    } as Response);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  async function renderMapClient() {
    const { default: MapClient } = await import("../map-client");
    return render(<MapClient />);
  }

  it("초기 렌더링 시 shop-list가 표시된다", async () => {
    await renderMapClient();
    expect(screen.getAllByTestId("shop-list").length).toBeGreaterThan(0);
  });

  it("bounds 변경 후 300ms 이후 fetch가 1회 호출된다", async () => {
    await renderMapClient();
    const map = screen.getByTestId("naver-map");

    // bounds 변경 이벤트 3번 빠르게 발생
    fireEvent.click(map);
    fireEvent.click(map);
    fireEvent.click(map);

    // debounce 300ms 전 - fetch 호출 없음
    expect(fetchSpy).not.toHaveBeenCalled();

    // 300ms 경과
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/shops?"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("fetch 완료 후 샵 목록이 렌더링된다", async () => {
    await renderMapClient();
    const map = screen.getByTestId("naver-map");

    fireEvent.click(map);

    // advanceTimersByTimeAsync: 타이머 실행 + 결과 프로미스(fetch, setState) 플러시
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // ShopList가 사이드바+바텀시트에 2개 렌더링되므로 getAllByText 사용
    expect(screen.getAllByText("샵 1").length).toBeGreaterThan(0);
  });

  it("마커 클릭(onShopClick) 시 선택된 샵이 업데이트된다", async () => {
    await renderMapClient();
    const map = screen.getByTestId("naver-map");

    // bounds 변경으로 mockShops 로드
    fireEvent.click(map);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getAllByText("샵 1").length).toBeGreaterThan(0);

    // 더블클릭으로 onShopClick 트리거 (에러 없이 처리됨을 확인)
    fireEvent.dblClick(map);
    expect(screen.getByTestId("naver-map")).toBeInTheDocument();
  });

  it("fetch 에러(비 AbortError) 시 shops가 빈 배열로 설정된다", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("Network error"));

    await renderMapClient();
    const map = screen.getByTestId("naver-map");

    fireEvent.click(map);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.queryByText("샵 1")).not.toBeInTheDocument();
  });

  it("빠른 연속 bounds 변경 시 이전 요청이 abort된다", async () => {
    const abortSpy = vi.fn();
    const originalAbortController = global.AbortController;

    class MockAbortController {
      signal = {
        aborted: false,
        name: "AbortSignal",
      } as unknown as AbortSignal;
      abort = abortSpy;
    }
    global.AbortController =
      MockAbortController as unknown as typeof AbortController;

    await renderMapClient();
    const map = screen.getByTestId("naver-map");

    // 첫 번째 bounds 변경 → 300ms 경과 (첫 fetch 시작)
    fireEvent.click(map);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // 두 번째 bounds 변경 → 300ms 경과 (두 번째 fetch 시작, 첫 번째 abort)
    fireEvent.click(map);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(abortSpy).toHaveBeenCalledTimes(1);

    global.AbortController = originalAbortController;
  });
});
