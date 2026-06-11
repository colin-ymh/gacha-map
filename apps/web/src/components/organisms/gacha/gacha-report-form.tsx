"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import type { GachaProduct, ShopGachaProduct } from "@gacha-map/shared";
import { createClient } from "@/lib/supabase/client";
import { MODAL_OVERLAY, TEXT_GRAY } from "@/styles/color";

// ── Styled ────────────────────────────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${MODAL_OVERLAY};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 16px;
`;

const Modal = styled.div`
  background: ${({ theme }) => theme.colors.white};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 24px;
  width: 100%;
  max-width: 480px;
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const ModalTitle = styled.h2`
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
  margin: 0;
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

const ResultItem = styled.li<{ $selected: boolean }>`
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  background: ${({ $selected, theme }) =>
    $selected ? theme.colors.primaryBg : "transparent"};

  &:hover {
    background: ${({ theme }) => theme.colors.gray50};
  }
`;

const ResultThumb = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.gray100};
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
`;

const ResultInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const ResultName = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ResultSub = styled.span`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
`;

const SelectedCard = styled.div`
  padding: 10px 12px;
  background: ${({ theme }) => theme.colors.gray50};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  font-weight: 600;
`;

const Label = styled.label`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textDark};
  display: block;
  margin-bottom: 4px;
`;

const PriceInput = styled.input`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: 8px 12px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
`;

const SubmitButton = styled.button`
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

const CancelButton = styled.button`
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

// ── Component ─────────────────────────────────────────────────────────────────

interface GachaReportFormProps {
  shopId: string;
  onSuccess: (product: ShopGachaProduct) => void;
  onCancel: () => void;
}

const DEBOUNCE_MS = 300;

const GachaReportForm = ({
  shopId,
  onSuccess,
  onCancel,
}: GachaReportFormProps) => {
  const t = useTranslations("gacha");

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GachaProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<GachaProduct | null>(
    null,
  );
  const [priceKrw, setPriceKrw] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/gacha-products?q=${encodeURIComponent(query.trim())}&limit=20`,
          { signal: controller.signal },
        );
        const data = await res.json();
        setSearchResults(data.products ?? []);
      } catch {
        // AbortError or network error — ignore
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const handleSubmit = useCallback(async () => {
    if (!selectedProduct) return;
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const body: Record<string, unknown> = {
        gacha_product_id: selectedProduct.id,
      };
      const parsed = parseInt(priceKrw, 10);
      if (!isNaN(parsed) && parsed >= 0) body.price_krw = parsed;

      const res = await fetch(`/api/shops/${shopId}/gacha-products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      onSuccess(data.product);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedProduct, priceKrw, shopId, onSuccess]);

  return (
    <Overlay onClick={onCancel}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalTitle>{t("report.title")}</ModalTitle>

        {selectedProduct ? (
          <SelectedCard>
            {selectedProduct.name_ko ??
              selectedProduct.name_ja ??
              selectedProduct.name}{" "}
            — {selectedProduct.manufacturer}
            <button
              style={{
                marginLeft: 8,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                color: TEXT_GRAY,
              }}
              onClick={() => {
                setSelectedProduct(null);
                setQuery("");
              }}
            >
              ✕
            </button>
          </SelectedCard>
        ) : (
          <SearchWrapper>
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => setTimeout(() => setSearchResults([]), 150)}
              placeholder={t("report.searchPlaceholder")}
              autoFocus
            />
            {isSearching && (
              <p
                style={{
                  fontSize: 12,
                  color: TEXT_GRAY,
                  margin: "4px 0 0 4px",
                }}
              >
                {t("loading")}
              </p>
            )}
            {searchResults.length > 0 && (
              <ResultList>
                {searchResults.map((p) => (
                  <ResultItem
                    key={p.id}
                    $selected={false}
                    onClick={() => {
                      setSelectedProduct(p);
                      setQuery("");
                      setSearchResults([]);
                    }}
                  >
                    <ResultThumb>
                      {p.official_image_url && (
                        <Image
                          src={p.official_image_url}
                          alt=""
                          fill
                          style={{ objectFit: "cover" }}
                          sizes="40px"
                        />
                      )}
                    </ResultThumb>
                    <ResultInfo>
                      <ResultName>
                        {p.name_ko ?? p.name_ja ?? p.name}
                      </ResultName>
                      <ResultSub>{p.manufacturer}</ResultSub>
                    </ResultInfo>
                  </ResultItem>
                ))}
              </ResultList>
            )}
          </SearchWrapper>
        )}

        <div>
          <Label>{t("report.priceLabel")}</Label>
          <PriceInput
            type="number"
            min={0}
            value={priceKrw}
            onChange={(e) => setPriceKrw(e.target.value)}
            placeholder={t("report.pricePlaceholder")}
          />
        </div>

        <Actions>
          <SubmitButton
            onClick={handleSubmit}
            disabled={!selectedProduct || isSubmitting}
          >
            {isSubmitting ? t("loading") : t("report.submitBtn")}
          </SubmitButton>
          <CancelButton onClick={onCancel}>
            {t("report.cancelBtn")}
          </CancelButton>
        </Actions>
      </Modal>
    </Overlay>
  );
};

export default GachaReportForm;
