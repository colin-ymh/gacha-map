import { SupabaseClient } from "@supabase/supabase-js";
import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

interface PushNotificationData {
  type:
    | "report_result"
    | "shop_owner_activity"
    | "wishlist_news"
    | "badge"
    | "shop_owner_update"
    | "wishlist_product_update"
    | "product_wishlist_restock";
  report_id?: string;
  shop_id?: string;
  product_id?: string;
  badge_id?: string;
  application_id?: string;
}

/**
 * Truncate 텍스트를 지정된 길이로 제한
 */
function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.substring(0, maxLen) : text;
}

/**
 * 알림을 DB의 pending_notifications 테이블에 enqueue
 * 토큰이 없으면 row를 쌓지 않음 (RPC에서 체크)
 */
export async function enqueueNotification(
  supabase: SupabaseClient,
  userId: string,
  category:
    | "report_result"
    | "shop_owner_activity"
    | "wishlist_news"
    | "badge"
    | "shop_owner_update",
  title: string,
  body: string,
  data: PushNotificationData,
): Promise<string | null> {
  const truncatedTitle = truncate(title, 60);
  const truncatedBody = truncate(body, 150);

  const { data: result, error } = await supabase.rpc("enqueue_notification", {
    p_user_id: userId,
    p_category: category,
    p_title: truncatedTitle,
    p_body: truncatedBody,
    p_data: data,
  });

  if (error) {
    console.error(`[Notification] enqueue failed for user ${userId}:`, error);
    return null;
  }

  return result as string | null;
}

/**
 * wishlist fan-out enqueue (wishlist_news 및 wishlist_product_update 공용)
 */
export async function enqueueWishlistFanout(
  supabase: SupabaseClient,
  shopId: string,
  category: "wishlist_news" | "wishlist_product_update",
  title: string,
  body: string,
  data: PushNotificationData,
): Promise<number> {
  const truncatedTitle = truncate(title, 60);
  const truncatedBody = truncate(body, 150);

  const { data: count, error } = await supabase.rpc("enqueue_wishlist_news", {
    p_shop_id: shopId,
    p_category: category,
    p_title: truncatedTitle,
    p_body: truncatedBody,
    p_data: data,
  });

  if (error) {
    console.error(
      `[Notification] ${category} enqueue failed for shop ${shopId}:`,
      error,
    );
    return 0;
  }

  return (count as number) ?? 0;
}

/**
 * wishlist_news 카테고리용 팬아웃 enqueue (shop_id 기준으로 여러 유저에게 전송)
 */
export async function enqueueWishlistNews(
  supabase: SupabaseClient,
  shopId: string,
  title: string,
  body: string,
  data: PushNotificationData,
): Promise<number> {
  return enqueueWishlistFanout(
    supabase,
    shopId,
    "wishlist_news",
    title,
    body,
    data,
  );
}

/**
 * 상품 찜 팬아웃 enqueue (product_id 기준으로 찜한 유저들에게 전송)
 */
export async function enqueueProductWishlistFanout(
  supabase: SupabaseClient,
  productId: string,
  title: string,
  body: string,
  data: PushNotificationData,
): Promise<number> {
  const truncatedTitle = truncate(title, 60);
  const truncatedBody = truncate(body, 150);

  const { data: count, error } = await supabase.rpc(
    "enqueue_product_wishlist_fanout",
    {
      p_product_id: productId,
      p_title: truncatedTitle,
      p_body: truncatedBody,
      p_data: data,
    },
  );

  if (error) {
    console.error(
      `[Notification] product_wishlist_restock enqueue failed for product ${productId}:`,
      error,
    );
    return 0;
  }

  return (count as number) ?? 0;
}

/**
 * Expo Push API로 실제 푸시 발송
 * @param tokens 발송할 토큰 배열
 * @param title 알림 제목
 * @param body 알림 본문
 * @param data 알림 페이로드
 */
export async function sendPushBatch(
  tokens: string[],
  title: string,
  body: string,
  data: PushNotificationData,
): Promise<{
  tickets: Array<{ token: string; ticketId: string }>;
  errors: Array<{ token: string; error: string }>;
}> {
  const tickets: Array<{ token: string; ticketId: string }> = [];
  const errors: Array<{ token: string; error: string }> = [];

  const validTokens = tokens.filter((token) => Expo.isExpoPushToken(token));
  const invalidTokens = tokens.filter((token) => !Expo.isExpoPushToken(token));
  invalidTokens.forEach((token) => {
    errors.push({ token, error: "InvalidExpoPushToken" });
  });

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data: data as unknown as Record<string, unknown>,
  }));

  // Expo는 최대 100개씩 묶어서 발송
  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    const chunkTokens = chunk.map((m) => m.to as string);
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);

      ticketChunk.forEach((ticket: ExpoPushTicket, idx: number) => {
        const token = chunkTokens[idx];
        if (ticket.status === "error") {
          errors.push({
            token,
            error: ticket.details?.error || ticket.message || "Unknown error",
          });
        } else if (ticket.status === "ok") {
          tickets.push({
            token,
            ticketId: ticket.id,
          });
        }
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Notification] Expo API error: ${errMsg}`);
      chunkTokens.forEach((token) => {
        errors.push({ token, error: errMsg });
      });
    }
  }

  return { tickets, errors };
}

/**
 * Expo Push 영수증 조회
 * @param ticketIds 조회할 ticket ID 배열
 */
export async function getPushReceipts(ticketIds: string[]): Promise<{
  receipts: Record<
    string,
    {
      status: "ok" | "error";
      message?: string;
      details?: { error?: string };
    }
  >;
}> {
  const receipts: Record<
    string,
    {
      status: "ok" | "error";
      message?: string;
      details?: { error?: string };
    }
  > = {};

  try {
    const receiptIdChunks = expo.chunkPushNotificationReceiptIds(ticketIds);
    for (const ticketIdChunk of receiptIdChunks) {
      const result = await expo.getPushNotificationReceiptsAsync(ticketIdChunk);
      Object.assign(receipts, result);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // receipt 조회 자체 실패(네트워크/Expo 장애)는 디바이스 전달 실패가 아니다.
    // 여기서 error로 조작하면 호출부가 transient error로 보고 재발송 → 중복 발송 위험.
    // receipt를 채우지 않고 두면 호출부가 pending_receipt를 유지 → 다음 실행에서 재조회.
    console.error(`[Notification] Receipt fetch error: ${errMsg}`);
  }

  return { receipts };
}
