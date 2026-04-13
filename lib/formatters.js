export function splitDayOrdinal(day) {
  const value = day || "";
  const num = value.replace(/[^0-9]/g, "");
  const suffix = value.replace(/[0-9]/g, "");
  return { num, suffix };
}

export function formatMonth(month) {
  if (!month) return "";
  return month.endsWith(",") ? month : `${month},`;
}
