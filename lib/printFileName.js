const MONTH_NUMBER = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12"
};

function cleanToken(value, fallback = "NA") {
  const token = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();

  return token || fallback;
}

function getNameParts(fullName) {
  const raw = String(fullName || "").trim();
  if (!raw) {
    return { first: "FIRST", last: "LAST" };
  }

  if (raw.includes(",")) {
    const [lastPart, firstPart] = raw.split(",");
    const first = cleanToken((firstPart || "").split(/\s+/)[0], "FIRST");
    const last = cleanToken(lastPart, "LAST");
    return { first, last };
  }

  const parts = raw.split(/\s+/).filter(Boolean);
  const first = cleanToken(parts[0], "FIRST");
  const last = cleanToken(parts[parts.length - 1], "LAST");
  return { first, last };
}

function getDateToken(formData) {
  const year = String(formData?.givenYear || "").replace(/[^0-9]/g, "").slice(0, 4);
  const monthRaw = String(formData?.givenMonth || "")
    .replace(/,/g, "")
    .trim()
    .toLowerCase();
  const month = MONTH_NUMBER[monthRaw] || "00";
  const day = String(formData?.givenDay || "")
    .replace(/[^0-9]/g, "")
    .padStart(2, "0")
    .slice(0, 2);

  if (!year || day === "00") {
    return "DATE_UNKNOWN";
  }

  return `${year}${month}${day}`;
}

export function buildClearanceFileName(formData) {
  const { first, last } = getNameParts(formData?.fullName);
  const purpose = cleanToken(formData?.purpose, "GENERAL");
  const certNo = cleanToken(formData?.certNo, "NO_CERT");
  const dateToken = getDateToken(formData);

  return `${last}_${first}_RTC_CLEARANCE_${purpose}_CERT-${certNo}_${dateToken}`;
}
