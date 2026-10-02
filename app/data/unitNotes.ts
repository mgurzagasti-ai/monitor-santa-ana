import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isRedisConfigured, redisCommand } from "./redis";

export type UnitNote = {
  internalNumber: string;
  description: string;
  updatedAt: string;
};

const unitNotesFilePath = path.join(process.cwd(), "app", "data", "unitNotes.json");
const unitNotesRedisKey = "unit_notes_v1";

export async function readUnitNotes(): Promise<UnitNote[]> {
  const remoteNotes = await readRedisUnitNotes();
  if (remoteNotes) return remoteNotes;
  return readLocalUnitNotes();
}

export async function saveUnitNote(internalNumberValue: unknown, descriptionValue: unknown): Promise<UnitNote[]> {
  const internalNumber = normalizeInternalNumber(internalNumberValue);
  if (!internalNumber) throw new Error("Falta interno");

  const description = String(descriptionValue ?? "").trim();
  if (description.length > 1000) throw new Error("La novedad no puede superar los 1000 caracteres");

  const notes = (await readUnitNotes()).filter((note) => note.internalNumber !== internalNumber);
  if (description) {
    notes.push({ internalNumber, description, updatedAt: new Date().toISOString() });
  }

  notes.sort((left, right) => left.internalNumber.localeCompare(right.internalNumber, "es", { numeric: true }));
  await writeUnitNotes(notes);
  return notes;
}

export function normalizeUnitNotes(value: unknown): UnitNote[] {
  if (!Array.isArray(value)) return [];

  const byInternalNumber = new Map<string, UnitNote>();
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const candidate = row as Partial<UnitNote>;
    const internalNumber = normalizeInternalNumber(candidate.internalNumber);
    const description = String(candidate.description ?? "").trim();
    if (!internalNumber || !description || description.length > 1000) continue;
    byInternalNumber.set(internalNumber, {
      internalNumber,
      description,
      updatedAt: String(candidate.updatedAt ?? "").trim() || new Date(0).toISOString()
    });
  }

  return [...byInternalNumber.values()].sort((left, right) =>
    left.internalNumber.localeCompare(right.internalNumber, "es", { numeric: true })
  );
}

async function readLocalUnitNotes(): Promise<UnitNote[]> {
  try {
    return normalizeUnitNotes(JSON.parse(await readFile(unitNotesFilePath, "utf8")));
  } catch {
    return [];
  }
}

async function readRedisUnitNotes(): Promise<UnitNote[] | null> {
  if (!isRedisConfigured()) return null;
  const response = await redisCommand<string | null>(["GET", unitNotesRedisKey]);
  if (!response) return [];

  try {
    return normalizeUnitNotes(JSON.parse(response));
  } catch {
    return [];
  }
}

async function writeUnitNotes(notes: UnitNote[]) {
  if (isRedisConfigured()) {
    await redisCommand(["SET", unitNotesRedisKey, JSON.stringify(notes)]);
  }

  try {
    await mkdir(path.dirname(unitNotesFilePath), { recursive: true });
    await writeFile(unitNotesFilePath, `${JSON.stringify(notes, null, 2)}\n`, "utf8");
  } catch (error) {
    if (isRedisConfigured() && isReadOnlyFileSystemError(error)) return;
    if (isReadOnlyFileSystemError(error)) {
      throw new Error("No se pudo guardar: el servidor no permite escribir archivos y Redis no esta configurado.");
    }
    throw error;
  }
}

function normalizeInternalNumber(value: unknown) {
  return String(value ?? "").trim();
}

function isReadOnlyFileSystemError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "EROFS");
}
