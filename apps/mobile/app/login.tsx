import { useState } from "react";
import {
  View,
  Text,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as AppleAuthentication from "expo-apple-authentication";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import {
  TEXT_GRAY,
  WHITE,
  BORDER,
  PRIMARY_BG_SOFT,
  KAKAO_BG,
  KAKAO_TEXT,
  NAVER_BG,
  NAVER_TEXT,
  GOOGLE_TEXT,
  APPLE_BG,
  APPLE_TEXT,
} from "@/constants/colors";

WebBrowser.maybeCompleteAuthSession();

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

function getAuthParam(url: string, name: string) {
  const parsed = new URL(url);
  const queryValue = parsed.searchParams.get(name);
  if (queryValue) return queryValue;

  const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
  return new URLSearchParams(hash).get(name);
}

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState<string | null>(null);

  const handleAuthSessionResult = async (url: string) => {
    if (!supabase) {
      Alert.alert(t("login.errorTitle"), t("login.serviceUnavailable"));
      return;
    }

    const code = getAuthParam(url, "code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        Alert.alert(t("login.errorTitle"), t("login.processingError"));
        return;
      }
      router.replace("/(tabs)" as never);
      return;
    }

    const accessToken = getAuthParam(url, "access_token");
    const refreshToken = getAuthParam(url, "refresh_token");
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        Alert.alert(t("login.errorTitle"), t("login.processingError"));
        return;
      }
      router.replace("/(tabs)" as never);
      return;
    }

    Alert.alert(t("login.errorTitle"), t("login.invalidResponse"));
  };

  const handleKakaoLogin = async () => {
    if (!API_BASE) {
      Alert.alert(t("login.errorTitle"), t("login.noServerUrl"));
      return;
    }

    setLoading("kakao");
    try {
      const redirectUrl = Linking.createURL("auth/callback");
      const authUrl = `${API_BASE}/api/auth/kakao?returnUrl=${encodeURIComponent(
        redirectUrl,
      )}`;

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUrl,
      );

      if (result.type === "success") {
        await handleAuthSessionResult(result.url);
      }
    } catch {
      Alert.alert(t("login.errorTitle"), t("login.genericError"));
    } finally {
      setLoading(null);
    }
  };

  const handleNaverLogin = async () => {
    if (!API_BASE) {
      Alert.alert(t("login.errorTitle"), t("login.noServerUrl"));
      return;
    }

    setLoading("naver");
    try {
      const redirectUrl = Linking.createURL("auth/callback");
      const authUrl = `${API_BASE}/api/auth/naver?returnUrl=${encodeURIComponent(
        redirectUrl,
      )}`;

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUrl,
      );

      if (result.type === "success") {
        await handleAuthSessionResult(result.url);
      }
    } catch {
      Alert.alert(t("login.errorTitle"), t("login.genericError"));
    } finally {
      setLoading(null);
    }
  };

  const handleGoogleLogin = async () => {
    if (!supabase) {
      Alert.alert(t("login.errorTitle"), t("login.serviceUnavailable"));
      return;
    }

    setLoading("google");
    try {
      const redirectUrl = Linking.createURL("auth/callback");

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) {
        Alert.alert(t("login.errorTitle"), t("login.getUrlFailed"));
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
      );

      if (result.type === "success") {
        await handleAuthSessionResult(result.url);
      }
    } catch {
      Alert.alert(t("login.errorTitle"), t("login.genericError"));
    } finally {
      setLoading(null);
    }
  };

  const handleAppleLogin = async () => {
    if (!supabase) {
      Alert.alert(t("login.errorTitle"), t("login.serviceUnavailable"));
      return;
    }
    if (loading !== null) return;

    setLoading("apple");
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        Alert.alert(t("login.errorTitle"), t("login.appleInfoFailed"));
        return;
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });

      if (error) {
        Alert.alert(t("login.errorTitle"), t("login.processingError"));
        return;
      }

      router.replace("/(tabs)" as never);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert(
          t("login.errorTitle"),
          `[${err.code ?? "unknown"}] ${err.message ?? t("login.genericError")}`,
        );
      }
    } finally {
      setLoading(null);
    }
  };

  const handleBrowseWithoutLogin = () => {
    router.replace("/(tabs)" as never);
  };

  return (
    <LinearGradient colors={[PRIMARY_BG_SOFT, WHITE]} style={{ flex: 1 }}>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Image
            source={require("../assets/images/gacha-map-logo-transparent.png")}
            style={{ width: 260, height: 45 }}
            resizeMode="contain"
            fadeDuration={0}
          />
        </View>

        {/* Bottom sheet: social buttons */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
          <View style={{ gap: 12 }}>
            {/* Apple Login — iOS only, matches native "start with" priority */}
            {Platform.OS === "ios" && (
              <PressableScale
                onPress={handleAppleLogin}
                disabled={loading !== null}
                className="w-full flex-row items-center justify-center"
                style={{
                  backgroundColor: APPLE_BG,
                  height: 56,
                  borderRadius: 999,
                }}
              >
                {loading === "apple" ? (
                  <ActivityIndicator color={APPLE_TEXT} />
                ) : (
                  <>
                    <Ionicons
                      name="logo-apple"
                      size={22}
                      color={APPLE_TEXT}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: APPLE_TEXT,
                      }}
                    >
                      {t("login.appleSignIn")}
                    </Text>
                  </>
                )}
              </PressableScale>
            )}

            {/* Kakao Login */}
            <PressableScale
              onPress={handleKakaoLogin}
              disabled={loading !== null}
              className="w-full flex-row items-center justify-center"
              style={{
                backgroundColor: KAKAO_BG,
                height: 56,
                borderRadius: 999,
              }}
            >
              {loading === "kakao" ? (
                <ActivityIndicator color={KAKAO_TEXT} />
              ) : (
                <>
                  <Image
                    source={require("../assets/images/kakao-logo.png")}
                    style={{ width: 20, height: 20, marginRight: 8 }}
                    resizeMode="contain"
                  />
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: KAKAO_TEXT,
                    }}
                  >
                    {t("login.kakao")}
                  </Text>
                </>
              )}
            </PressableScale>

            {/* Naver Login */}
            <PressableScale
              onPress={handleNaverLogin}
              disabled={loading !== null}
              className="w-full flex-row items-center justify-center"
              style={{
                backgroundColor: NAVER_BG,
                height: 56,
                borderRadius: 999,
              }}
            >
              {loading === "naver" ? (
                <ActivityIndicator color={NAVER_TEXT} />
              ) : (
                <>
                  <Image
                    source={require("../assets/images/naver-logo.png")}
                    style={{ width: 20, height: 20, marginRight: 8 }}
                    resizeMode="contain"
                  />
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: NAVER_TEXT,
                    }}
                  >
                    {t("login.naver")}
                  </Text>
                </>
              )}
            </PressableScale>

            {/* Google Login */}
            <PressableScale
              onPress={handleGoogleLogin}
              disabled={loading !== null}
              className="w-full flex-row items-center justify-center"
              style={{
                borderColor: BORDER,
                borderWidth: 1,
                backgroundColor: WHITE,
                height: 56,
                borderRadius: 999,
              }}
            >
              {loading === "google" ? (
                <ActivityIndicator color={GOOGLE_TEXT} />
              ) : (
                <>
                  <Image
                    source={require("../assets/images/google-logo.png")}
                    style={{ width: 20, height: 20, marginRight: 8 }}
                    resizeMode="contain"
                  />
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: GOOGLE_TEXT,
                    }}
                  >
                    {t("login.google")}
                  </Text>
                </>
              )}
            </PressableScale>
          </View>

          {/* Browse Without Login */}
          <View style={{ marginTop: 20, alignItems: "center" }}>
            <PressableScale
              onPress={handleBrowseWithoutLogin}
              disabled={loading !== null}
            >
              <Text style={{ fontSize: 13, color: TEXT_GRAY }}>
                {t("login.browse")}
              </Text>
            </PressableScale>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
