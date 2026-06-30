export function setBounded<K, V>(
  map: Map<K, V>,
  key: K,
  value: V,
  maxSize: number,
): void {
  if (!map.has(key) && map.size >= maxSize) {
    const firstKey = map.keys().next().value as K;
    map.delete(firstKey);
  }
  map.set(key, value);
}
