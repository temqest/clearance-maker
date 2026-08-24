import jsQR from "jsqr";

/**
 * Decode QR code from ImageData object
 * @param {ImageData} imageData 
 * @returns {string|null} Scanned text or null
 */
export function decodeQrFromImageData(imageData) {
  if (!imageData || !imageData.data) return null;
  try {
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    return code ? code.data : null;
  } catch (err) {
    console.error("jsQR decoding error:", err);
    return null;
  }
}

/**
 * Decode QR code from an uploaded Image File
 * @param {File} file 
 * @returns {Promise<string|null>} Scanned text or null
 */
export function decodeQrFromImageFile(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = decodeQrFromImageData(imageData);
        resolve(decoded);
      };
      img.onerror = () => resolve(null);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
