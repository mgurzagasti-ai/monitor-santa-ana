import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isRedisConfigured, redisCommand } from "./redis";

export type PublicAppVersion = {
  latestVersionCode: number;
  latestVersionName: string;
  title: string;
  message: string;
  playStoreUrl: string;
  required: boolean;
  updatedAt: string;
};

const DEFAULT_VERSION_CODE = 5;
const DEFAULT_VERSION_NAME = "1.1.3";
const DEFAULT_PACKAGE_ID = "ar.com.santaana.bus";
const appVersionFilePath = path.join(process.cwd(), "app", "data", "appVersion.json");
const appVersionRedisKey = "app_version_v1";

export async function getPublicAppVersion(): Promise<PublicAppVersion> {
  return normalizeAppVersion((await readRedisAppVersion()) ?? (await readLocalAppVersion()) ?? envAppVersion());
}

export async function savePublicAppVersion(payload: Partial<PublicAppVersion>): Promise<PublicAppVersion> {
  const current = await getPublicAppVersion();
  const next = normalizeAppVersion({ ...current, ...payload, updatedAt: new Date().toISOString() });
  await writeAppVersion(next);
  return next;
}

function envAppVersion(): PublicAppVersion {
  const latestVersionCode = readNumber(process.env.PUBLIC_APP_LATEST_VERSION_CODE, DEFAULT_VERSION_CODE);
  const latestVersionName = process.env.PUBLIC_APP_LATEST_VERSION_NAME?.trim() || DEFAULT_VERSION_NAME;
  const packageId = process.env.PUBLIC_APP_PACKAGE_ID?.trim() || DEFAULT_PACKAGE_ID;

  return {
    latestVersionCode,
    latestVersionName,
    title: process.env.PUBLIC_APP_VERSION_TITLE?.trim() || "Nueva version disponible",
    message:
      process.env.PUBLIC_APP_VERSION_MESSAGE?.trim() ||
      `Ya podes actualizar Colectivos Jujuy a la version ${latestVersionName} desde Google Play.`,
    playStoreUrl:
      process.env.PUBLIC_APP_PLAY_STORE_URL?.trim() ||
      `https://play.google.com/store/apps/details?id=${packageId}`,
    required: process.env.PUBLIC_APP_UPDATE_REQUIRED === "true",
    updatedAt: new Date().toISOString()
  };
}

function normalizeAppVersion(value: Partial<PublicAppVersion>): PublicAppVersion {
  const latestVersionCode = normalizeNumber(value.latestVersionCode, DEFAULT_VERSION_CODE, 1, 999999);
  const latestVersionName = String(value.latestVersionName ?? DEFAULT_VERSION_NAME).trim() || DEFAULT_VERSION_NAME;
  const packageId = process.env.PUBLIC_APP_PACKAGE_ID?.trim() || DEFAULT_PACKAGE_ID;
  const title = String(value.title ?? "Nueva version disponible").trim() || "Nueva version disponible";
  const message =
    String(value.message ?? "").trim() ||
    `Ya podes actualizar Colectivos Jujuy a la version ${latestVersionName} desde Google Play.`;

  return {
    latestVersionCode,
    latestVersionName,
    title,
    message,
    playStoreUrl:
      String(value.playStoreUrl ?? "").trim() ||
      `https://play.google.com/store/apps/details?id=${packageId}`,
    required: Boolean(value.required),
    updatedAt: String(value.updatedAt ?? "").trim() || new Date().toISOString()
  };
}

async function writeAppVersion(version: PublicAppVersion) {
  await writeRedisAppVersion(version);

  try {
    await mkdir(path.dirname(appVersionFilePath), { recursive: true });
    await writeFile(appVersionFilePath, `${JSON.stringify(version, null, 2)}\n`, "utf8");
  } catch (error) {
    if (isRedisConfigured() && isReadOnlyFileSystemError(error)) return;
    if (isReadOnlyFileSystemError(error)) {
      throw new Error("No se pudo guardar: el servidor no permite escribir archivos y Redis no esta configurado.");
    }
    throw error;
  }
}

async function readLocalAppVersion(): Promise<PublicAppVersion | null> {
  try {
    return normalizeAppVersion(JSON.parse(await readFile(appVersionFilePath, "utf8")) as Partial<PublicAppVersion>);
  } catch {
    return null;
  }
}

async function readRedisAppVersion(): Promise<PublicAppVersion | null> {
  if (!isRedisConfigured()) return null;
  const response = await redisCommand<string | null>(["GET", appVersionRedisKey]);
  if (!response) return null;

  try {
    return normalizeAppVersion(JSON.parse(response) as Partial<PublicAppVersion>);
  } catch {
    return null;
  }
}

async function writeRedisAppVersion(version: PublicAppVersion) {
  if (!isRedisConfigured()) return;
  await redisCommand(["SET", appVersionRedisKey, JSON.stringify(version)]);
}

function readNumber(value: string | undefined, fallback: number): number {
  return normalizeNumber(value, fallback, 1, 999999);
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function isReadOnlyFileSystemError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "EROFS");
}