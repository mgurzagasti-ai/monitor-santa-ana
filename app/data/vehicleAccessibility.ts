const accessibleInternalNumbers = new Set([
  "760", "763", "764", "765", "766", "767", "768", "769", "770", "771",
  "772", "773", "774", "775", "776", "777", "788", "789", "790", "791"
]);

export function hasWheelchairRamp(internalNumber: string | null | undefined) {
  return accessibleInternalNumbers.has(String(internalNumber ?? "").trim());
}
