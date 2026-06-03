import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { getAuthHeaders } from "@/lib/supabase";
import GachaProductSearch from "@/components/organisms/GachaProductSearch";
import type { ShopGachaProductInternal, GachaProduct } from "@gacha-map/shared";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_100,
  GRAY_200,
  WHITE,
  BORDER,
  SUCCESS_BG,
  SUCCESS_TEXT,
  THUMBNAIL_PLACEHOLDER,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

type EditingItem = {
  id: string;
  price_krw: string;
  availability_status: "available" | "sold_out";
};

export default function ShopOwnerGachaScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [products, setProducts] = useState<ShopGachaProductInternal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [newProduct, setNewProduct] = useState<GachaProduct | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [newStatus, setNewStatus] = useState<"available" | "sold_out">(
    "available",
  );

  const tG = useCallback((key: string) => t(`gacha.ownerGacha.${key}`), [t]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/shop-owner/gacha-products`, {
        headers,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProducts(data.products ?? []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleAddSubmit = useCallback(async () => {
    if (!newProduct) return;
    setIsSaving(true);
    try {
      const headers = await getAuthHeaders();
      const body: Record<string, unknown> = {
        gacha_product_id: newProduct.id,
        availability_status: newStatus,
      };
      const parsed = parseInt(newPrice, 10);
      if (!isNaN(parsed) && parsed >= 0) body.price_krw = parsed;

      const res = await fetch(`${API_BASE}/api/shop-owner/gacha-products`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProducts((prev) => {
        const exists = prev.find((p) => p.id === data.product.id);
        if (exists)
          return prev.map((p) => (p.id === data.product.id ? data.product : p));
        return [data.product, ...prev];
      });
      setIsAdding(false);
      setNewProduct(null);
      setNewPrice("");
      setNewStatus("available");
      Alert.alert(tG("saveSuccess"));
    } catch {
      Alert.alert(tG("saveError"));
    } finally {
      setIsSaving(false);
    }
  }, [newProduct, newPrice, newStatus, tG]);

  const handleEditSubmit = useCallback(async () => {
    if (!editingItem) return;
    setIsSaving(true);
    try {
      const headers = await getAuthHeaders();
      const body: Record<string, unknown> = {
        availability_status: editingItem.availability_status,
      };
      const parsed = parseInt(editingItem.price_krw, 10);
      if (!isNaN(parsed) && parsed >= 0) body.price_krw = parsed;

      const res = await fetch(
        `${API_BASE}/api/shop-owner/gacha-products/${editingItem.id}`,
        {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProducts((prev) =>
        prev.map((p) => (p.id === data.product.id ? data.product : p)),
      );
      setEditingItem(null);
      Alert.alert(tG("saveSuccess"));
    } catch {
      Alert.alert(tG("saveError"));
    } finally {
      setIsSaving(false);
    }
  }, [editingItem, tG]);

  const handleDelete = useCallback(
    async (id: string) => {
      Alert.alert(tG("deleteConfirm"), undefined, [
        { text: t("gacha.report.cancelBtn"), style: "cancel" },
        {
          text: tG("deleteBtn"),
          style: "destructive",
          onPress: async () => {
            let snapshot: ShopGachaProductInternal | undefined;
            let snapshotIndex = -1;
            setProducts((prev) => {
              snapshotIndex = prev.findIndex((p) => p.id === id);
              snapshot = prev[snapshotIndex];
              return prev.filter((p) => p.id !== id);
            });
            const restore = () => {
              if (snapshot !== undefined) {
                setProducts((prev) => {
                  const next = [...prev];
                  next.splice(snapshotIndex, 0, snapshot!);
                  return next;
                });
              }
            };
            try {
              const headers = await getAuthHeaders();
              const res = await fetch(
                `${API_BASE}/api/shop-owner/gacha-products/${id}`,
                { method: "DELETE", headers },
              );
              if (res.ok || res.status === 204) {
                Alert.alert(tG("deleteSuccess"));
              } else {
                restore();
                Alert.alert(tG("deleteError"));
              }
            } catch {
              restore();
              Alert.alert(tG("deleteError"));
            }
          },
        },
      ]);
    },
    [t, tG],
  );

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: WHITE }}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{tG("title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps={
            isSearchDropdownOpen ? "always" : "handled"
          }
          keyboardDismissMode="none"
          scrollEnabled={!isSearchDropdownOpen}
          ListHeaderComponent={
            <View style={{ padding: 16, gap: 16 }}>
              {/* 추가 폼 */}
              {isAdding ? (
                <View style={styles.addForm}>
                  <GachaProductSearch
                    placeholder={t("gacha.report.searchPlaceholder")}
                    onSelect={setNewProduct}
                    onResultsChange={setIsSearchDropdownOpen}
                  />
                  {newProduct && (
                    <View style={styles.selectedCard}>
                      <Text style={styles.selectedLabel}>
                        {newProduct.name_ko ??
                          newProduct.name_ja ??
                          newProduct.name}
                      </Text>
                      <Text style={styles.selectedSub}>
                        {newProduct.manufacturer}
                      </Text>
                    </View>
                  )}

                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>{tG("priceLabel")}</Text>
                    <TextInput
                      style={styles.input}
                      value={newPrice}
                      onChangeText={setNewPrice}
                      keyboardType="number-pad"
                      placeholder={tG("pricePlaceholder")}
                      placeholderTextColor={TEXT_GRAY}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>{tG("statusLabel")}</Text>
                    <View style={styles.statusRow}>
                      {(["available", "sold_out"] as const).map((s) => (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.statusOption,
                            newStatus === s && styles.statusOptionActive,
                          ]}
                          onPress={() => setNewStatus(s)}
                        >
                          <Text
                            style={[
                              styles.statusOptionText,
                              newStatus === s && styles.statusOptionTextActive,
                            ]}
                          >
                            {tG(
                              s === "available"
                                ? "statusAvailable"
                                : "statusSoldOut",
                            )}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
                      onPress={handleAddSubmit}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <ActivityIndicator color={WHITE} size="small" />
                      ) : (
                        <Text style={styles.saveBtnText}>{tG("saveBtn")}</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => {
                        setIsAdding(false);
                        setNewProduct(null);
                        setNewPrice("");
                      }}
                    >
                      <Text style={styles.cancelBtnText}>
                        {tG("cancelBtn")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => setIsAdding(true)}
                >
                  <Text style={styles.addBtnText}>{tG("addBtn")}</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.center}>
                <Text style={styles.emptyText}>{tG("empty")}</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isEditing = editingItem?.id === item.id;

            return (
              <View style={styles.row}>
                {item.gacha_product.official_image_url ? (
                  <Image
                    source={{ uri: item.gacha_product.official_image_url }}
                    style={styles.thumbnail}
                  />
                ) : (
                  <View
                    style={[styles.thumbnail, styles.thumbnailPlaceholder]}
                  />
                )}

                <View style={styles.rowInfo}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {item.gacha_product.name_ko ??
                      item.gacha_product.name_ja ??
                      item.gacha_product.name}
                  </Text>
                  <Text style={styles.manufacturer}>
                    {item.gacha_product.manufacturer}
                  </Text>

                  {isEditing ? (
                    <View style={{ gap: 8, marginTop: 8 }}>
                      <TextInput
                        style={styles.input}
                        value={editingItem.price_krw}
                        onChangeText={(v) =>
                          setEditingItem((prev) =>
                            prev ? { ...prev, price_krw: v } : prev,
                          )
                        }
                        keyboardType="number-pad"
                        placeholder={tG("pricePlaceholder")}
                        placeholderTextColor={TEXT_GRAY}
                      />
                      <View style={styles.statusRow}>
                        {(["available", "sold_out"] as const).map((s) => (
                          <TouchableOpacity
                            key={s}
                            style={[
                              styles.statusOption,
                              editingItem.availability_status === s &&
                                styles.statusOptionActive,
                            ]}
                            onPress={() =>
                              setEditingItem((prev) =>
                                prev
                                  ? { ...prev, availability_status: s }
                                  : prev,
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.statusOptionText,
                                editingItem.availability_status === s &&
                                  styles.statusOptionTextActive,
                              ]}
                            >
                              {tG(
                                s === "available"
                                  ? "statusAvailable"
                                  : "statusSoldOut",
                              )}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <View style={styles.btnRow}>
                        <TouchableOpacity
                          style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
                          onPress={handleEditSubmit}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <ActivityIndicator color={WHITE} size="small" />
                          ) : (
                            <Text style={styles.saveBtnText}>
                              {tG("saveBtn")}
                            </Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.cancelBtn}
                          onPress={() => setEditingItem(null)}
                        >
                          <Text style={styles.cancelBtnText}>
                            {tG("cancelBtn")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.rowActions}>
                      {item.price_krw != null && (
                        <Text style={styles.price}>
                          {t("gacha.priceKrw", {
                            price: item.price_krw.toLocaleString(),
                          })}
                        </Text>
                      )}
                      <View
                        style={[
                          styles.statusBadge,
                          item.availability_status === "available"
                            ? { backgroundColor: SUCCESS_BG }
                            : { backgroundColor: GRAY_200 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            item.availability_status === "available"
                              ? { color: SUCCESS_TEXT }
                              : { color: TEXT_GRAY },
                          ]}
                        >
                          {tG(
                            item.availability_status === "available"
                              ? "statusAvailable"
                              : "statusSoldOut",
                          )}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() =>
                          setEditingItem({
                            id: item.id,
                            price_krw: item.price_krw?.toString() ?? "",
                            availability_status:
                              item.availability_status === "sold_out"
                                ? "sold_out"
                                : "available",
                          })
                        }
                      >
                        <Text style={styles.editLink}>{tG("editBtn")}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(item.id)}>
                        <Text style={styles.deleteLink}>{tG("deleteBtn")}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: BORDER }} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: GRAY_200,
  },
  backBtn: {
    paddingHorizontal: 16,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: 24,
    color: TEXT_DARK,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  center: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: TEXT_GRAY,
  },
  addForm: {
    gap: 12,
    padding: 16,
    backgroundColor: GRAY_100,
    borderRadius: 12,
  },
  selectedCard: {
    backgroundColor: WHITE,
    borderRadius: 8,
    padding: 10,
    gap: 2,
  },
  selectedLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_DARK,
  },
  selectedSub: {
    fontSize: 11,
    color: TEXT_GRAY,
  },
  field: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_DARK,
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: TEXT_DARK,
    backgroundColor: WHITE,
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
  },
  statusOption: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusOptionActive: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY,
  },
  statusOptionText: {
    fontSize: 12,
    color: TEXT_GRAY,
  },
  statusOptionTextActive: {
    color: WHITE,
    fontWeight: "600",
  },
  btnRow: {
    flexDirection: "row",
    gap: 8,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: PRIMARY,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: WHITE,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 13,
    color: TEXT_GRAY,
  },
  addBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: WHITE,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: WHITE,
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
  thumbnailPlaceholder: {
    backgroundColor: THUMBNAIL_PLACEHOLDER,
  },
  rowInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_DARK,
    lineHeight: 18,
  },
  manufacturer: {
    fontSize: 11,
    color: TEXT_GRAY,
    marginBottom: 4,
  },
  rowActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  price: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_DARK,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  editLink: {
    fontSize: 12,
    color: PRIMARY,
    textDecorationLine: "underline",
  },
  deleteLink: {
    fontSize: 12,
    color: TEXT_GRAY,
    textDecorationLine: "underline",
  },
});
