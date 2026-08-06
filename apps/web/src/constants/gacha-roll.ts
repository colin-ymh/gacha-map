// 가챠 일일 뽑기 쿼터.
//
// DB 함수(get_daily_roll_quota / consume_daily_roll)는 이 값을 파라미터로 받는다.
// SQL에 하드코딩하지 않는 이유: 값이 두 곳에 살면 반드시 어긋난다.
// 여기가 유일한 소유자다.

// 릴리스 게이팅: 모바일이 409(daily_limit)를 소진 UI로 처리하기 전까지는
// 9999로 두어 실질 제한을 끄고, 앱이 스토어에 나간 뒤 5로 내린다.
// 구버전 앱은 409를 조용히 무시해서 "뽑기 먹통"으로 보인다.
export const DAILY_BASE_ROLLS = 9999;

// 친구 초대로 하루에 더 받을 수 있는 최대 횟수.
export const REFERRAL_BONUS_MAX = 20;
