import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { getAuthHeaders } from "@/lib/supabase";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const TOKEN_STORAGE_KEY = "expo_push_token";

export async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function getStoredPushToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
}

async function setStoredPushToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
}

async function clearStoredPushToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
}

/**
 * 권한 요청 + Expo push token 발급 + 서버 등록.
 * 실기기가 아니거나 권한 거부 시 조용히 종료.
 */
export async function registerForPushNotifications(): Promise<void> {
  if (!Device.isDevice) return;

  await ensureAndroidNotificationChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as
    | string
    | undefined;
  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const token = tokenResponse.data;

  await setStoredPushToken(token);

  const headers = await getAuthHeaders();
  if (!headers.Authorization) return;

  await fetch(`${API_BASE}/api/notifications/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      token,
      platform: Platform.OS === "ios" ? "ios" : "android",
    }),
  });
}

/**
 * 로그아웃 시 이 기기에 등록된 토큰만 서버에서 삭제.
 */
export async function unregisterPushNotifications(): Promise<void> {
  const token = await getStoredPushToken();
  if (!token) return;

  const headers = await getAuthHeaders();

  try {
    await fetch(`${API_BASE}/api/notifications/token`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ token }),
    });
  } finally {
    await clearStoredPushToken();
  }
}
