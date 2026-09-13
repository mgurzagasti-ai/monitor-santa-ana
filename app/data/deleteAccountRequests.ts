import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isRedisConfigured, redisCommand } from "./redis";

export type DeleteAccountRequestStatus = "PENDING";

export type DeleteAccountRequest = {
  id: string;
  email: string;
  status: DeleteAccountRequestStatus;
  createdAt: string;
  updatedAt: string;
  userAgentHash: string;
};

const redisListKey = "delete_account_requests_v1";
const redisRequestKeyPrefix = "delete_account_request_v1:";
const localRequestsFilePath = path.join(process.cwd(), "app", "data", "deleteAccountRequests.local.json");

export async function createDeleteAccountRequest(payload: {
  email: string;
  userAgent: string;
}): Promise<DeleteAccountRequest> {
  const now = new Date().toISOString();
  const request: DeleteAccountRequest = {
    id: `del-${randomUUID().slice(0, 12)}`,
    email: normalizeEmail(payload.email),
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
    userAgentHash: hashValue(payload.userAgent)
  };

  if (isRedisConfigured()) {
    await writeRedisRequest(request);
    return request;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Redis no esta configurado para guardar solicitudes de eliminacion.");
  }

  await writeLocalRequest(request);
  return request;
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  const email = normalizeEmail(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function hashEmail(value: string) {
  return hashValue(normalizeEmail(value));
}

async function writeRedisRequest(request: DeleteAccountRequest) {
  await redisCommand(["SET", `${redisRequestKeyPrefix}${request.id}`, JSON.stringify(request)]);
  await redisCommand(["LPUSH", redisListKey, request.id]);
}

async function writeLocalRequest(request: DeleteAccountRequest) {
  const requests = await readLocalRequests();
  await mkdir(path.dirname(localRequestsFilePath), { recursive: true });
  await writeFile(localRequestsFilePath, `${JSON.stringify([request, ...requests], null, 2)}\n`, "utf8");
}

async function readLocalRequests(): Promise<DeleteAccountRequest[]> {
  try {
    const raw = await readFile(localRequestsFilePath, "utf8");
    const parsed = JSON.parse(raw) as DeleteAccountRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
