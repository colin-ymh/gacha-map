import { TouchableOpacity, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GRAY_100, TEXT_GRAY, BLACK } from "@/constants/colors";

interface SearchBarProps {
  placeholder: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

const SearchBar = ({ placeholder, onPress, style }: SearchBarProps) => (
  <TouchableOpacity style={[styles.bar, style]} activeOpacity={1} onPress={onPress}>
    <Ionicons name="search" size={18} color={TEXT_GRAY} />
    <Text style={styles.placeholder}>{placeholder}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  bar: {
    height: 44,
    backgroundColor: GRAY_100,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 8,
    shadowColor: BLACK,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  placeholder: {
    flex: 1,
    fontSize: 14,
    color: TEXT_GRAY,
  },
});

export default SearchBar;
