/** Calendar dates are normalised to UTC, so a week is seven days in every timezone. */
export function latestOrderDate(
  neededBy: string,
  leadTimeWeeks: number,
): string {
  const date = new Date(neededBy);
  if (
    !Number.isFinite(date.getTime()) ||
    !Number.isFinite(leadTimeWeeks) ||
    leadTimeWeeks < 0
  )
    throw new RangeError(
      "A valid need-by date and nonnegative lead time are required.",
    );
  return new Date(date.getTime() - leadTimeWeeks * 7 * 86400000).toISOString();
}
