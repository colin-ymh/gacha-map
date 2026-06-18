export type LocationPickerResult = {
  lat: number;
  lng: number;
  address: string | null;
};

let _result: LocationPickerResult | null = null;

export const setLocationPickerResult = (r: LocationPickerResult) => {
  _result = r;
};

export const consumeLocationPickerResult = (): LocationPickerResult | null => {
  const r = _result;
  _result = null;
  return r;
};
