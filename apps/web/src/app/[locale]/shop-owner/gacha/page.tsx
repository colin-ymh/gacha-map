"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import type { ShopGachaProductInternal, GachaProduct } from "@gacha-map/shared";

// ── Styled ────────────────────────────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.fontSize.xl};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
  padding-bottom: 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const AddSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: ${({ theme }) => theme.colors.gray50};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const AddTitle = styled.h2`
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
  margin: 0;
`;

const FieldLabel = styled.label`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textDark};
  display: block;
  margin-bottom: 4px;
`;

const SearchInput = styled.input`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: 8px 12px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  outline: none;
  box-sizing: border-box;
  background: ${({ theme }) => theme.colors.white};

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const SearchWrapper = styled.div`
  position: relative;
`;

const ResultList = styled.ul`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 10;
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  max-height: 200px;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.white};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;

const ResultItem = styled.li`
  padding: 8px 12px;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.gray50};
  }
`;

const ResultName = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  display: block;
`;

const ResultSub = styled.span`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
`;

const SelectedCard = styled.div`
  padding: 10px 12px;
  background: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textDark};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const TextInput = styled.input`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: 8px 12px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  outline: none;
  box-sizing: border-box;
  background: ${({ theme }) => theme.colors.white};

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const StatusRow = styled.div`
  display: flex;
  gap: 8px;
`;

const StatusOption = styled.button<{ $active: boolean }>`
  padding: 6px 16px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid
    ${({ $active, theme }) =>
      $active ? theme.colors.primary : theme.colors.border};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.white};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.white : theme.colors.textGray};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ $active }) => ($active ? "600" : "400")};
  cursor: pointer;
`;

const BtnRow = styled.div`
  display: flex;
  gap: 8px;
`;

const PrimaryBtn = styled.button`
  flex: 1;
  padding: 10px;
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.white};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primaryHover};
  }
`;

const SecondaryBtn = styled.button`
  flex: 1;
  padding: 10px;
  background: ${({ theme }) => theme.colors.white};
  color: ${({ theme }) => theme.colors.textGray};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSize.sm};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.gray50};
  }
`;

const AddBtn = styled.button`
  padding: 10px 24px;
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.white};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  cursor: pointer;
  align-self: flex-start;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryHover};
  }
`;

const ProductTable = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  overflow: hidden;
`;

const ProductRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.white};

  &:last-child {
    border-bottom: none;
  }
`;

const Thumbnail = styled.div<{ $src?: string | null }>`
  width: 48px;
  height: 48px;
  border-radius: 8px;
  flex-shrink: 0;
  background: ${({ $src, theme }) =>
    $src ? `url(${$src}) center/cover no-repeat` : theme.colors.gray100};
`;

const ProductInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const ProductName = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textDark};
  margin: 0 0 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ProductMeta = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
  margin: 0;
`;

interface StatusBadgeProps {
  $status: "available" | "sold_out";
}

const StatusBadge = styled.span<StatusBadgeProps>`
  padding: 2px 10px;
  border-radius: 999px;
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  background: ${({ $status, theme }) =>
    $status === "available" ? theme.colors.successBg : theme.colors.gray100};
  color: ${({ $status, theme }) =>
    $status === "available" ? theme.colors.successText : theme.colors.textGray};
`;

const ActionLink = styled.button`
  background: none;
  border: none;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
  text-decoration: underline;
  cursor: pointer;
  padding: 0;

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const DangerLink = styled(ActionLink)`
  &:hover {
    color: ${({ theme }) => theme.colors.dangerText};
  }
`;

const PriceText = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textDark};
`;

const ClearBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textGray};
  padding: 0;
  line-height: 1;
`;

const EmptyText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textGray};
  text-align: center;
  padding: 40px 16px;
`;

