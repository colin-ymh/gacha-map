import { createSlice } from "@reduxjs/toolkit";
import type { User } from "@supabase/supabase-js";
import type { UserRole } from "@gacha-map/shared";

interface AuthProfile {
  id: string;
  name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  role: UserRole;
}

interface AuthState {
  isLoggedIn: boolean | null;
  user: User | null;
  profile: AuthProfile | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  isLoggedIn: null,
  user: null,
  profile: null,
  loading: false,
  error: null,
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
  },
});

export const { setUser, setProfile, clearAuth, setLoading } =
  authSlice.actions;

export const selectIsAdmin = (state: { auth: AuthState }) =>
  state.auth.profile?.role === "admin";

export const selectAvatarUrl = (state: { auth: AuthState }) =>
  state.auth.profile?.avatar_url ?? null;

export default authSlice.reducer;
