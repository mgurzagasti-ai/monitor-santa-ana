import { randomUUID } from "node:crypto";
import { del } from "@vercel/blob";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isRedisConfigured, redisCommand } from "./redis";

export type AdDestinationType = "whatsapp" | "website" | "instagram" | "facebook" | "none";
export type AdPlacementCode = "MAIN_BOTTOM" | "LINES_BOTTOM" | "MAP_BOTTOM" | "NEWS_BOTTOM" | "FAVORITES_BOTTOM" | "PROFILE_BOTTOM";

export type AdImageStorage = "external" | "vercel-blob" | "";

export type AdPublication = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  imageStorage: AdImageStorage;
  imagePath: string;
  buttonText: string;
  destinationType: AdDestinationType;
  destinationUrl: string;
  placements: AdPlacementCode[];
  active: boolean;
  startDate: string;
  endDate: string;
  priority: number;
  durationSeconds: number;
  createdAt: string;
  updatedAt: string;
};

export type PublicAd = Pick<
  AdPublication,
  "id" | "title" | "subtitle" | "imageUrl" | "buttonText" | "destinationType" | "destinationUrl" | "durationSeconds"
> & { placement: AdPlacementCode };

const adPublicationsFilePath = path.join(process.cwd(), "app", "data", "adPublications.json");
const adPublicationsRedisKey = "ad_publications_v1";

const allowedDestinationTypes: AdDestinationType[] = ["whatsapp", "website", "instagram", "facebook", "none"];
const allowedPlacements: AdPlacementCode[] = ["MAIN_BOTTOM", "LINES_BOTTOM", "MAP_BOTTOM", "NEWS_BOTTOM", "PROFILE_BOTTOM"];

export function getAdPlacements() {
  return allowedPlacements.map((code) => ({ code, name: placementName(code) }));
}

export async function readAdPublications(): Promise<AdPublication[]> {
  const remotePublications = await readRedisAdPublications();
  const publications = remotePublications ?? (await readLocalAdPublications());
  const repairedPublications = repairPublicationIds(publications);

  if (repairedPublications.changed) {
    try {
      await writeAdPublications(repairedPublications.publications);
    } catch {
      // Keep the repaired IDs in this response even if persistence is temporarily unavailable.
    }
  }

  return repairedPublications.publications;
}

export async function saveAdPublication(payload: Partial<AdPublication>): Promise<AdPublication> {
  const publications = await readAdPublications();
  const now = new Date().toISOString();
  const existing = payload.id ? publications.find((publication) => publication.id === payload.id) : null;
  const publication = normalizeAdPublication(payload, existing ?? undefined, now);
  const nextPublications = existing
    ? publications.map((row) => (row.id === publication.id ? publication : row))
    : [publication, ...publications];

  await writeAdPublications(nextPublications);
  await deleteReplacedBlobImage(existing ?? undefined, publication);
  return publication;
}

export async function deleteAdPublication(id: string) {
  const publications = await readAdPublications();
  const removedPublications = publications.filter((publication) => publication.id === id);
  await writeAdPublications(publications.filter((publication) => publication.id !== id));
  await Promise.all(removedPublications.map((publication) => deleteBlobImage(publication.imagePath)));
}

export async function getActiveAds(placement: string | null): Promise<PublicAd[]> {
  const normalizedPlacement = normalizePlacement(placement) ?? "MAIN_BOTTOM";
  const now = Date.now();
  const publications = await readAdPublications();

  return publications
    .filter((publication) => isPublicationActive(publication, normalizedPlacement, now))
    .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt))
    .map((publication) => ({
      id: publication.id,
      title: publication.title,
      subtitle: publication.subtitle,
      imageUrl: publication.imageUrl,
      buttonText: publication.buttonText,
      destinationType: publication.destinationType,
      destinationUrl: publication.destinationUrl,
      durationSeconds: publication.durationSeconds,
      placement: normalizedPlacement
    }));
}

