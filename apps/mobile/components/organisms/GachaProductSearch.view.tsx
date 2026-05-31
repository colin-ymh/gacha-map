import {
  View,
  TextInput,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRef, useCallback, useEffect } from "react";
import type { GachaProduct } from "@gacha-map/shared";
import * as Colors from "@/constants/colors";

interface Props {
  query: string;
  results: GachaProduct[];
  isLoading: boolean;
  error: string | null;
  placeholder?: string;
  onQueryChange: (q: string) => void;
  onSelect: (product: GachaProduct) => void;
  onDismiss?: () => void;
}

const GachaProductSearchView = ({
  query,
  results,
  isLoading,
  error,
  placeholder = "가챠 상품 검색",
  onQueryChange,
  onSelect,
  onDismiss,
}: Props) => {
  const inputRef = useRef<TextInput>(null);
  const isInteractingRef = useRef(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearBlurTimer = useCallback(() => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  }, []);

  const clearInteractionEndTimer = useCallback(() => {
    if (interactionEndTimerRef.current) {
      clearTimeout(interactionEndTimerRef.current);
      interactionEndTimerRef.current = null;
    }
  }, []);

  const beginInteraction = useCallback(() => {
    clearInteractionEndTimer();
    isInteractingRef.current = true;
  }, [clearInteractionEndTimer]);

  const endInteractionSoon = useCallback(() => {
    clearInteractionEndTimer();
    interactionEndTimerRef.current = setTimeout(() => {
      isInteractingRef.current = false;
    }, 250);
  }, [clearInteractionEndTimer]);

  const handleInputBlur = useCallback(() => {
    clearBlurTimer();
    blurTimerRef.current = setTimeout(() => {
      if (isInteractingRef.current) {
        inputRef.current?.focus();
        return;
      }
      onDismiss?.();
    }, 80);
  }, [clearBlurTimer, onDismiss]);

  useEffect(() => {
    return () => {
      clearBlurTimer();
      clearInteractionEndTimer();
    };
  }, [clearBlurTimer, clearInteractionEndTimer]);

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={query}
        onChangeText={onQueryChange}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        placeholderTextColor={Colors.TEXT_PLACEHOLDER}
        autoCorrect={false}
        autoCapitalize="none"
      />

      {isLoading && (
        <ActivityIndicator
          size="small"
          color={Colors.PRIMARY}
          style={styles.loader}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {!isLoading && !error && query.trim() && results.length === 0 && (
        <Text style={styles.empty}>검색 결과가 없습니다.</Text>
      )}

      {results.length > 0 && (
        <View
          style={styles.dropdown}
          onTouchStart={beginInteraction}
          onTouchEnd={endInteractionSoon}
          onTouchCancel={endInteractionSoon}
          onStartShouldSetResponderCapture={() => {
            beginInteraction();
            return false;
          }}
        >
          <ScrollView
            style={styles.dropdownScroll}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            nestedScrollEnabled
            onScrollBeginDrag={beginInteraction}
            onMomentumScrollBegin={beginInteraction}
            onScrollEndDrag={endInteractionSoon}
            onMomentumScrollEnd={endInteractionSoon}
          >
            {results.map((item, index) => (
              <View key={item.id}>
                {index > 0 && <View style={styles.separator} />}
                <TouchableOpacity
                  style={styles.item}
                  activeOpacity={0.7}
                  onPressIn={beginInteraction}
                  onPress={() => {
                    clearBlurTimer();
                    clearInteractionEndTimer();
                    isInteractingRef.current = false;
                    onSelect(item);
                    onDismiss?.();
                  }}
                >
                  {item.official_image_url ? (
                    <Image
                      source={{ uri: item.official_image_url }}
                      style={styles.thumbnail}
                    />
                  ) : (
                    <View
                      style={[styles.thumbnail, styles.thumbnailPlaceholder]}
                    />
                  )}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.name_ko ?? item.name_ja ?? item.name}
                    </Text>
                    {item.name_ja != null && item.name_ko != null && (
                      <Text style={styles.itemNameJa} numberOfLines={1}>
                        {item.name_ja}
                      </Text>
                    )}
                    <View style={styles.itemBottom}>
                      <View style={styles.manufacturerTag}>
                        <Text style={styles.manufacturerTagText}>
                          {item.manufacturer}
                        </Text>
                      </View>
                      {item.price_jpy != null && (
                        <Text style={styles.itemPrice}>¥{item.price_jpy}</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    zIndex: 10,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: Colors.TEXT_DARK,
    backgroundColor: Colors.WHITE,
  },
  loader: {
    marginTop: 12,
  },
  error: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.DANGER,
    textAlign: "center",
  },
  empty: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.TEXT_GRAY,
    textAlign: "center",
  },
  dropdown: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 5,
    backgroundColor: Colors.WHITE,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    borderRadius: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  item: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: 6,
    flexShrink: 0,
  },
  thumbnailPlaceholder: {
    backgroundColor: Colors.THUMBNAIL_PLACEHOLDER,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 14,
    color: Colors.TEXT_DARK,
  },
  itemNameJa: {
    fontSize: 11,
    color: Colors.TEXT_GRAY,
  },
  itemBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  manufacturerTag: {
    alignSelf: "flex-start",
    backgroundColor: Colors.GRAY_200,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  manufacturerTagText: {
    fontSize: 11,
    color: Colors.TEXT_GRAY,
  },
  itemPrice: {
    fontSize: 12,
    color: Colors.TEXT_GRAY,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.GRAY_100,
  },
});

export default GachaProductSearchView;
