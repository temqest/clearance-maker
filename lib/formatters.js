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

export function formatEnglishDate(dateInput) {
  if (!dateInput) return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  try {
    if (typeof dateInput === "string" && dateInput.includes("-")) {
      const parts = dateInput.split("T")[0].split("-");
      if (parts.length === 3 && parts[0].length === 4) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      }
    }
    const d = new Date(dateInput);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    }
  } catch {}
  return String(dateInput);
}

export function generateClearanceFilename(formData, ext = "") {
  if (!formData) return ext ? `Clearance_Document.${ext.replace(/^\./, "")}` : "Clearance_Document";

  let lastName = (formData.lastName || "").trim();
  let firstName = (formData.firstName || "").trim();

  if (!lastName && !firstName && formData.fullName) {
    const rawName = String(formData.fullName).trim();
    if (rawName.includes(",")) {
      const parts = rawName.split(",");
      lastName = parts[0].trim();
      const firstParts = (parts[1] || "").trim().split(" ");
      firstName = firstParts[0] || "";
    } else {
      const nameParts = rawName.split(" ");
      if (nameParts.length > 1) {
        lastName = nameParts[nameParts.length - 1].trim();
        firstName = nameParts.slice(0, nameParts.length - 1).join("_").trim();
      } else {
        lastName = rawName;
      }
    }
  }

  const clearanceType = (formData.documentType || formData.purpose || "RTC_Clearance")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const safeLastName = lastName.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "Constituent";
  const safeFirstName = firstName.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  const namePart = safeFirstName ? `${safeLastName}_${safeFirstName}` : safeLastName;
  const rawFileName = `${namePart}_${clearanceType}`;

  return ext ? `${rawFileName}.${ext.replace(/^\./, "")}` : rawFileName;
}
