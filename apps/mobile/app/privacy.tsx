import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

const PrivacyScreen = () => {
  const router = useRouter();
  const { t } = useTranslation();

  const sections = [
    ["s1Title", ["s1p1", "s1p2"]],
    ["s2Title", ["s2p1", "s2p2"]],
    ["s3Title", ["s3p1", "s3p2"]],
    ["s4Title", ["s4p1"]],
    ["s5Title", ["s5p1"]],
    ["s6Title", ["s6p1"]],
    ["s7Title", ["s7p1", "s7p2"]],
    ["s8Title", ["s8p1"]],
  ] as const;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View className="h-13 border-b border-[#e5e7eb] flex-row items-center px-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-xl text-[#1a1a1a]">‹</Text>
        </TouchableOpacity>
        <Text className="text-center flex-1 text-base font-semibold text-[#1a1a1a]">
          {t("privacy.title")}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView className="flex-1 px-5 py-5">
        <Text className="text-lg font-bold text-[#1a1a1a] mb-4">
          {t("privacy.title")}
        </Text>

        {sections.map(([titleKey, paragraphKeys]) => (
          <View key={titleKey} className="mb-5">
            <Text className="text-base font-semibold text-[#1a1a1a] mb-2">
              {t(`privacy.${titleKey}`)}
            </Text>
            {paragraphKeys.map((paragraphKey) => (
              <Text
                key={paragraphKey}
                className="text-sm text-[#444444] mb-2"
                style={{ lineHeight: 22 }}
              >
                {t(`privacy.${paragraphKey}`)}
              </Text>
            ))}
          </View>
        ))}

        <Text className="text-sm text-[#888888] mt-3 mb-8">
          {t("privacy.effectiveDate")}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PrivacyScreen;
