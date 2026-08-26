import { NextRequest, NextResponse } from "next/server";
import {
  createAdminClient,
  createAuthenticatedClient,
} from "@/lib/supabase/server";

interface Props {
  params: Promise<{ id: string }>;
}

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: message, code }, { status });
}

/**
 * 본인의 pending 신청을 취소한다.
 *
 * 하드 삭제하지 않고 status='cancelled'로만 바꾼다. 심사 이력을 남겨야
 * 같은 사업자번호로 반복 신청하는 패턴을 관리자가 볼 수 있기 때문이다.
 *
 * 클라이언트가 Supabase에 직접 UPDATE하도록 RLS 정책을 여는 방법도 있었지만,
 * WITH CHECK가 새 행의 user_id/status만 검사해서 취소하는 김에 사업자번호나
 * 좌표까지 바꿔치기할 수 있었다. 그래서 정책을 두지 않고 이 라우트에서만
 * service_role로 처리한다. status 외에는 아무것도 건드리지 않는다.
 */
export async function DELETE(request: NextRequest, { params }: Props) {
  const { user } = await createAuthenticatedClient(request);

  if (!user) {
    return fail("unauthorized", "Unauthorized", 401);
  }

  const { id } = await params;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("shop_owner_applications")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("id, status")
    .single();

  if (error) {
    // PGRST116 = 조건에 맞는 행이 없음.
    // 남의 신청이거나, 이미 처리/취소된 신청이거나, 존재하지 않는 id다.
    // 어느 쪽인지 구분해서 알려주면 타인의 신청 존재 여부가 새어나가므로 합친다.
    if (error.code === "PGRST116") {
      return fail(
        "not_cancellable",
        "Application not found or no longer pending",
        404,
      );
    }
    return fail("server_error", error.message, 500);
  }

  return NextResponse.json({ id: data.id, status: data.status });
}
