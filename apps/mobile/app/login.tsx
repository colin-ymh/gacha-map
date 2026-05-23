import { useState } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as AppleAuthentication from "expo-apple-authentication";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import {
  TEXT_DARK,
  TEXT_GRAY,
  WHITE,
  BORDER,
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
      Alert.alert("오류", "로그인 서비스를 사용할 수 없습니다.");
      return;
    }

    const code = getAuthParam(url, "code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        Alert.alert("오류", "로그인 처리 중 오류가 발생했습니다.");
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
        Alert.alert("오류", "로그인 처리 중 오류가 발생했습니다.");
        return;
      }
      router.replace("/(tabs)" as never);
      return;
    }

    Alert.alert("오류", "로그인 응답을 확인할 수 없습니다.");
  };

  const handleKakaoLogin = async () => {
    if (!API_BASE) {
      Alert.alert("오류", "로그인 서버 주소가 설정되지 않았습니다.");
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
      Alert.alert("오류", "로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  };

  const handleNaverLogin = async () => {
    if (!API_BASE) {
      Alert.alert("오류", "로그인 서버 주소가 설정되지 않았습니다.");
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
      Alert.alert("오류", "로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  };

  const handleGoogleLogin = async () => {
    if (!supabase) {
      Alert.alert("오류", "로그인 서비스를 사용할 수 없습니다.");
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
        Alert.alert("오류", "로그인 URL을 가져오는 데 실패했습니다.");
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
      Alert.alert("오류", "로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  };

  const handleAppleLogin = async () => {
    if (!supabase) {
      Alert.alert("오류", "로그인 서비스를 사용할 수 없습니다.");
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
        Alert.alert("오류", "Apple 로그인 정보를 가져오는 데 실패했습니다.");
        return;
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });

      if (error) {
        Alert.alert("오류", "로그인 처리 중 오류가 발생했습니다.");
        return;
      }

      router.replace("/(tabs)" as never);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert(
          "오류",
          `[${err.code ?? "unknown"}] ${err.message ?? "로그인 중 오류가 발생했습니다."}`,
        );
      }
    } finally {
      setLoading(null);
    }
  };

  const handleBrowseWithoutLogin = () => {
    router.back();
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View className="flex-1 px-6 justify-center">
        {/* Title Section */}
        <View className="mb-12">
          <Image
            source={require("../assets/images/gacha-map-logo.png")}
            style={{
              width: 200,
              height: 58,
              alignSelf: "center",
              marginBottom: 12,
            }}
            resizeMode="contain"
          />
          <Text
            style={{ fontSize: 24, fontWeight: "700", color: TEXT_DARK }}
            className="text-center mb-2"
          >
            로그인
          </Text>
          <Text
            style={{ fontSize: 14, color: TEXT_GRAY }}
            className="text-center"
          >
            가챠맵에 오신 걸 환영합니다
          </Text>
        </View>

        {/* Social Login Buttons */}
        <View className="gap-3">
          {/* Kakao Login */}
          <TouchableOpacity
            onPress={handleKakaoLogin}
            disabled={loading !== null}
            className="w-full rounded-xl flex-row items-center justify-center"
            style={{ backgroundColor: KAKAO_BG, height: 52 }}
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
                  style={{ fontSize: 16, fontWeight: "600", color: KAKAO_TEXT }}
                >
                  카카오로 로그인
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Naver Login */}
          <TouchableOpacity
            onPress={handleNaverLogin}
            disabled={loading !== null}
            className="w-full rounded-xl flex-row items-center justify-center"
            style={{ backgroundColor: NAVER_BG, height: 52 }}
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
                  style={{ fontSize: 16, fontWeight: "600", color: NAVER_TEXT }}
                >
                  네이버로 로그인
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Google Login */}
          <TouchableOpacity
            onPress={handleGoogleLogin}
            disabled={loading !== null}
            className="w-full rounded-xl flex-row items-center justify-center"
            style={{
              borderColor: BORDER,
              borderWidth: 1,
              backgroundColor: WHITE,
              height: 52,
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
                  구글로 로그인
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Apple Login — iOS only */}
          {Platform.OS === "ios" && (
            <TouchableOpacity
              onPress={handleAppleLogin}
              disabled={loading !== null}
              className="w-full rounded-xl flex-row items-center justify-center"
              style={{ backgroundColor: APPLE_BG, height: 52 }}
            >
              {loading === "apple" ? (
                <ActivityIndicator color={APPLE_TEXT} />
              ) : (
                <>
                  <Ionicons
                    name="logo-apple"
                    size={26}
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
            </TouchableOpacity>
          )}
        </View>

        {/* Browse Without Login */}
        <View className="mt-8 items-center">
          <TouchableOpacity
            onPress={handleBrowseWithoutLogin}
            disabled={loading !== null}
          >
            <Text
              style={{
                fontSize: 13,
                color: TEXT_GRAY,
                textDecorationLine: "underline",
              }}
            >
              로그인하지 않고 둘러보기
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
