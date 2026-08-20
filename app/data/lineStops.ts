import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isRedisConfigured, redisCommand } from "./redis";

export type LineStopDirection = "ida" | "vuelta" | "ambos";

export type LineStop = {
  id: string;
  lineId: string;
  name: string;
  latitude: number;
  longitude: number;
  direction: LineStopDirection;
  order?: number;
};

const stopsFilePath = path.join(process.cwd(), "app", "data", "lineStops.json");
const stopsRedisKey = "line_stops";

export async function readLineStops(): Promise<LineStop[]> {
  const remoteStops = await readRedisLineStops();
  if (remoteStops) return remoteStops;

  return readLocalLineStops();
}

export async function writeLineStops(stops: LineStop[]) {
  await writeRedisLineStops(stops);

  try {
    await mkdir(path.dirname(stopsFilePath), { recursive: true });
    await writeFile(stopsFilePath, `${JSON.stringify(stops, null, 2)}\n`, "utf8");
  } catch (error) {
    if (isRedisConfigured() && isReadOnlyFileSystemError(error)) return;
    if (isReadOnlyFileSystemError(error)) {
      throw new Error("No se pudo guardar: el servidor no permite escribir archivos y Redis no esta configurado.");
    }
    throw error;
  }
}

async function readLocalLineStops(): Promise<LineStop[]> {
  try {
    const raw = await readFile(stopsFilePath, "utf8");
    const stops = JSON.parse(raw) as LineStop[];
    return Array.isArray(stops) ? stops.filter(isValidStop) : [];
  } catch {
    return [];
  }
}

async function readRedisLineStops(): Promise<LineStop[] | null> {
  if (!isRedisConfigured()) return null;

  const response = await redisCommand<string | null>(["GET", stopsRedisKey]);
  if (!response) return null;

  try {
    const stops = JSON.parse(response) as LineStop[];
    return Array.isArray(stops) ? stops.filter(isValidStop) : [];
  } catch {
    return [];
  }
}

async function writeRedisLineStops(stops: LineStop[]) {
  if (!isRedisConfigured()) return;
  await redisCommand(["SET", stopsRedisKey, JSON.stringify(stops)]);
}

function isReadOnlyFileSystemError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "EROFS");
}

function isValidStop(stop: LineStop) {
  return Boolean(
    stop &&
      typeof stop.id === "string" &&
      typeof stop.lineId === "string" &&
      typeof stop.name === "string" &&
      Number.isFinite(stop.latitude) &&
      Number.isFinite(stop.longitude) &&
      ["ida", "vuelta", "ambos"].includes(stop.direction)
  );
}
