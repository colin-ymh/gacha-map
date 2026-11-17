import { useCallback, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import { GRAY_100 } from "@/constants/colors";
import { setAddressPickerResult } from "@/lib/addressPickerResult";
import type { AddressPickerSource } from "@/lib/addressPickerResult";

// Daum 우편번호 서비스를 WebView에 전체화면 임베드한다. 자유 텍스트 입력 +
// Kakao Local 지오코딩 대신 이 위젯으로 도로명주소를 정확히 고르게 한다 —
// 사업자가 매일 보는 표준 주소 검색 UI라 신뢰도가 높고, 건물명 매칭·지번/도로명
// 폴백이 자체 구현보다 정교하다.
const POSTCODE_ORIGIN = "https://t1.kakaocdn.net";
const POSTCODE_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>html,body,#wrap{margin:0;padding:0;height:100%;width:100%;}</style>
</head>
<body>
<div id="wrap"></div>
<script src="${POSTCODE_ORIGIN}/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>
<script>
new daum.Postcode({
  oncomplete: function(data) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: "complete",
      roadAddress: data.roadAddress,
      jibunAddress: data.jibunAddress
    }));
  },
  onclose: function(state) {
    if (state === "FORCE_CLOSE") {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "close" }));
    }
  },
  width: "100%",
  height: "100%"
}).embed(document.getElementById("wrap"));
</script>
</body>
</html>
`;

export default function AddressPickerScreen() {
  const router = useRouter();
  const source: AddressPickerSource = "shop-application";

  const html = useMemo(() => POSTCODE_HTML, []);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let data: { type?: string; roadAddress?: string; jibunAddress?: string };
      try {
        data = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }

      if (data.type === "complete") {
        const address = data.roadAddress || data.jibunAddress;
        if (address) {
          setAddressPickerResult({ source, address });
        }
        router.back();
        return;
      }

      if (data.type === "close") {
        router.back();
      }
    },
    [router, source],
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      {/* 절대 배치 FAB이 Daum 위젯 상단 입력창을 가리는 문제가 있었다.
          겹칠 걱정 없게 일반 flow에 헤더를 두고 WebView는 그 아래부터 시작한다. */}
      <View style={styles.header}>
        <GlassBackButton onPress={() => router.back()} />
      </View>
      <WebView
        source={{ html, baseUrl: POSTCODE_ORIGIN }}
        originWhitelist={["*"]}
        onMessage={handleMessage}
        style={styles.webview}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: GRAY_100,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  webview: {
    flex: 1,
    backgroundColor: GRAY_100,
  },
});
