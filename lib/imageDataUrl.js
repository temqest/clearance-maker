function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image."));
    img.src = src;
  });
}

/**
 * Converts arbitrary uploaded images into Word-safe PNG/JPEG data URLs.
 */
export async function fileToWordSafeDataUrl(file, options = {}) {
  const {
    outputType = "image/jpeg",
    quality = 0.92,
    maxWidth = 1200,
    maxHeight = 1200
  } = options;

  const originalDataUrl = await readAsDataUrl(file);
  const originalMime = String(file.type || "").toLowerCase();

  const alreadySafe = originalMime === "image/png" || originalMime === "image/jpeg";
  const shouldResize = file.size > 2_000_000;

  if (alreadySafe && !shouldResize) {
    return originalDataUrl;
  }

  const img = await loadImage(originalDataUrl);
  const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return originalDataUrl;
  }

  if (outputType === "image/jpeg") {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL(outputType, quality);
}