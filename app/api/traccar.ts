import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { readEnvFleetDevices, type FleetDevice } from "@/app/data/fleetDevices";


export type TraccarPosition = {
  deviceId: number;
  latitude: number;
  longitude: number;
  speedKmh: number;
  course: number | null;
  fixTime: string;
  valid: boolean;
  motion: boolean | null;
  ignition: boolean | null;
  power: number | null;
  battery: number | null;
  satellites: number | null;
  distance: number | null;
};

export type TraccarDevice = {
  id: number;
  name: string;
  uniqueId: string;
  status?: string;
};

type TraccarConfig = {
  baseUrl: string;
  email: string;
  password: string;
  devices: FleetDevice[];
};

export function getConfig(): TraccarConfig {
  const props = readLocalProperties();
  const deviceId = Number(process.env.TRACCAR_DEVICE_ID ?? props["traccar.deviceId"] ?? 0);
  const devices = readEnvFleetDevices(process.env.FLEET_DEVICES, deviceId);

  return {
    baseUrl: (process.env.TRACCAR_BASE_URL ?? props["traccar.baseUrl"] ?? "").replace(/\/$/, ""),
    email: process.env.TRACCAR_EMAIL ?? props["traccar.email"] ?? "",
    password: process.env.TRACCAR_PASSWORD ?? props["traccar.password"] ?? "",
    devices
  };
}

export async function fetchPositions(path: string): Promise<TraccarPosition[]> {
  const rows = await fetchTraccarJson<Array<Record<string, unknown>>>(path);
  return rows
    .map((row) => ({
      deviceId: Number(row.deviceId),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      speedKmh: Number(row.speed ?? 0) * 1.852,
      course: readNullableNumber(row.course),
      fixTime: String(row.fixTime ?? ""),
      valid: row.valid !== false,
      motion: readBooleanAttribute(row, "motion"),
      ignition: readBooleanAttribute(row, "ignition"),
      power: readNumberAttribute(row, "power"),
      battery: readNumberAttribute(row, "battery"),
      satellites: readNumberAttribute(row, "sat"),
      distance: readNumberAttribute(row, "distance")
    }))
    .filter((position) => Number.isFinite(position.latitude) && Number.isFinite(position.longitude));
}

export async function fetchTraccarDevices(): Promise<TraccarDevice[]> {
  const rows = await fetchTraccarJson<Array<Record<string, unknown>>>("/api/devices");
  return rows
    .map((row) => ({
      id: Number(row.id),
      name: String(row.name ?? ""),
      uniqueId: String(row.uniqueId ?? ""),
      status: typeof row.status === "string" ? row.status : undefined
    }))
    .filter((device) => Number.isFinite(device.id) && device.id > 0 && device.uniqueId);
}

async function fetchTraccarJson<T>(path: string): Promise<T> {
  const config = getConfig();
  if (!config.baseUrl || !config.email || !config.password) {
    throw new Error("Falta configurar Traccar");
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${config.email}:${config.password}`).toString("base64")}`
    },
    cache: "no-store"
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Traccar HTTP ${response.status}: ${body.slice(0, 160)}`);
  }

  return JSON.parse(body) as T;
}

function readAttributes(row: Record<string, unknown>): Record<string, unknown> {
  const attributes = row.attributes;
  return attributes && typeof attributes === "object" ? (attributes as Record<string, unknown>) : {};
}

function readNullableNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function readBooleanAttribute(row: Record<string, unknown>, name: string): boolean | null {
  const value = readAttributes(row)[name];
  return typeof value === "boolean" ? value : null;
}

function readNumberAttribute(row: Record<string, unknown>, name: string): number | null {
  const value = Number(readAttributes(row)[name]);
  return Number.isFinite(value) ? value : null;
}

function readLocalProperties(): Record<string, string> {
  const candidates = [
    join(process.cwd(), ".env.local.properties"),
    join(process.cwd(), "..", "local.properties")
  ];

  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) return {};

  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .reduce<Record<string, string>>((acc, line) => {
      const index = line.indexOf("=");
      acc[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/\\:/g, ":");
      return acc;
    }, {});
}
