import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import { TEXT_DARK, TEXT_BODY, TEXT_GRAY } from "@/constants/colors";

const TermsScreen = () => {
  const router = useRouter();
  const { t } = useTranslation();

  const sections = [
    ["s1Title", ["s1p1"]],
    ["s2Title", ["s2p1", "s2p2"]],
    ["s3Title", ["s3p1", "s3p2"]],
    ["s4Title", ["s4p1", "s4p2"]],
    ["s5Title", ["s5p1", "s5p2"]],
    ["s6Title", ["s6p1"]],
    ["s7Title", ["s7p1", "s7p2"]],
    ["s8Title", ["s8p1"]],
  ] as const;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View
        className="flex-row items-center px-4"
        style={{ height: 58, paddingBottom: 6 }}
      >
        <GlassBackButton onPress={() => router.back()} />
        <Text
          className="text-center flex-1 text-base font-semibold"
          style={{ color: TEXT_DARK }}
        >
          {t("terms.title")}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView className="flex-1 px-5 py-5">
        <Text className="text-lg font-bold mb-4" style={{ color: TEXT_DARK }}>
          {t("terms.title")}
        </Text>

        {sections.map(([titleKey, paragraphKeys]) => (
          <View key={titleKey} className="mb-5">
            <Text
              className="text-base font-semibold mb-2"
              style={{ color: TEXT_DARK }}
            >
              {t(`terms.${titleKey}`)}
            </Text>
            {paragraphKeys.map((paragraphKey) => (
              <Text
                key={paragraphKey}
                className="text-sm mb-2"
                style={{ color: TEXT_BODY, lineHeight: 22 }}
              >
                {t(`terms.${paragraphKey}`)}
              </Text>
            ))}
          </View>
        ))}

        <Text className="text-sm mt-3 mb-8" style={{ color: TEXT_GRAY }}>
          {t("terms.effectiveDate")}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TermsScreen;
