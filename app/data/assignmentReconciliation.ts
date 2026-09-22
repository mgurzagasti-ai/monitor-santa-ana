export function reconcileAssignment<T extends { deviceId: number; internalNumber: string }>(
  assignments: T[],
  next: T
) {
  const replacementIndex = assignments.findIndex(
    (assignment) =>
      assignment.deviceId === next.deviceId ||
      sameInternalNumber(assignment.internalNumber, next.internalNumber)
  );
  const nextAssignments = assignments.filter(
    (assignment) =>
      assignment.deviceId !== next.deviceId &&
      !sameInternalNumber(assignment.internalNumber, next.internalNumber)
  );

  nextAssignments.splice(
    replacementIndex >= 0 ? Math.min(replacementIndex, nextAssignments.length) : nextAssignments.length,
    0,
    next
  );
  return nextAssignments;
}

function sameInternalNumber(current: string, next: string) {
  return current.trim().toLowerCase() === next.trim().toLowerCase();
}
