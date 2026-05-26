import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import {
  createAdminClient,
  createAuthenticatedClient,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "shop-images";
const MAX_FILES = 3;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Props) {
  const { id: shopId } = await params;
  const { searchParams } = new URL(request.url);
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
  const limit = Math.min(
    20,
    Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)),
  );

  const adminClient = createAdminClient();

  const from = page * limit;
  const to = from + limit - 1;

  const {
    data: reviews,
    error,
    count,
  } = await adminClient
    .from("reviews")
    .select(
      "id, shop_id, user_id, content, image_urls, created_at, updated_at, user_profiles(nickname, avatar_url)",
      { count: "exact" },
    )
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const normalized = (reviews ?? []).map((r) => ({
    id: r.id,
    shop_id: r.shop_id,
    user_id: r.user_id,
    content: r.content,
    image_urls: r.image_urls,
    created_at: r.created_at,
    updated_at: r.updated_at,
    user: Array.isArray(r.user_profiles)
      ? (r.user_profiles[0] ?? null)
      : (r.user_profiles ?? null),
  }));

  return NextResponse.json({
    reviews: normalized,
    total: count ?? 0,
    hasMore: from + normalized.length < (count ?? 0),
  });
}

export async function POST(request: NextRequest, { params }: Props) {
  const { id: shopId } = await params;
  const { supabase, user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  const { data: shop } = await adminClient
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .eq("status", "active")
    .maybeSingle();

  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  let rawFormData: Awaited<ReturnType<typeof request.formData>>;
  try {
    rawFormData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const content = (rawFormData.get("content") as string | null)?.trim() || null;
  const files = rawFormData.getAll("files[]") as File[];

  if (!content && files.length === 0) {
    return NextResponse.json(
      { error: "Content or at least one image is required" },
      { status: 400 },
    );
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES} images per review` },
      { status: 400 },
    );
  }

  const reviewId = crypto.randomUUID();
  const imageUrls: string[] = [];

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File exceeds 10MB limit` },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uuid = crypto.randomUUID();
    const ts = Date.now();

    const [displayBuffer, thumbBuffer] = await Promise.all([
      sharp(buffer)
        .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer(),
      sharp(buffer)
        .resize(300, 300, { fit: "cover", position: "centre" })
        .jpeg({ quality: 80 })
        .toBuffer(),
    ]);

    const displayPath = `${shopId}/reviews/${reviewId}/${uuid}.jpg`;
    const thumbPath = `${shopId}/reviews/${reviewId}/${uuid}_thumb.jpg`;

    const [displayUpload, thumbUpload] = await Promise.all([
      adminClient.storage.from(BUCKET).upload(displayPath, displayBuffer, {
        contentType: "image/jpeg",
        upsert: false,
      }),
      adminClient.storage.from(BUCKET).upload(thumbPath, thumbBuffer, {
        contentType: "image/jpeg",
        upsert: false,
      }),
    ]);

    if (displayUpload.error || thumbUpload.error) {
      return NextResponse.json(
        { error: "Image upload failed" },
        { status: 500 },
      );
    }

    const { data: publicData } = adminClient.storage
      .from(BUCKET)
      .getPublicUrl(displayPath);
    imageUrls.push(`${publicData.publicUrl}?t=${ts}`);
  }

  const { data: review, error: insertError } = await supabase
    .from("reviews")
    .insert({
      id: reviewId,
      shop_id: shopId,
      user_id: user.id,
      content: content || null,
      image_urls: imageUrls,
    })
    .select(
      "id, shop_id, user_id, content, image_urls, created_at, updated_at, user_profiles(nickname, avatar_url)",
    )
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const normalized = {
    ...review,
    user: Array.isArray(review.user_profiles)
      ? (review.user_profiles[0] ?? null)
      : (review.user_profiles ?? null),
    user_profiles: undefined,
  };

  return NextResponse.json({ review: normalized }, { status: 201 });
}
