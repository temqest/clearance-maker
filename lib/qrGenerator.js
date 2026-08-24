import QRCode from "qrcode";

/**
 * Generate a QR code Data URL (PNG)
 * @param {string} text - Content to encode (e.g. document ID or JSON)
 * @param {object} options - QRCode options
 * @returns {Promise<string>} PNG Data URL
 */
export async function generateQrDataUrl(text, options = {}) {
  try {
    const opts = {
      errorCorrectionLevel: "M",
      type: "image/png",
      quality: 0.92,
      margin: 1,
      color: {
        dark: "#09090B",
        light: "#FFFFFF",
      },
      width: 300,
      ...options,
    };
    return await QRCode.toDataURL(text, opts);
  } catch (err) {
    console.error("Failed to generate QR Data URL:", err);
    return "";
  }
}

/**
 * Generate a QR code SVG string
 * @param {string} text - Content to encode
 * @param {object} options - QRCode options
 * @returns {Promise<string>} SVG string
 */
export async function generateQrSvgString(text, options = {}) {
  try {
    const opts = {
      errorCorrectionLevel: "M",
      type: "svg",
      margin: 1,
      color: {
        dark: "#09090B",
        light: "#FFFFFF",
      },
      ...options,
    };
    return await QRCode.toString(text, opts);
  } catch (err) {
    console.error("Failed to generate QR SVG string:", err);
    return "";
  }
}
