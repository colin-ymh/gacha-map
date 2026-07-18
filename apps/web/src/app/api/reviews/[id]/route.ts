import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import {
  createAdminClient,
  createAuthenticatedClient,
} from "@/lib/supabase/server";
import { containsProfanity } from "@gacha-map/shared";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "shop-images";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

interface Props {
  params: Promise<{ id: string }>;
}

function extractStoragePath(url: string): string | null {
  try {
    const u = new URL(url.split("?")[0]);
    const prefix = `/storage/v1/object/public/${BUCKET}/`;
    const idx = u.pathname.indexOf(prefix);
    if (idx === -1) return null;
    return u.pathname.slice(idx + prefix.length);
  } catch {
    return null;
  }
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const { id: reviewId } = await params;
  const { user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  const { data: review } = await adminClient
    .from("reviews")
    .select("id, shop_id, user_id, image_urls")
    .eq("id", reviewId)
    .maybeSingle();

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  if (review.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let rawFormData: Awaited<ReturnType<typeof request.formData>>;
  try {
    rawFormData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const content = (rawFormData.get("content") as string | null)?.trim() || null;
  const newFiles = rawFormData.getAll("files[]") as File[];
  const keepUrls = rawFormData.getAll("keepUrls[]") as string[];

  if (content && containsProfanity(content)) {
    return NextResponse.json({ error: "profanity" }, { status: 400 });
  }

  if (!content && newFiles.length === 0 && keepUrls.length === 0) {
    return NextResponse.json(
      { error: "Content or at least one image is required" },
      { status: 400 },
    );
  }

  // 제거된 기존 이미지 Storage 삭제
  const removedUrls = (review.image_urls as string[]).filter(
    (url) => !keepUrls.includes(url),
  );
  if (removedUrls.length > 0) {
    const paths = removedUrls
      .map(extractStoragePath)
      .filter(Boolean) as string[];
    const thumbPaths = paths.map((p) => p.replace(/\.jpg$/, "_thumb.jpg"));
    await adminClient.storage.from(BUCKET).remove([...paths, ...thumbPaths]);
  }

  // 새 이미지 업로드
  const newImageUrls: string[] = [];
  for (const file of newFiles) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds 10MB limit" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uuid = crypto.randomUUID();
    const ts = Date.now();

    const [displayBuffer, thumbBuffer] = await Promise.all([
      sharp(buffer)
        .rotate()
        .resize(1800, 1800, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer(),
      sharp(buffer)
        .rotate()
        .resize(300, 300, { fit: "cover", position: "centre" })
        .jpeg({ quality: 80 })
        .toBuffer(),
    ]);

    const displayPath = `${review.shop_id}/reviews/${reviewId}/${uuid}.jpg`;
    const thumbPath = `${review.shop_id}/reviews/${reviewId}/${uuid}_thumb.jpg`;

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
    newImageUrls.push(`${publicData.publicUrl}?t=${ts}`);
  }

  const finalImageUrls = [...keepUrls, ...newImageUrls];

  const { data: updated, error: updateError } = await adminClient
    .from("reviews")
    .update({
      content: content ?? null,
      image_urls: finalImageUrls,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reviewId)
    .select(
      "id, shop_id, user_id, content, image_urls, created_at, updated_at, user_profiles(nickname, avatar_url)",
    )
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const normalized = {
    ...updated,
    user: Array.isArray(updated?.user_profiles)
      ? (updated.user_profiles[0] ?? null)
      : (updated?.user_profiles ?? null),
    user_profiles: undefined,
  };

  return NextResponse.json({ review: normalized });
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const { id: reviewId } = await params;
  const { user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  const { data: review } = await adminClient
    .from("reviews")
    .select("id, user_id, image_urls, shop_id")
    .eq("id", reviewId)
    .maybeSingle();

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const { data: profile } = await adminClient
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isOwner = review.user_id === user.id;
  const isAdmin = profile?.role === "admin";

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await adminClient
    .from("reviews")
    .delete()
    .eq("id", reviewId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Storage 이미지 삭제 (soft failure — DB 삭제가 먼저 성공했으므로 실패해도 무시)
  if (review.image_urls.length > 0) {
    const paths = review.image_urls
      .map((url: string) => {
        try {
          const u = new URL(url.split("?")[0]);
          // URL 형식: .../storage/v1/object/public/shop-images/{path}
          const prefix = `/storage/v1/object/public/${BUCKET}/`;
          const idx = u.pathname.indexOf(prefix);
          if (idx === -1) return null;
          return u.pathname.slice(idx + prefix.length);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as string[];

    const thumbPaths = paths.map((p) => p.replace(/\.jpg$/, "_thumb.jpg"));

    await adminClient.storage.from(BUCKET).remove([...paths, ...thumbPaths]);
  }

  return new NextResponse(null, { status: 204 });
}
