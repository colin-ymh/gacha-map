import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";

interface Props {
  params: Promise<{ id: string }>;
}

const DOC_BUCKET = "business-docs";
/** 서명 URL 유효시간. 한 번 열어보기에 충분하고, 유출돼도 금방 죽는 길이. */
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * 신청서에 첨부된 증빙 서류(사업자등록증)의 단기 서명 URL을 발급한다.
 *
 * business-docs는 비공개 버킷이고 Storage RLS 정책이 없어서 service_role
 * 외에는 접근할 수 없다. 관리자도 이 라우트를 거쳐야만 열람할 수 있다.
 * DB에는 경로만 저장돼 있으므로 public URL은 애초에 존재하지 않는다.
 */
export async function GET(request: NextRequest, { params }: Props) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: app, error } = await supabase
    .from("shop_owner_applications")
    .select("id, document_paths")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message, code: "server_error" },
      { status: 500 },
    );
  }

  if (!app) {
    return NextResponse.json(
      { error: "Application not found", code: "not_found" },
      { status: 404 },
    );
  }

  const paths = (app.document_paths as string[] | null) ?? [];
  if (paths.length === 0) {
    return NextResponse.json({ documents: [] });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(DOC_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (signError) {
    return NextResponse.json(
      { error: signError.message, code: "sign_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    documents: (signed ?? [])
      .filter((s) => s.signedUrl)
      .map((s) => ({ path: s.path, url: s.signedUrl })),
    expiresInSeconds: SIGNED_URL_TTL_SECONDS,
  });
}
