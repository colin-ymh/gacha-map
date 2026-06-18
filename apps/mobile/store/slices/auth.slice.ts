import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { User } from "@supabase/supabase-js";
import type { UserRole } from "@gacha-map/shared";

interface AuthProfile {
  id: string;
  name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  avatar_thumb_url: string | null;
  role: UserRole;
  contribution_count: number;
  main_badge: { id: string; name: string; icon_url: string } | null;
}

export interface PendingBadge {
  id: string;
  name: string;
  icon_url: string;
}

interface AuthState {
  isLoggedIn: boolean | null;
  user: User | null;
  profile: AuthProfile | null;
  loading: boolean;
  error: string | null;
  pendingBadgeNotifications: PendingBadge[];
}

const initialState: AuthState = {
  isLoggedIn: null,
  user: null,
  profile: null,
  loading: false,
  error: null,
  pendingBadgeNotifications: [],
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: { payload: { user: User; profile: AuthProfile } }) {
      state.user = action.payload.user;
      state.profile = action.payload.profile;
      state.isLoggedIn = true;
      state.loading = false;
    },
    setProfile(state, action: { payload: AuthProfile }) {
      state.profile = action.payload;
    },
    clearAuth(state) {
      state.isLoggedIn = false;
      state.user = null;
      state.profile = null;
    },
    setLoading(state, action: { payload: boolean }) {
      state.loading = action.payload;
    },
    setPendingBadgeNotifications(state, action: { payload: PendingBadge[] }) {
      state.pendingBadgeNotifications = action.payload;
    },
    shiftPendingBadge(state) {
      state.pendingBadgeNotifications =
        state.pendingBadgeNotifications.slice(1);
    },
    setProfileMainBadge(
      state,
      action: {
        payload: { id: string; name: string; icon_url: string } | null;
      },
    ) {
      if (state.profile) {
        state.profile.main_badge = action.payload;
      }
    },
    addPendingBadge(state, action: PayloadAction<PendingBadge>) {
      state.pendingBadgeNotifications = [
        ...state.pendingBadgeNotifications,
        action.payload,
      ];
    },
  },
});

export const {
  setUser,
  setProfile,
  clearAuth,
  setLoading,
  setPendingBadgeNotifications,
  shiftPendingBadge,
  setProfileMainBadge,
  addPendingBadge,
} = authSlice.actions;

export const selectIsAdmin = (state: { auth: AuthState }) =>
  state.auth.profile?.role === "admin";

export const selectAvatarUrl = (state: { auth: AuthState }) =>
  state.auth.profile?.avatar_url ?? null;

export default authSlice.reducer;
