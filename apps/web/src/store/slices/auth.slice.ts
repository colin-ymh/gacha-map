import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types";

interface AuthProfile {
  id: string;
  name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  avatar_thumb_url: string | null;
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

export const fetchUserAsync = createAsyncThunk(
  "auth/fetchUser",
  async (_, { rejectWithValue }) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { user: null, profile: null };

    const res = await fetch("/api/users/profile");
    if (!res.ok) return rejectWithValue("Failed to fetch profile");

    const { profile } = await res.json();
    return { user, profile };
  },
);

export const updateProfileAsync = createAsyncThunk(
  "auth/updateProfile",
  async (
    updates: { nickname?: string; avatar_url?: string; avatar_thumb_url?: string },
    { rejectWithValue },
  ) => {
    const res = await fetch("/api/users/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) return rejectWithValue("Failed to update profile");
    const { profile } = await res.json();
    return profile as AuthProfile;
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearAuth(state) {
      state.isLoggedIn = false;
      state.user = null;
      state.profile = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserAsync.fulfilled, (state, action) => {
        state.loading = false;
        const { user, profile } = action.payload;
        state.user = user;
        state.profile = profile;
        state.isLoggedIn = !!user;
      })
      .addCase(fetchUserAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.isLoggedIn = false;
      })
      .addCase(updateProfileAsync.fulfilled, (state, action) => {
        if (state.profile && action.payload) {
          state.profile = { ...state.profile, ...action.payload };
        }
      });
  },
});

export const { clearAuth } = authSlice.actions;

export const selectIsAdmin = (state: { auth: AuthState }) =>
  state.auth.profile?.role === "admin";

export const selectAvatarUrl = (state: { auth: AuthState }) =>
  state.auth.profile?.avatar_url ??
  state.auth.user?.user_metadata?.avatar_url ??
  null;

export default authSlice.reducer;
