import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";
import type {
  ShopOwnerApplicationStatus,
  ShopOwnerApplicationType,
  AdminShopOwnerApplicationItem,
} from "@/types";

const DEFAULT_LIMIT = 50;

export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const rawLimit = parseInt(
    searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10,
  );

  const VALID_STATUSES: ShopOwnerApplicationStatus[] = [
    "pending",
    "approved",
    "rejected",
  ];
  const VALID_TYPES: ShopOwnerApplicationType[] = ["new_shop", "claim_shop"];

  if (
    status &&
    !VALID_STATUSES.includes(status as ShopOwnerApplicationStatus)
  ) {
    return NextResponse.json(
      { error: "Invalid status parameter" },
      { status: 400 },
    );
  }

  if (type && !VALID_TYPES.includes(type as ShopOwnerApplicationType)) {
    return NextResponse.json(
      { error: "Invalid type parameter" },
      { status: 400 },
    );
  }

  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  const limit = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, 100);

  const supabase = createAdminClient();

  let query = supabase
    .from("shop_owner_applications")
    .select("*, shops(name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (type) query = query.eq("type", type);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const applications: AdminShopOwnerApplicationItem[] = (data ?? []).map(
    (row) => {
      const { shops, ...rest } = row as typeof row & {
        shops: { name: string } | null;
      };
      return {
        ...rest,
        shop_name_existing: shops?.name ?? null,
      } as AdminShopOwnerApplicationItem;
    },
  );

  return NextResponse.json({ applications, total: count ?? 0, offset, limit });
}
