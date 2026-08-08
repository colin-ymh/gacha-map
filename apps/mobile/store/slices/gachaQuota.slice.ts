import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getAuthHeaders } from "@/lib/supabase";
import type { GachaDailyQuota, GachaRollQuotaSummary } from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

interface GachaQuotaState {
  // nextAvailableAt은 화면들이 각자 별도 상태로 관리해서 캐시엔 안 둔다 —
  // roll-status 응답(GachaRollQuotaSummary)엔 애초에 없는 필드라, 여기 두면
  // 그 화면이 갱신할 때마다 값이 비거나 낡아서 두 출처가 항상 어긋난다.
  quota: GachaRollQuotaSummary | null;
  status: "idle" | "loading" | "succeeded" | "failed";
}

const initialState: GachaQuotaState = {
  quota: null,
  status: "idle",
};

/**
 * 앱 로그인 시 미리 한 번 채워두고(_layout.tsx), 뽑기 화면 진입 시엔 이
 * 캐시를 즉시 보여준 뒤 백그라운드로 다시 불러온다(stale-while-revalidate).
 * 매 화면이 각자 fetch-on-mount로 처음부터 받아오면 응답이 올 때까지 빈칸이
 * 보이는데, 여러 화면(roll/[id], gacha/[id])이 공유하는 캐시로 두면 어디서
 * 들어와도 즉시 보인다.
 */
export const fetchDailyQuotaAsync = createAsyncThunk(
  "gachaQuota/fetch",
  async () => {
    const headers = await getAuthHeaders();
    if (!headers.Authorization) return null;
    const res = await fetch(`${API_BASE}/api/gacha/quota`, { headers });
    if (!res.ok) return null;
    return (await res.json()) as GachaDailyQuota;
  },
);

const gachaQuotaSlice = createSlice({
  name: "gachaQuota",
  initialState,
  reducers: {
    // 뽑기 응답(GachaRollPermission)이나 roll-status 응답이 이미 최신 쿼터를
    // 담고 있으므로, 그 값을 그대로 캐시에 반영해 별도 재조회를 피한다.
    setQuota(state, action: { payload: GachaRollQuotaSummary }) {
      state.quota = action.payload;
      state.status = "succeeded";
    },
    clearQuota(state) {
      state.quota = null;
      state.status = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDailyQuotaAsync.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchDailyQuotaAsync.fulfilled, (state, action) => {
        state.status = "succeeded";
        if (action.payload) state.quota = action.payload;
      })
      .addCase(fetchDailyQuotaAsync.rejected, (state) => {
        state.status = "failed";
      });
  },
});

export const { setQuota, clearQuota } = gachaQuotaSlice.actions;
export default gachaQuotaSlice.reducer;
