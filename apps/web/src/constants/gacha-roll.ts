// 가챠 일일 뽑기 쿼터.
//
// DB 함수(get_daily_roll_quota / consume_daily_roll)는 이 값을 파라미터로 받는다.
// SQL에 하드코딩하지 않는 이유: 값이 두 곳에 살면 반드시 어긋난다.
// 여기가 유일한 소유자다.

// 하루 기본 뽑기 횟수. KST 0시에 리셋되고 미사용분은 이월되지 않는다.
//
// 릴리스 게이팅: 소진 UI가 담긴 앱이 스토어에 나가기 전에 이 값이 prod로 가면
// 구버전 앱 사용자는 409를 조용히 무시하는 탓에 "뽑기 먹통"을 겪는다.
// main 머지 전에 앱 배포 상태를 반드시 확인할 것.
export const DAILY_BASE_ROLLS = 5;

// 친구 초대로 하루에 더 받을 수 있는 최대 횟수.
// 클릭마다 즉시 푸시를 보내므로(스팸 방지) 20에서 5로 하향.
export const REFERRAL_BONUS_MAX = 5;

// review/shop_report/gacha_report 합산으로 하루에 더 받을 수 있는 최대 횟수.
export const ACTION_BONUS_MAX = 5;
