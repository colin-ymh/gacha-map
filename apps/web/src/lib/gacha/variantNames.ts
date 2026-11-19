export type VariantNameStatus = "translated" | "translation_pending" | "unnamed";

type VariantNames = {
  name?: string | null;
  name_ja?: string | null;
  name_ko?: string | null;
  sort_order?: number | null;
};

const JAPANESE = /[\u3040-\u30ff\u31f0-\u31ff\u3400-\u9fff\uf900-\ufaff\uff66-\uff9f]/u;
const PLACEHOLDER = /^(?:(?:(?:상품|구성품|품목)(?:\s*이미지)?|variant|item|image)\s*(?:#|no\.?\s*)?\s*\d+|번역\s*준비\s*중(?:인\s*상품)?|수기\s*입력\s*필요|null|undefined)$/iu;

function meaningfulName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && /[\p{L}\p{N}]/u.test(trimmed) && !PLACEHOLDER.test(trimmed) ? trimmed : null;
}

export function getVariantNameStatus(variant: VariantNames): VariantNameStatus {
  const ko = meaningfulName(variant.name_ko);
  if (ko && /[가-힣A-Za-z0-9]/u.test(ko) && !JAPANESE.test(ko)) return "translated";
  if (variant.name_ko && /[\p{L}\p{N}]/u.test(variant.name_ko)) return "translation_pending";
  return meaningfulName(variant.name_ja) || meaningfulName(variant.name)
    ? "translation_pending"
    : "unnamed";
}

export function getVariantDisplayName(
  variant: VariantNames,
  numberedLabel: (number: number) => string = (number) => `구성품 ${number}`,
  unnumberedLabel = "구성품",
): string {
  if (getVariantNameStatus(variant) === "translated") {
    return variant.name_ko!.trim();
  }
  const order = variant.sort_order;
  return typeof order === "number" && Number.isSafeInteger(order) && order > 0
    ? numberedLabel(order)
    : unnumberedLabel;
}

/**
 * Consumer responses retain the Korean display field used by released clients.
 * The original DB translation remains untouched; name_status exposes its state.
 */
export function withVariantDisplayName<T extends VariantNames>(variant: T) {
  return {
    ...variant,
    name_ko: getVariantDisplayName(variant),
    display_name: getVariantDisplayName(variant),
    name_status: getVariantNameStatus(variant),
    translated_name_ko: getVariantNameStatus(variant) === "translated"
      ? variant.name_ko!.trim()
      : null,
  };
}
