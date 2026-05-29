import {
  View,
  TextInput,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
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
}

const GachaProductSearchView = ({
  query,
  results,
  isLoading,
  error,
  placeholder = "가챠 상품 검색",
  onQueryChange,
  onSelect,
}: Props) => {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={onQueryChange}
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

      <View>
        {results.map((item, index) => (
          <View key={item.id}>
            {index > 0 && <View style={styles.separator} />}
            <TouchableOpacity
              style={styles.item}
              onPress={() => onSelect(item)}
              activeOpacity={0.7}
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
                {item.price_jpy != null && (
                  <Text style={styles.itemPrice}>¥{item.price_jpy}</Text>
                )}
              </View>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  item: {
    paddingVertical: 10,
    paddingHorizontal: 4,
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
