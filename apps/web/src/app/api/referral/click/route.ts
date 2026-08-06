import { NextRequest, NextResponse } from "next/server";
import {
  createAuthenticatedClient,
  createAdminClient,
} from "@/lib/supabase/server";

// 공유 링크를 연 방문자에게 심는 익명 식별자. 로그인과 무관하며,
// "한 친구당 하루 1회"의 그 한 명을 가리키는 유일한 근거다.
const VISITOR_COOKIE = "gm_vid";
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const REFERRAL_CODE_RE = /^[A-Z2-9]{10}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 링크 미리보기 크롤러는 보통 JS를 실행하지 않아 이 엔드포인트까지 오지 않는다.
// 그래도 JS를 도는 봇이 있어 방어를 한 겹 더 둔다.
//
// 주의: 'kakaotalk'만으로 거르면 안 된다. 카카오톡 인앱 브라우저의 UA에도
// KAKAOTALK이 들어가는데 그건 진짜 사용자다. 스크래퍼는 kakaotalk-scrap이다.
const BOT_UA_RE =
  /(facebookexternalhit|twitterbot|slackbot|discordbot|telegrambot|whatsapp|kakaotalk-scrap|googlebot|bingbot|yeti|daumoa|applebot|redditbot|embedly|pinterest|crawler|spider)/i;

// IP 단위 남용 방지. 한 IP가 10분에 60번이면 정상 사용으로 보기 어렵다.
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

// 초대자 존재 여부를 외부에 알리지 않기 위해 모든 경로에서 204를 돌려준다.
function noContent(visitorId?: string) {
  const response = new NextResponse(null, { status: 204 });
  if (visitorId) {
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: VISITOR_COOKIE_MAX_AGE,
      path: "/",
    });
  }
  return response;
}

export async function POST(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (BOT_UA_RE.test(userAgent)) {
    return noContent();
  }

  let code: unknown;
  let variantId: unknown;
  try {
    const body = await request.json();
    code = body?.code;
    variantId = body?.variantId;
  } catch {
    return noContent();
  }

  if (typeof code !== "string" || !REFERRAL_CODE_RE.test(code)) {
    return noContent();
  }

  // 방문자 식별자는 처음 온 사람에게만 새로 발급한다.
  const existingVisitorId = request.cookies.get(VISITOR_COOKIE)?.value;
  const visitorId =
    existingVisitorId && UUID_RE.test(existingVisitorId)
      ? existingVisitorId
      : crypto.randomUUID();
  const issuedVisitorId =
    visitorId === existingVisitorId ? undefined : visitorId;

  const adminClient = createAdminClient();

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) {
    const { data: allowed } = await adminClient.rpc("check_rate_limit", {
      p_key: `referral_click:${ip}`,
      p_max: RATE_LIMIT_MAX,
      p_window_ms: RATE_LIMIT_WINDOW_MS,
    });
    if (allowed === false) {
      return noContent(issuedVisitorId);
    }
  }

  const { data: inviter } = await adminClient
    .from("user_profiles")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();

  if (!inviter) {
    return noContent(issuedVisitorId);
  }

  // 자기 링크를 자기가 여는 경우는 보상하지 않는다.
  // 웹에 로그인한 상태에서만 잡아낼 수 있다 — 비로그인 자기 클릭은 막지 못한다.
  const { user } = await createAuthenticatedClient(request);
  if (user?.id === inviter.id) {
    return noContent(issuedVisitorId);
  }

  // 같은 (초대자, 방문자, 날짜) 조합은 유니크 인덱스가 막는다.
  // 23505는 "오늘 이미 인정됨"이라는 정상 흐름이라 조용히 넘긴다.
  await adminClient.from("gacha_referral_clicks").insert({
    inviter_id: inviter.id,
    visitor_id: visitorId,
    variant_id:
      typeof variantId === "string" && UUID_RE.test(variantId)
        ? variantId
        : null,
  });

  return noContent(issuedVisitorId);
}
