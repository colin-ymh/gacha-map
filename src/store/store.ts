import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/auth.slice";
import wishlistReducer from "./slices/wishlist.slice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    wishlist: wishlistReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
