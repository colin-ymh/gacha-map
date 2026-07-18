import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/auth.slice";
import wishlistReducer from "./slices/wishlist.slice";
import productWishlistReducer from "./slices/product-wishlist.slice";
import shopCacheReducer from "./slices/shop-cache.slice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    wishlist: wishlistReducer,
    productWishlist: productWishlistReducer,
    shopCache: shopCacheReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
