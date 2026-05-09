import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ko from "../messages/ko.json";
import en from "../messages/en.json";
import ja from "../messages/ja.json";
import zh from "../messages/zh.json";

const LANG_KEY = "app_lang";
const SUPPORTED = ["ko", "en", "ja", "zh"];

const deviceLocale = Localization.getLocales()[0]?.languageCode ?? "ko";
const defaultLang = SUPPORTED.includes(deviceLocale) ? deviceLocale : "ko";

i18n.use(initReactI18next).init({
  resources: {
    ko: { translation: ko },
    en: { translation: en },
    ja: { translation: ja },
    zh: { translation: zh },
  },
  lng: defaultLang,
  fallbackLng: "ko",
  interpolation: { escapeValue: false },
});

export const initLanguage = async () => {
  const saved = await AsyncStorage.getItem(LANG_KEY);
  if (saved && SUPPORTED.includes(saved)) {
    await i18n.changeLanguage(saved);
  }
};

export const changeLanguage = async (lang: string) => {
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(LANG_KEY, lang);
};

export default i18n;
