/**
 * report-location-picker 화면이 호출측에 좌표를 돌려주기 위한 모듈 싱글턴.
 *
 * 여러 화면이 같은 피커를 공유하므로 `source`로 소유자를 표시한다.
 * 소비하지 않고 화면을 떠난 결과가 남아 있다가 다른 화면에 잘못 흘러드는 것을
 * 막기 위해, 호출측은 반드시 자기 source를 지정해서 소비한다.
 */
export type LocationPickerSource = "report" | "shop-application";

export type LocationPickerResult = {
  lat: number;
  lng: number;
  address: string | null;
  source: LocationPickerSource;
};

let _result: LocationPickerResult | null = null;

export const setLocationPickerResult = (r: LocationPickerResult) => {
  _result = r;
};

/**
 * 자기 source의 결과만 가져간다. 다른 화면의 결과는 건드리지 않고 null을 돌려준다.
 * 가져간 결과는 즉시 비운다.
 */
export const consumeLocationPickerResult = (
  source: LocationPickerSource,
): LocationPickerResult | null => {
  if (!_result || _result.source !== source) return null;
  const r = _result;
  _result = null;
  return r;
};

/** 피커로 들어가기 직전에 호출해 이전 화면의 잔여 결과를 버린다. */
export const clearLocationPickerResult = () => {
  _result = null;
};