export function normalizePlacement(value: string | null | undefined): AdPlacementCode | null {
  const placement = String(value ?? "").trim().toUpperCase();
  return allowedPlacements.includes(placement as AdPlacementCode) ? (placement as AdPlacementCode) : null;
}

function normalizeAdPublication(payload: Partial<AdPublication>, existing: AdPublication | undefined, now: string): AdPublication {
  const payloadId = String(payload.id ?? "").trim();
  const title = String(payload.title ?? existing?.title ?? "").trim();
  const subtitle = String(payload.subtitle ?? existing?.subtitle ?? "").trim();
  const imageUrl = String(payload.imageUrl ?? existing?.imageUrl ?? "").trim();
  const imageStorage = normalizeImageStorage(payload.imageStorage ?? existing?.imageStorage, imageUrl);
  const imagePath = imageStorage === "vercel-blob" ? String(payload.imagePath ?? existing?.imagePath ?? "").trim() : "";
  const buttonText = String(payload.buttonText ?? existing?.buttonText ?? "Ver").trim();
  const destinationType = normalizeDestinationType(payload.destinationType ?? existing?.destinationType);
  const destinationUrl = String(payload.destinationUrl ?? existing?.destinationUrl ?? "").trim();
  const placements = normalizePlacements(payload.placements ?? existing?.placements);
  const startDate = normalizeDate(payload.startDate ?? existing?.startDate, "start");
  const endDate = normalizeDate(payload.endDate ?? existing?.endDate, "end");
  const priority = normalizeNumber(payload.priority ?? existing?.priority, 0, 0, 1000);
  const durationSeconds = normalizeNumber(payload.durationSeconds ?? existing?.durationSeconds, 8, 4, 60);

  if (!title) throw new Error("Falta titulo");
  if (destinationType !== "none" && !destinationUrl) throw new Error("Falta enlace de destino");
  if (new Date(startDate).getTime() > new Date(endDate).getTime()) throw new Error("La fecha de inicio no puede ser posterior al fin");

  return {
    id: existing?.id || payloadId || `ad-${randomUUID().slice(0, 8)}`,
    title,
    subtitle,
    imageUrl,
    imageStorage,
    imagePath,
    buttonText,
    destinationType,
    destinationUrl: destinationType === "none" ? "" : destinationUrl,
    placements,
    active: Boolean(payload.active ?? existing?.active ?? false),
    startDate,
    endDate,
    priority,
    durationSeconds,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
}

async function writeAdPublications(publications: AdPublication[]) {
  const validPublications = publications.filter(isValidAdPublication);
  await writeRedisAdPublications(validPublications);

  try {
    await mkdir(path.dirname(adPublicationsFilePath), { recursive: true });
    await writeFile(adPublicationsFilePath, `${JSON.stringify(validPublications, null, 2)}\n`, "utf8");
  } catch (error) {
    if (isRedisConfigured() && isReadOnlyFileSystemError(error)) return;
    if (isReadOnlyFileSystemError(error)) {
      throw new Error("No se pudo guardar: el servidor no permite escribir archivos y Redis no esta configurado.");
    }
    throw error;
  }
}

async function readLocalAdPublications(): Promise<AdPublication[]> {
  try {
    const raw = await readFile(adPublicationsFilePath, "utf8");
    const publications = JSON.parse(raw) as AdPublication[];
    return Array.isArray(publications) ? publications.filter(isValidAdPublication) : [];
  } catch {
    return [];
  }
}

async function readRedisAdPublications(): Promise<AdPublication[] | null> {
  if (!isRedisConfigured()) return null;
  const response = await redisCommand<string | null>(["GET", adPublicationsRedisKey]);
  if (!response) return [];

  try {
    const publications = JSON.parse(response) as AdPublication[];
    return Array.isArray(publications) ? publications.filter(isValidAdPublication) : [];
  } catch {
    return [];
  }
}

async function writeRedisAdPublications(publications: AdPublication[]) {
  if (!isRedisConfigured()) return;
  await redisCommand(["SET", adPublicationsRedisKey, JSON.stringify(publications)]);
}

function repairPublicationIds(publications: AdPublication[]) {
  const usedIds = new Set<string>();
  let changed = false;

  const repaired = publications.map((publication, index) => {
    const currentId = publication.id.trim();
    const id = currentId && !usedIds.has(currentId) ? currentId : buildFallbackPublicationId(publication, index, usedIds);
    usedIds.add(id);

    if (id === publication.id) return publication;
    changed = true;
    return { ...publication, id, updatedAt: publication.updatedAt || new Date().toISOString() };
  });

  return { publications: repaired, changed };
}

function buildFallbackPublicationId(publication: AdPublication, index: number, usedIds: Set<string>) {
  const titleSlug = publication.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  const datePart = publication.createdAt.replace(/[^0-9]/g, "").slice(0, 12);
  const baseId = `ad-${titleSlug || "publicacion"}-${datePart || index + 1}`;
  let id = baseId;
  let suffix = 2;

  while (usedIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return id;
}

function isPublicationActive(publication: AdPublication, placement: AdPlacementCode, now: number) {
  const startsAt = new Date(publication.startDate).getTime();
  const endsAt = new Date(publication.endDate).getTime();
  return publication.active && isPlacementMatch(publication, placement) && Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt <= now && endsAt >= now;
}


function isPlacementMatch(publication: AdPublication, placement: AdPlacementCode) {
  return publication.placements.includes(placement) || publication.placements.includes("MAIN_BOTTOM");
}

async function deleteReplacedBlobImage(existing: AdPublication | undefined, publication: AdPublication) {
  if (!existing) return;
  if (existing.imagePath && existing.imagePath !== publication.imagePath) {
    await deleteBlobImage(existing.imagePath);
  }
}

async function deleteBlobImage(pathname: string) {
  if (!pathname) return;
  try {
    await del(pathname);
  } catch {
    // A missing blob should not block deleting or saving the publication.
  }
}

function normalizeImageStorage(value: unknown, imageUrl: string): AdImageStorage {
  if (value === "vercel-blob") return "vercel-blob";
  if (value === "external") return "external";
  return imageUrl ? "external" : "";
}

function normalizeDestinationType(value: unknown): AdDestinationType {
  return allowedDestinationTypes.includes(value as AdDestinationType) ? (value as AdDestinationType) : "website";
}

function normalizePlacements(value: unknown): AdPlacementCode[] {
  const rows = Array.isArray(value) ? value : [];
  const placements = rows.map((row) => normalizePlacement(String(row))).filter(Boolean) as AdPlacementCode[];
  return placements.length > 0 ? Array.from(new Set(placements)) : ["MAIN_BOTTOM"];
}

function normalizeDate(value: unknown, mode: "start" | "end") {
  const raw = String(value ?? "").trim();
  if (raw) {
    const parsed = new Date(raw);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  const fallback = new Date();
  if (mode === "end") fallback.setMonth(fallback.getMonth() + 1);
  return fallback.toISOString();
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function isReadOnlyFileSystemError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "EROFS");
}

function isValidAdPublication(value: AdPublication) {
  return Boolean(
    value &&
      typeof value.id === "string" &&
      typeof value.title === "string" &&
      typeof value.imageUrl === "string" &&
      allowedDestinationTypes.includes(value.destinationType) &&
      Array.isArray(value.placements) &&
      value.placements.every((placement) => allowedPlacements.includes(placement)) &&
      typeof value.startDate === "string" &&
      typeof value.endDate === "string"
  );
}

function placementName(code: AdPlacementCode) {
  switch (code) {
    case "MAIN_BOTTOM":
      return "Inicio";
    case "LINES_BOTTOM":
      return "Lineas";
    case "MAP_BOTTOM":
      return "Mapa";
    case "NEWS_BOTTOM":
      return "Novedades";
    case "FAVORITES_BOTTOM":
      return "Favoritos";
    case "PROFILE_BOTTOM":
      return "Perfil";
    default:
      return "Principal";
  }
}
