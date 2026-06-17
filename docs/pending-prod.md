# Prod 적용 대기 목록

`main` 머지 전 아래 항목을 모두 완료해야 한다.

완료 시 항목을 삭제하거나 ✅ 표시 후 다음 릴리즈에서 정리한다.

---

## 마이그레이션

| 파일                                                | 설명                                                                                        | dev 적용 | prod 적용                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------- |
| `20260614_admin_badge.sql`                          | admin 배지 정의 + 자동 지급 트리거                                                          | ✅       | ✅                                              |
| `20260614_report_new_shop_fields.sql`               | reports 테이블에 proposed_shop_name/address/lat/lng 컬럼 추가                               | ✅       | ✅                                              |
| `20260615_add_badge_notified_at.sql`                | user_badges.notified_at 컬럼 추가 (배지 알림 추적)                                          | ✅       | ✅ (Claude가 임의 적용 — 확인 없이 prod 적용됨) |
| `20260615_badge_notified_at_update_policy.sql`      | user_badges UPDATE 정책 추가 (본인 배지 notified_at 갱신 허용)                              | ✅       | ✅                                              |
| `20260616_push_notifications.sql`                   | 푸시 알림: device_push_tokens, notification_preferences, pending_notifications 테이블 + RLS | ✅       | ✅                                              |
| `20260617_wishlist_product_update_notification.sql` | wishlist_product_update 알림 카테고리 추가 + enqueue_wishlist_news RPC 업데이트             | ✅       | ✅                                              |

### prod 적용 후 수동 작업

- [x] `20260614_admin_badge` 적용 후: 기존 admin 계정에 배지 수동 지급 ✅ (1건 지급 완료)

---

## 기타

_없음_
