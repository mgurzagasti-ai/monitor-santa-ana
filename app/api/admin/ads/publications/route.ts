import { NextRequest, NextResponse } from "next/server";
import { deleteAdPublication, getAdPlacements, readAdPublications, saveAdPublication } from "@/app/data/advertising";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    publications: await readAdPublications(),
    placements: getAdPlacements(),
    updatedAt: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  try {
    const publication = await saveAdPublication(await request.json());
    return NextResponse.json({
      publication,
      publications: await readAdPublications(),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la publicacion" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  await deleteAdPublication(id);
  return NextResponse.json({
    publications: await readAdPublications(),
    updatedAt: new Date().toISOString()
  });
}
