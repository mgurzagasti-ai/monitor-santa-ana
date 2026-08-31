import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const maxImageBytes = 4 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Falta imagen" }, { status: 400 });
    }

    if (!allowedImageTypes.has(file.type)) {
      return NextResponse.json({ error: "Formato de imagen no soportado" }, { status: 400 });
    }

    if (file.size > maxImageBytes) {
      return NextResponse.json({ error: "La imagen supera 4 MB" }, { status: 400 });
    }

    const extension = imageExtension(file.type);
    const pathname = `ads/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type,
      storeId: process.env.ADS_BLOB_STORE_ID
    });

    return NextResponse.json({
      imageUrl: blob.url,
      imageStorage: "vercel-blob",
      imagePath: blob.pathname
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo subir la imagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const imagePath = request.nextUrl.searchParams.get("imagePath")?.trim();
  if (!imagePath) {
    return NextResponse.json({ error: "Falta imagePath" }, { status: 400 });
  }

  try {
    await del(imagePath);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo borrar la imagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function imageExtension(contentType: string) {
  switch (contentType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return ".jpg";
  }
}
