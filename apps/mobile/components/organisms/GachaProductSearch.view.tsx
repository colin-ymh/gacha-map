import {
  View,
  TextInput,
  FlatList,
  Text,
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

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => onSelect(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.itemName} numberOfLines={2}>
              {item.name}
            </Text>
            {item.price_jpy != null && (
              <Text style={styles.itemPrice}>¥{item.price_jpy}</Text>
            )}
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
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
    paddingVertical: 12,
    paddingHorizontal: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    color: Colors.TEXT_DARK,
    marginRight: 8,
  },
  itemPrice: {
    fontSize: 13,
    color: Colors.TEXT_GRAY,
    flexShrink: 0,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.GRAY_100,
  },
});

export default GachaProductSearchView;
