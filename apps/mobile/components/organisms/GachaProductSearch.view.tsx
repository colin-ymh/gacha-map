import {
  View,
  TextInput,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import GachaPlaceholder from "@/components/ui/GachaPlaceholder";
import { SkeletonBone } from "@/components/ui/Skeleton";
import { useRef, useCallback, useState } from "react";
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
  onNewProduct?: (query: string) => void;
}

function SearchResultItem({
  item,
  onSelect,
}: {
  item: GachaProduct;
  onSelect: (item: GachaProduct) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const showPlaceholder = !item.official_image_url || imgError;
  return (
    <TouchableOpacity
      style={styles.item}
      activeOpacity={0.7}
      onPress={() => onSelect(item)}
    >
      {showPlaceholder ? (
        <GachaPlaceholder size={64} borderRadius={8} />
      ) : (
        <Image
          source={{ uri: item.official_image_url! }}
          style={styles.thumbnail}
          onError={() => setImgError(true)}
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
            <Text style={styles.manufacturerTagText}>{item.manufacturer}</Text>
          </View>
          {item.price_jpy != null && (
            <Text style={styles.itemPrice}>¥{item.price_jpy}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
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
  onNewProduct,
}: Props) => {
  const { t } = useTranslation();
  const inputRef = useRef<TextInput>(null);

  const hasDropdown =
    !isLoading && !error && !!query.trim() && (results.length > 0 || !!onNewProduct);

  const handleSelect = useCallback(
    (item: GachaProduct) => {
      onSelect(item);
      onQueryChange("");
      onDismiss?.();
    },
    [onSelect, onQueryChange, onDismiss],
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
        <View style={styles.skeletonContainer}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <SkeletonBone width={64} height={64} borderRadius={8} />
              <View style={styles.skeletonInfo}>
                <SkeletonBone width="60%" height={15} />
                <SkeletonBone width="40%" height={12} />
              </View>
            </View>
          ))}
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {hasDropdown && (
        <View style={styles.dropdown}>
          <ScrollView
            style={styles.dropdownScroll}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
          >
            {onNewProduct && (
              <TouchableOpacity
                style={styles.reportItem}
                activeOpacity={0.7}
                onPress={() => {
                  onNewProduct(query.trim());
                  onQueryChange("");
                  onDismiss?.();
                }}
              >
                <View style={styles.reportIcon}>
                  <Text style={styles.reportIconText}>+</Text>
                </View>
                <Text style={styles.reportLabel} numberOfLines={1}>
                  "{query.trim()}" {t("gacha.search.reportNew")}
                </Text>
              </TouchableOpacity>
            )}

            {results.map((item) => (
              <View key={item.id}>
                <View style={styles.separator} />
                <SearchResultItem item={item} onSelect={handleSelect} />
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  input: {
    height: 44,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.TEXT_DARK,
    backgroundColor: Colors.GRAY_100,
    borderRadius: 12,
  },
  skeletonContainer: {
    marginTop: 12,
    paddingHorizontal: 12,
  },
  skeletonRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
  },
  skeletonInfo: {
    flex: 1,
    justifyContent: "center",
    gap: 6,
  },
  error: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.DANGER,
    textAlign: "center",
  },
  dropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.WHITE,
    shadowColor: Colors.BLACK,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  dropdownScroll: {
    maxHeight: 320,
  },
  item: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
    flexShrink: 0,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 15,
    color: Colors.TEXT_DARK,
  },
  itemNameJa: {
    fontSize: 12,
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
  reportItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: Colors.PRIMARY_BG_SOFT,
  },
  reportIcon: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: Colors.PRIMARY_BG,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  reportIconText: {
    fontSize: 22,
    color: Colors.PRIMARY,
    lineHeight: 26,
  },
  reportLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.PRIMARY,
  },
});

export default GachaProductSearchView;
