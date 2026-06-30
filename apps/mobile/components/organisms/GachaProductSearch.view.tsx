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
import { useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
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
  placeholder,
  onQueryChange,
  onSelect,
  onDismiss,
}: Props) => {
  const { t } = useTranslation();
  const inputRef = useRef<TextInput>(null);

  const handleSelect = useCallback(
    (item: GachaProduct) => {
      onSelect(item);
      onDismiss?.();
    },
    [onSelect, onDismiss],
  );

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={query}
        onChangeText={onQueryChange}
        placeholder={placeholder ?? t("gacha.search.placeholder")}
        placeholderTextColor={Colors.TEXT_PLACEHOLDER}
        autoCorrect={false}
        autoCapitalize="none"
        blurOnSubmit={false}
        returnKeyType="search"
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
        <Text style={styles.empty}>{t("gacha.search.empty")}</Text>
      )}

      {results.length > 0 && (
        <View style={styles.dropdown}>
          <ScrollView
            style={styles.dropdownScroll}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
          >
            {results.map((item, index) => (
              <View key={item.id}>
                {index > 0 && <View style={styles.separator} />}
                <TouchableOpacity
                  style={styles.item}
                  activeOpacity={0.7}
                  onPress={() => handleSelect(item)}
                >
                  {item.official_image_url ? (
                    <Image
                      source={{ uri: item.official_image_url }}
                      style={styles.thumbnail}
                    />
                  ) : (
                    <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
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
    overflow: "visible",
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
    zIndex: 100,
    elevation: 8,
    backgroundColor: Colors.WHITE,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    borderRadius: 8,
    overflow: "hidden",
    shadowColor: Colors.BLACK,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  dropdownScroll: {
    maxHeight: 240,
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
