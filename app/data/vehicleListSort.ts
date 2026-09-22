export function compareInternalNumbers(
  first: { internalNumber: string },
  second: { internalNumber: string }
) {
  const firstNumber = parseInternalNumber(first.internalNumber);
  const secondNumber = parseInternalNumber(second.internalNumber);

  if (firstNumber === null && secondNumber === null) {
    return first.internalNumber.localeCompare(second.internalNumber, "es", { numeric: true });
  }
  if (firstNumber === null) return 1;
  if (secondNumber === null) return -1;

  return firstNumber - secondNumber;
}

function parseInternalNumber(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
