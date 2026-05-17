import { NextResponse } from "next/server";
import {
  createAdminClient,
  createAuthenticatedClient,
} from "@/lib/supabase/server";

export async function DELETE(request: Request) {
  const { user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
