import { createHash, timingSafeEqual } from "node:crypto";

export type AssignmentOperatorPasswordResult = "valid" | "invalid" | "not_configured";

export function validateAssignmentOperatorPassword(submittedPassword: unknown): AssignmentOperatorPasswordResult {
  const configuredPassword = process.env.ASSIGNMENT_OPERATOR_PASSWORD;
  if (!configuredPassword) return "not_configured";
  if (typeof submittedPassword !== "string" || submittedPassword.length === 0) return "invalid";

  const configuredDigest = createHash("sha256").update(configuredPassword).digest();
  const submittedDigest = createHash("sha256").update(submittedPassword).digest();
  return timingSafeEqual(configuredDigest, submittedDigest) ? "valid" : "invalid";
}
