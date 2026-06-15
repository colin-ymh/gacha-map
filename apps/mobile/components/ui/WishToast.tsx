import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { WHITE } from "@/constants/colors";

type ToastType = "added" | "removed" | "error" | "quickReport";

interface WishToastContextValue {
  showToast: (type: ToastType) => void;
}

const WishToastContext = createContext<WishToastContextValue>({
  showToast: () => {},
});

export function useWishToast() {
  return useContext(WishToastContext);
}

export function WishToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [toastType, setToastType] = useState<ToastType | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisibleRef = useRef(false);

  const showToast = useCallback(
    (type: ToastType) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToastType(type);

      if (!isVisibleRef.current) {
        isVisibleRef.current = true;
        opacity.setValue(0);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }).start();
      }

      hideTimer.current = setTimeout(() => {
        isVisibleRef.current = false;
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }).start(() => setToastType(null));
      }, 1500);
    },
    [opacity],
  );

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const getMessage = () => {
    if (toastType === "added") return t("wishlist.added");
    if (toastType === "removed") return t("wishlist.removed");
    if (toastType === "error") return t("wishlist.error");
    if (toastType === "quickReport") return t("gacha.quickReport.toastSuccess");
    return "";
  };

  return (
    <WishToastContext.Provider value={{ showToast }}>
      {children}
      {toastType !== null && (
        <Animated.View
          style={[styles.toast, { top: insets.top + 16, opacity }]}
          pointerEvents="none"
        >
          <Text style={styles.text}>{getMessage()}</Text>
        </Animated.View>
      )}
    </WishToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    alignSelf: "center",
    left: 24,
    right: 24,
    backgroundColor: "rgba(30,30,30,0.88)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  text: {
    color: WHITE,
    fontSize: 14,
    fontWeight: "500",
  },
});
