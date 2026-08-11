import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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

export async function readLineStops(): Promise<LineStop[]> {
  try {
    const raw = await readFile(stopsFilePath, "utf8");
    const stops = JSON.parse(raw) as LineStop[];
    return Array.isArray(stops) ? stops.filter(isValidStop) : [];
  } catch {
    return [];
  }
}

export async function writeLineStops(stops: LineStop[]) {
  await mkdir(path.dirname(stopsFilePath), { recursive: true });
  await writeFile(stopsFilePath, `${JSON.stringify(stops, null, 2)}\n`, "utf8");
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
