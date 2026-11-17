// Daum 우편번호 서비스(address-picker.tsx)가 돌려주는 결과를 화면 간에 전달하는
// 싱글턴. locationPickerResult.ts와 같은 이유로 source를 태그한다 — 여러 화면이
// 같은 피커를 공유할 수 있으므로 자기 것이 아닌 결과가 새어들면 안 된다.
export type AddressPickerSource = "shop-application";

export interface AddressPickerResult {
  source: AddressPickerSource;
  address: string;
}

let pending: AddressPickerResult | null = null;

export function setAddressPickerResult(result: AddressPickerResult) {
  pending = result;
}

export function consumeAddressPickerResult(
  source: AddressPickerSource,
): AddressPickerResult | null {
  if (!pending || pending.source !== source) return null;
  const result = pending;
  pending = null;
  return result;
}

export function clearAddressPickerResult() {
  pending = null;
}