const LoadingText = styled.p`
  color: ${({ theme }) => theme.colors.textGray};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

// ── Component ─────────────────────────────────────────────────────────────────

type EditingItem = {
  id: string;
  price_krw: string;
  availability_status: "available" | "sold_out";
};

const DEBOUNCE_MS = 300;

export default function ShopOwnerGachaPage() {
  const t = useTranslations("gacha");
  const router = useRouter();

  const [products, setProducts] = useState<ShopGachaProductInternal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GachaProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<GachaProduct | null>(
    null,
  );
  const [newPrice, setNewPrice] = useState("");
  const [newStatus, setNewStatus] = useState<"available" | "sold_out">(
    "available",
  );

  const tG = useCallback(
    (key: string) => t(`ownerGacha.${key}` as Parameters<typeof t>[0]),
    [t],
  );

  const getAuthHeader = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/");
      throw new Error("Unauthenticated");
    }
    return { Authorization: `Bearer ${session.access_token}` };
  }, [router]);

  useEffect(() => {
    const load = async () => {
      try {
        const authHeader = await getAuthHeader();
        const res = await fetch("/api/shop-owner/gacha-products", {
          headers: authHeader,
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setProducts(data.products ?? []);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [getAuthHeader]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/gacha-products?q=${encodeURIComponent(searchQuery.trim())}&limit=20`,
        );
        const data = await res.json();
        setSearchResults(data.products ?? []);
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddSubmit = useCallback(async () => {
    if (!selectedProduct) return;
    setIsSaving(true);
    try {
      const authHeader = await getAuthHeader();
      const body: Record<string, unknown> = {
        gacha_product_id: selectedProduct.id,
        availability_status: newStatus,
      };
      const parsed = parseInt(newPrice, 10);
      if (!isNaN(parsed) && parsed >= 0) body.price_krw = parsed;

      const res = await fetch("/api/shop-owner/gacha-products", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
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
      setSelectedProduct(null);
      setNewPrice("");
      setNewStatus("available");
    } catch {
      alert(tG("saveError"));
    } finally {
      setIsSaving(false);
    }
  }, [selectedProduct, newPrice, newStatus, getAuthHeader, tG]);

  const handleEditSubmit = useCallback(async () => {
    if (!editingItem) return;
    setIsSaving(true);
    try {
      const authHeader = await getAuthHeader();
      const body: Record<string, unknown> = {
        availability_status: editingItem.availability_status,
      };
      const parsed = parseInt(editingItem.price_krw, 10);
      if (!isNaN(parsed) && parsed >= 0) body.price_krw = parsed;

      const res = await fetch(
        `/api/shop-owner/gacha-products/${editingItem.id}`,
        {
          method: "PUT",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProducts((prev) =>
        prev.map((p) => (p.id === data.product.id ? data.product : p)),
      );
      setEditingItem(null);
    } catch {
      alert(tG("saveError"));
    } finally {
      setIsSaving(false);
    }
  }, [editingItem, getAuthHeader, tG]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm(tG("deleteConfirm"))) return;
      try {
        const authHeader = await getAuthHeader();
        const res = await fetch(`/api/shop-owner/gacha-products/${id}`, {
          method: "DELETE",
          headers: authHeader,
        });
        if (res.ok || res.status === 204) {
          setProducts((prev) => prev.filter((p) => p.id !== id));
        }
      } catch {
        alert(tG("deleteError"));
      }
    },
    [getAuthHeader, tG],
  );

  if (isLoading) return <LoadingText>{tG("loading")}</LoadingText>;

  return (
    <Container>
      <Title>{tG("title")}</Title>

      {isAdding ? (
        <AddSection>
          <AddTitle>{tG("addBtn")}</AddTitle>

          {selectedProduct ? (
            <SelectedCard>
              <span>
                {selectedProduct.name_ko ??
                  selectedProduct.name_ja ??
                  selectedProduct.name}{" "}
                — {selectedProduct.manufacturer}
              </span>
              <ClearBtn
                onClick={() => {
                  setSelectedProduct(null);
                  setSearchQuery("");
                }}
              >
                ✕
              </ClearBtn>
            </SelectedCard>
          ) : (
            <SearchWrapper>
              <FieldLabel>{t("report.searchPlaceholder")}</FieldLabel>
              <SearchInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => setTimeout(() => setSearchResults([]), 150)}
                placeholder={t("report.searchPlaceholder")}
                autoFocus
              />
              {isSearching && (
                <p style={{ fontSize: 12, color: "#888", margin: "4px 0 0" }}>
                  {tG("loading")}
                </p>
              )}
              {searchResults.length > 0 && (
                <ResultList>
                  {searchResults.map((p) => (
                    <ResultItem
                      key={p.id}
                      onClick={() => {
                        setSelectedProduct(p);
                        setSearchQuery("");
                        setSearchResults([]);
                      }}
                    >
                      <ResultName>
                        {p.name_ko ?? p.name_ja ?? p.name}
                      </ResultName>
                      <ResultSub>{p.manufacturer}</ResultSub>
                    </ResultItem>
                  ))}
                </ResultList>
              )}
            </SearchWrapper>
          )}

          <div>
            <FieldLabel>{tG("priceLabel")}</FieldLabel>
            <TextInput
              type="number"
              min={0}
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder={tG("pricePlaceholder")}
            />
          </div>

          <div>
            <FieldLabel>{tG("statusLabel")}</FieldLabel>
            <StatusRow>
              {(["available", "sold_out"] as const).map((s) => (
                <StatusOption
                  key={s}
                  $active={newStatus === s}
                  onClick={() => setNewStatus(s)}
                >
                  {tG(s === "available" ? "statusAvailable" : "statusSoldOut")}
                </StatusOption>
              ))}
            </StatusRow>
          </div>

          <BtnRow>
            <PrimaryBtn
              onClick={handleAddSubmit}
              disabled={!selectedProduct || isSaving}
            >
              {isSaving ? tG("saving") : tG("saveBtn")}
            </PrimaryBtn>
            <SecondaryBtn
              onClick={() => {
                setIsAdding(false);
                setSelectedProduct(null);
                setNewPrice("");
                setSearchQuery("");
              }}
            >
              {tG("cancelBtn")}
            </SecondaryBtn>
          </BtnRow>
        </AddSection>
      ) : (
        <AddBtn onClick={() => setIsAdding(true)}>{tG("addBtn")}</AddBtn>
      )}

      {products.length === 0 ? (
        <EmptyText>{tG("empty")}</EmptyText>
      ) : (
        <ProductTable>
          {products.map((item) => {
            const isEditing = editingItem?.id === item.id;
            const displayStatus =
              item.availability_status === "sold_out"
                ? "sold_out"
                : "available";

            return (
              <ProductRow key={item.id}>
                <Thumbnail $src={item.gacha_product.official_image_url} />
                <ProductInfo>
                  <ProductName>
                    {item.gacha_product.name_ko ??
                      item.gacha_product.name_ja ??
                      item.gacha_product.name}
                  </ProductName>
                  <ProductMeta>{item.gacha_product.manufacturer}</ProductMeta>
                </ProductInfo>

                {isEditing ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      minWidth: 240,
                    }}
                  >
                    <TextInput
                      type="number"
                      min={0}
                      value={editingItem.price_krw}
                      onChange={(e) =>
                        setEditingItem((prev) =>
                          prev ? { ...prev, price_krw: e.target.value } : prev,
                        )
                      }
                      placeholder={tG("pricePlaceholder")}
                    />
                    <StatusRow>
                      {(["available", "sold_out"] as const).map((s) => (
                        <StatusOption
                          key={s}
                          $active={editingItem.availability_status === s}
                          onClick={() =>
                            setEditingItem((prev) =>
                              prev ? { ...prev, availability_status: s } : prev,
                            )
                          }
                        >
                          {tG(
                            s === "available"
                              ? "statusAvailable"
                              : "statusSoldOut",
                          )}
                        </StatusOption>
                      ))}
                    </StatusRow>
                    <BtnRow>
                      <PrimaryBtn
                        onClick={handleEditSubmit}
                        disabled={isSaving}
                        style={{ flex: "initial", padding: "6px 16px" }}
                      >
                        {isSaving ? tG("saving") : tG("saveBtn")}
                      </PrimaryBtn>
                      <SecondaryBtn
                        onClick={() => setEditingItem(null)}
                        style={{ flex: "initial", padding: "6px 16px" }}
                      >
                        {tG("cancelBtn")}
                      </SecondaryBtn>
                    </BtnRow>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flexShrink: 0,
                    }}
                  >
                    {item.price_krw != null && (
                      <PriceText>₩{item.price_krw.toLocaleString()}</PriceText>
                    )}
                    <StatusBadge $status={displayStatus}>
                      {tG(
                        displayStatus === "available"
                          ? "statusAvailable"
                          : "statusSoldOut",
                      )}
                    </StatusBadge>
                    <ActionLink
                      onClick={() =>
                        setEditingItem({
                          id: item.id,
                          price_krw: item.price_krw?.toString() ?? "",
                          availability_status: displayStatus,
                        })
                      }
                    >
                      {tG("editBtn")}
                    </ActionLink>
                    <DangerLink onClick={() => handleDelete(item.id)}>
                      {tG("deleteBtn")}
                    </DangerLink>
                  </div>
                )}
              </ProductRow>
            );
          })}
        </ProductTable>
      )}
    </Container>
  );
}
