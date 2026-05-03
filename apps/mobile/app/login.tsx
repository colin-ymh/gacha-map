import { View, TouchableOpacity, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

export default function LoginScreen() {
  const router = useRouter();

  const handleKakaoLogin = () => {
    console.log("TODO: OAuth - Kakao");
  };

  const handleNaverLogin = () => {
    console.log("TODO: OAuth - Naver");
  };

  const handleGoogleLogin = () => {
    console.log("TODO: OAuth - Google");
  };

  const handleBrowseWithoutLogin = () => {
    router.back();
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View className="flex-1 px-6 justify-center">
        {/* Title Section */}
        <View className="mb-12">
          <Text
            style={{ fontSize: 32, fontWeight: "800", color: "#e63946" }}
            className="text-center mb-2"
          >
            가챠맵
          </Text>
          <Text
            style={{ fontSize: 24, fontWeight: "700", color: "#1a1a1a" }}
            className="text-center mb-2"
          >
            로그인
          </Text>
          <Text
            style={{ fontSize: 14, color: "#888888" }}
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
            className="w-full h-13 rounded-xl bg-yellow-300 flex-row items-center justify-center gap-0.5"
            style={{ backgroundColor: "#fee500" }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: "#3c1e1e",
              }}
            >
              카카오로 로그인
            </Text>
          </TouchableOpacity>

          {/* Naver Login */}
          <TouchableOpacity
            onPress={handleNaverLogin}
            className="w-full h-13 rounded-xl flex-row items-center justify-center"
            style={{ backgroundColor: "#03c75a" }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: "white",
              }}
            >
              네이버로 로그인
            </Text>
          </TouchableOpacity>

          {/* Google Login */}
          <TouchableOpacity
            onPress={handleGoogleLogin}
            className="w-full h-13 rounded-xl border flex-row items-center justify-center"
            style={{
              borderColor: "#e5e5e5",
              borderWidth: 1,
              backgroundColor: "white",
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: "#3c4043",
              }}
            >
              구글로 로그인
            </Text>
          </TouchableOpacity>
        </View>

        {/* Browse Without Login */}
        <View className="mt-8 items-center">
          <TouchableOpacity onPress={handleBrowseWithoutLogin}>
            <Text
              style={{
                fontSize: 13,
                color: "#888888",
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
