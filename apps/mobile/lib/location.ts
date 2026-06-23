import * as Location from "expo-location";

export type LocationFailReason = "permission" | "timeout" | "unavailable";

export interface LocationResult {
  ok: boolean;
  coords?: { latitude: number; longitude: number };
  reason?: LocationFailReason;
}

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * getCurrentPositionAsync는 fix를 못 받으면 무한 대기할 수 있다(에뮬레이터·약신호).
 * 권한 확인 → 타임아웃(Promise.race) → 마지막 위치(getLastKnownPositionAsync) 폴백 순으로
 * 항상 유한 시간 내에 결과를 반환한다. 실패 시 reason으로 호출부가 분기/안내한다.
 */
// 폴백 last-known 위치 최대 허용 나이(ms). 너무 오래된 위치가 거리 검증에 쓰이지 않도록 제한.
const LAST_KNOWN_MAX_AGE_MS = 60_000;

export async function getCurrentPositionSafe(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  accuracy: Location.LocationAccuracy = Location.Accuracy.Balanced,
): Promise<LocationResult> {
  // 권한 요청 포함 전 구간을 try로 감싼다 — helper는 절대 reject하지 않고
  // 항상 LocationResult를 반환한다(호출부 unhandled rejection 방지).
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return { ok: false, reason: "permission" };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy }),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    if (timer) clearTimeout(timer);

    if (pos) {
      return {
        ok: true,
        coords: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        },
      };
    }
    // 타임아웃 → 최근(LAST_KNOWN_MAX_AGE_MS 이내) 위치로 폴백
    const last = await Location.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
    });
    if (last) {
      return {
        ok: true,
        coords: {
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
        },
      };
    }
    return { ok: false, reason: "timeout" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
