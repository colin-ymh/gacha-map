import type { Bounds, TileRange } from "../types";

export function latLngToTile(
  lat: number,
  lng: number,
  zoom: number,
): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x, y };
}

function tileToLatLng(
  x: number,
  y: number,
  zoom: number,
): { lat: number; lng: number } {
  const n = Math.pow(2, zoom);
  const lng = (x / n) * 360 - 180;
  const lat =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return { lat, lng };
}

export function tileRangeToBounds(range: TileRange): Bounds {
  const nw = tileToLatLng(range.minX, range.minY, range.zoom);
  const se = tileToLatLng(range.maxX + 1, range.maxY + 1, range.zoom);
  return {
    swLat: se.lat,
    swLng: nw.lng,
    neLat: nw.lat,
    neLng: se.lng,
  };
}

export function viewportToTileRange(
  lat: number,
  lng: number,
  latDelta: number,
  lngDelta: number,
  zoom: number,
  pad = 1,
): TileRange {
  const z = Math.round(zoom);
  const sw = latLngToTile(lat - latDelta / 2, lng - lngDelta / 2, z);
  const ne = latLngToTile(lat + latDelta / 2, lng + lngDelta / 2, z);
  return {
    minX: Math.min(sw.x, ne.x) - pad,
    minY: Math.min(sw.y, ne.y) - pad,
    maxX: Math.max(sw.x, ne.x) + pad,
    maxY: Math.max(sw.y, ne.y) + pad,
    zoom: z,
  };
}

export function tileRangeKey(range: TileRange): string {
  return `${range.zoom}/${range.minX}/${range.minY}/${range.maxX}/${range.maxY}`;
}
