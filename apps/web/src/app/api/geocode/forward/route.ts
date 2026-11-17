import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/kakao/geocodeAddress";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query");
  const results = query === null ? [] : await geocodeAddress(query);
  return NextResponse.json({ results });
}
