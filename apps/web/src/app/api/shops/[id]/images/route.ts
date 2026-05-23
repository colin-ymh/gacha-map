import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "shop-images";
const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Props) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) return authResult.response;

  const { id: shopId } = await params;
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const files = formData.getAll("file") as File[];
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES} files per request` },
      { status: 400 },
    );
  }

  const displayUrls: string[] = [];
  const thumbUrls: string[] = [];

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File ${file.name} exceeds 10MB limit` },
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

    const displayPath = `${shopId}/${uuid}.jpg`;
    const thumbPath = `${shopId}/${uuid}_thumb.jpg`;

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

    if (displayUpload.error) {
      return NextResponse.json(
        { error: `Upload failed: ${displayUpload.error.message}` },
        { status: 500 },
      );
    }
    if (thumbUpload.error) {
      return NextResponse.json(
        { error: `Thumbnail upload failed: ${thumbUpload.error.message}` },
        { status: 500 },
      );
    }

    const { data: displayPublic } = adminClient.storage
      .from(BUCKET)
      .getPublicUrl(displayPath);
    const { data: thumbPublic } = adminClient.storage
      .from(BUCKET)
      .getPublicUrl(thumbPath);

    displayUrls.push(`${displayPublic.publicUrl}?t=${ts}`);
    thumbUrls.push(`${thumbPublic.publicUrl}?t=${ts}`);
  }

  const { data: current } = await adminClient
    .from("shops")
    .select("image_urls, image_thumbnails")
    .eq("id", shopId)
    .single();

  const updatedImageUrls = [...(current?.image_urls ?? []), ...displayUrls];
  const updatedThumbnails = [
    ...(current?.image_thumbnails ?? []),
    ...thumbUrls,
  ];

  const { error: updateError } = await adminClient
    .from("shops")
    .update({
      image_urls: updatedImageUrls,
      image_thumbnails: updatedThumbnails,
    })
    .eq("id", shopId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    image_urls: updatedImageUrls,
    image_thumbnails: updatedThumbnails,
  });
}
