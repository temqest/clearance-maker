"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import HeaderBar from "components/layout/HeaderBar";
import EditorPanel from "components/editor/EditorPanel";
import PreviewPanel from "components/preview/PreviewPanel";
import { defaultClearanceData } from "lib/defaultClearanceData";
import { exportClearanceDocx } from "lib/exportDocx";
import { blobToDataUrl, dataUrlToBlob, getFileExtensionFromMime } from "lib/fileTransforms";
import { buildClearanceFileName } from "lib/printFileName";
import { createSupabaseBrowserClient } from "lib/supabase/client";
import styles from "./page.module.css";

const PRINT_RESOURCE_TIMEOUT_MS = 8000;
const IMAGE_FETCH_RETRY_COUNT = 2;
const IMAGE_FETCH_RETRY_DELAY_MS = 250;
const FRAME_SINGLE_IMAGE_TIMEOUT_MS = 5000;
const LEGACY_COURT_EMAIL = "rtc1iriocca@judiciary.gov.ph";
const DEFAULT_COURT_EMAIL = "rtc1iriocc@judiciary.gov.ph";

export default function EditorClientPage({ initialDocumentId }) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const bucketName = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "documents";

  const [formData, setFormData] = useState(defaultClearanceData);
  const [photoSrc, setPhotoSrc] = useState("");
  const [signatureSrc, setSignatureSrc] = useState("");
  const [photoPath, setPhotoPath] = useState("");
  const [signaturePath, setSignaturePath] = useState("");
  const [photoChanged, setPhotoChanged] = useState(false);
  const [signatureChanged, setSignatureChanged] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentDocumentId, setCurrentDocumentId] = useState(initialDocumentId || "");
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingPdfNoLogo, setIsExportingPdfNoLogo] = useState(false);
  const [renderedPreviewHtml, setRenderedPreviewHtml] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const normalizeCourtEmail = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    return text.toLowerCase() === LEGACY_COURT_EMAIL ? DEFAULT_COURT_EMAIL : text;
  };

  const resetToNewDocument = () => {
    setFormData(defaultClearanceData);
    setPhotoSrc("");
    setSignatureSrc("");
    setPhotoPath("");
    setSignaturePath("");
    setPhotoChanged(false);
    setSignatureChanged(false);
    setCurrentDocumentId("");
    setErrorMessage("");
    setStatusMessage("Ready for a new document.");
  };

  const loadStoredImage = async (path) => {
    if (!supabase) return "";
    if (!path) return "";

    const { data, error } = await supabase.storage.from(bucketName).download(path);

    if (error || !data) {
      return "";
    }

    return blobToDataUrl(data);
  };

  const loadDocument = async (documentId) => {
    if (!supabase) return;

    setIsLoadingDocument(true);
    setErrorMessage("");
    setStatusMessage("Loading document...");

    const { data, error } = await supabase
      .from("documents")
      .select("id, form_data, photo_path, signature_path")
      .eq("id", documentId)
      .single();

    if (error) {
      setIsLoadingDocument(false);
      setErrorMessage(error.message);
      setStatusMessage("");
      return;
    }

    const [loadedPhotoSrc, loadedSignatureSrc] = await Promise.all([
      loadStoredImage(data.photo_path),
      loadStoredImage(data.signature_path)
    ]);

    const nextFormData = { ...defaultClearanceData, ...(data.form_data || {}) };
    nextFormData.courtEmail = normalizeCourtEmail(nextFormData.courtEmail);

    setFormData(nextFormData);
    setPhotoPath(data.photo_path || "");
    setSignaturePath(data.signature_path || "");
    setPhotoSrc(loadedPhotoSrc);
    setSignatureSrc(loadedSignatureSrc);
    setPhotoChanged(false);
    setSignatureChanged(false);
    setCurrentDocumentId(documentId);
    setIsLoadingDocument(false);
    setStatusMessage("Loaded document from Supabase.");
  };

  useEffect(() => {
    setCurrentDocumentId(initialDocumentId || "");
  }, [initialDocumentId]);

  useEffect(() => {
    if (!supabase) return;

    const bootstrap = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setCurrentUserId(user.id);
    };

    bootstrap();
  }, [router, supabase]);

  useEffect(() => {
    if (!currentUserId) return;

    if (initialDocumentId) {
      loadDocument(initialDocumentId);
      return;
    }

    resetToNewDocument();
  }, [initialDocumentId, currentUserId]);

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
    setStatusMessage("Unsaved changes.");
  };

  const handlePhotoRemove = () => {
    setPhotoSrc("");
    setPhotoChanged(true);
    setStatusMessage("Unsaved changes.");
  };

  const handleSignatureRemove = () => {
    setSignatureSrc("");
    setSignatureChanged(true);
    setStatusMessage("Unsaved changes.");
  };

  const handlePhotoChange = (value) => {
    setPhotoSrc(value);
    setPhotoChanged(true);
    setStatusMessage("Unsaved changes.");
  };

  const handleSignatureChange = (value) => {
    setSignatureSrc(value);
    setSignatureChanged(true);
    setStatusMessage("Unsaved changes.");
  };

  const uploadImageFromDataUrl = async (dataUrl, userId, documentId, label) => {
    if (!supabase) {
      throw new Error("Supabase is not configured. Add your environment variables.");
    }

    const blob = await dataUrlToBlob(dataUrl);
    const extension = getFileExtensionFromMime(blob.type);
    const filePath = `${userId}/${documentId}/${label}-${Date.now()}.${extension}`;

    const { error } = await supabase.storage.from(bucketName).upload(filePath, blob, {
      contentType: blob.type,
      upsert: true
    });

    if (error) {
      throw error;
    }

    return filePath;
  };

  const removeStoragePath = async (path) => {
    if (!supabase) return;
    if (!path) return;
    await supabase.storage.from(bucketName).remove([path]);
  };

  const handleSaveDocument = async () => {
    if (!supabase) {
      setErrorMessage("Supabase is not configured. Add your environment variables.");
      return;
    }

    if (!currentUserId || isSaving || isLoadingDocument) return;

    setIsSaving(true);
    setErrorMessage("");
    setStatusMessage("Saving document...");

    const isNewDocumentFlow = !currentDocumentId;
    const editorDocumentId = currentDocumentId || crypto.randomUUID();

    try {
      let nextPhotoPath = photoPath;
      let nextSignaturePath = signaturePath;

      if (photoChanged) {
        if (photoSrc) {
          nextPhotoPath = await uploadImageFromDataUrl(
            photoSrc,
            currentUserId,
            editorDocumentId,
            "applicant-photo"
          );
        } else {
          nextPhotoPath = "";
        }

        if (photoPath && photoPath !== nextPhotoPath) {
          await removeStoragePath(photoPath);
        }
      }

      if (signatureChanged) {
        if (signatureSrc) {
          nextSignaturePath = await uploadImageFromDataUrl(
            signatureSrc,
            currentUserId,
            editorDocumentId,
            "digital-signature"
          );
        } else {
          nextSignaturePath = "";
        }

        if (signaturePath && signaturePath !== nextSignaturePath) {
          await removeStoragePath(signaturePath);
        }
      }

      const { error } = await supabase.from("documents").upsert(
        {
          id: editorDocumentId,
          owner_id: currentUserId,
          title: formData.fullName || "Untitled clearance",
          full_name: formData.fullName || null,
          purpose: formData.purpose || null,
          cert_no: formData.certNo || null,
          form_data: formData,
          photo_path: nextPhotoPath || null,
          signature_path: nextSignaturePath || null
        },
        { onConflict: "id" }
      );

      if (error) {
        throw error;
      }

      setPhotoPath(nextPhotoPath || "");
      setSignaturePath(nextSignaturePath || "");
      setPhotoChanged(false);
      setSignatureChanged(false);
      setCurrentDocumentId(editorDocumentId);
      setStatusMessage("Document saved to Supabase.");

      if (isNewDocumentFlow) {
        router.replace(`/editor?id=${editorDocumentId}`);
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to save document.");
      setStatusMessage("");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = async () => {
    if (isExportingPdf) return;

    setIsExportingPdf(true);
    setErrorMessage("");

    try {
      if (!renderedPreviewHtml) {
        throw new Error("Preview is still loading. Please try again.");
      }

      const fileName = buildClearanceFileName(formData);
      const printableHtml = await inlineStableAssetsForPrint(renderedPreviewHtml);
      const pdfBlob = await exportPdfViaServer(printableHtml, fileName);
      downloadPdfBlob(pdfBlob, fileName);
      setStatusMessage("PDF export complete.");
    } catch (error) {
      setErrorMessage(error?.message || "Failed to export PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportDocx = async () => {
    if (isExportingDocx) return;

    setIsExportingDocx(true);
    setErrorMessage("");

    try {
      const fileName = buildClearanceFileName(formData);
      await exportClearanceDocx(formData || {}, fileName, {
        photoSrc: photoSrc || "",
        signatureSrc: signatureSrc || "",
        logoLeftUrl: "/assets/supreme-court-seal-left.png",
        logoRightUrl: "/assets/regional-trial-court-seal-right.png"
      });
      setStatusMessage("DOCX exported.");
    } catch (error) {
      setErrorMessage(error?.message || "Failed to export DOCX.");
    } finally {
      setIsExportingDocx(false);
    }
  };

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const withTimeout = (promise, timeoutMs, timeoutLabel) =>
    Promise.race([
      promise,
      new Promise((_, reject) => {
        window.setTimeout(() => {
          reject(new Error(timeoutLabel));
        }, timeoutMs);
      })
    ]);

  const getAbsoluteAssetUrl = (src) => {
    try {
      return new URL(src, window.location.origin).toString();
    } catch {
      return "";
    }
  };

  const shouldInlineImageSource = (src) => {
    const value = String(src || "").trim();
    if (!value) return false;
    if (value.startsWith("data:")) return false;
    if (value.startsWith("blob:")) return false;

    const normalized = value.toLowerCase();
    if (normalized.startsWith("/assets/")) return true;
    if (normalized.startsWith("assets/")) return true;

    if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
      return normalized.startsWith(window.location.origin.toLowerCase());
    }

    return false;
  };

  const fetchAssetAsDataUrl = async (src) => {
    const absoluteUrl = getAbsoluteAssetUrl(src);
    if (!absoluteUrl) return "";

    for (let attempt = 0; attempt <= IMAGE_FETCH_RETRY_COUNT; attempt += 1) {
      try {
        const response = await fetch(absoluteUrl, { cache: "force-cache" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        return await blobToDataUrl(blob);
      } catch (error) {
        const isLastAttempt = attempt >= IMAGE_FETCH_RETRY_COUNT;
        if (isLastAttempt) {
          console.warn("[PDF export] Failed to inline image asset:", absoluteUrl, error);
          return "";
        }
        await sleep(IMAGE_FETCH_RETRY_DELAY_MS * (attempt + 1));
      }
    }

    return "";
  };

  const downloadPdfBlob = (blob, fileName) => {
    const safeBaseName =
      String(fileName || "RTC_CLEARANCE")
        .trim()
        .replace(/[\\/:*?"<>|]+/g, "_")
        .replace(/\s+/g, "_")
        .replace(/^_+|_+$/g, "") || "RTC_CLEARANCE";

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${safeBaseName}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  };

  const exportPdfViaServer = async (html, fileName) => {
    const response = await fetch(
      `/api/export-pdf?fileName=${encodeURIComponent(fileName || "RTC_CLEARANCE")}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "text/html;charset=utf-8"
        },
        body: html
      }
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "Server-side PDF export failed.");
    }

    return response.blob();
  };

  const inlineStableAssetsForPrint = async (rawHtml) => {
    if (!rawHtml) return "";

    const parser = new DOMParser();
    const documentForExport = parser.parseFromString(rawHtml, "text/html");
    const imageElements = Array.from(documentForExport.querySelectorAll("img[src]"));
    const cssUrlRegex = /url\((['"]?)([^'"\)]+)\1\)/g;
    const styleElements = Array.from(documentForExport.querySelectorAll("style"));

    const imageSources = imageElements
      .map((img) => String(img.getAttribute("src") || "").trim())
      .filter((src) => shouldInlineImageSource(src));

    const cssSources = [];
    for (const style of styleElements) {
      const cssText = String(style.textContent || "");
      if (!cssText.includes("url(")) continue;

      let match;
      while ((match = cssUrlRegex.exec(cssText)) !== null) {
        const source = String(match[2] || "").trim();
        if (shouldInlineImageSource(source)) {
          cssSources.push(source);
        }
      }
      cssUrlRegex.lastIndex = 0;
    }

    const uniqueSources = [...new Set([...imageSources, ...cssSources])];

    const sourceMap = new Map();

    await Promise.all(
      uniqueSources.map(async (src) => {
        const dataUrl = await fetchAssetAsDataUrl(src);
        if (dataUrl) {
          sourceMap.set(src, dataUrl);
          sourceMap.set(getAbsoluteAssetUrl(src), dataUrl);
        }
      })
    );

    for (const img of imageElements) {
      const src = String(img.getAttribute("src") || "").trim();
      const absoluteSrc = getAbsoluteAssetUrl(src);
      const inlined = sourceMap.get(src) || sourceMap.get(absoluteSrc);
      if (inlined) {
        img.setAttribute("src", inlined);
      } else if (shouldInlineImageSource(src)) {
        console.warn("[PDF export] Image not inlined; keeping original source:", src);
      }
    }

    for (const style of styleElements) {
      const cssText = String(style.textContent || "");
      if (!cssText.includes("url(")) continue;

      let nextCssText = cssText;
      let match;
      while ((match = cssUrlRegex.exec(cssText)) !== null) {
        const originalRef = String(match[2] || "").trim();
        if (!shouldInlineImageSource(originalRef)) continue;
        const absoluteRef = getAbsoluteAssetUrl(originalRef);
        const inlined = sourceMap.get(originalRef) || sourceMap.get(absoluteRef);
        if (inlined) {
          nextCssText = nextCssText.replace(match[0], `url('${inlined}')`);
        } else {
          console.warn("[PDF export] CSS image not inlined; keeping original source:", originalRef);
        }
      }

      style.textContent = nextCssText;
      cssUrlRegex.lastIndex = 0;
    }

    return documentForExport.documentElement.outerHTML;
  };

  const buildNoAssetsPrintHtml = (rawHtml) => {
    if (!rawHtml) return "";

    const parser = new DOMParser();
    const documentForExport = parser.parseFromString(rawHtml, "text/html");

    // Remove only official logo assets; keep applicant photo/signature images intact.
    const logoImages = Array.from(documentForExport.querySelectorAll(
      "img.rtc-header-logo, img[src*='supreme-court-seal-left'], img[src*='regional-trial-court-seal-right'], img[src*='supreme-court-seal.png']"
    ));

    for (const img of logoImages) {
      img.remove();
    }

    const styleElements = Array.from(documentForExport.querySelectorAll("style"));
    for (const style of styleElements) {
      const cssText = String(style.textContent || "");
      const withoutWatermark = cssText.replace(
        /body\.doc-content::before\s*\{[\s\S]*?\}/g,
        `body.doc-content::before {
    content: none !important;
    display: none !important;
    background: none !important;
  }`
      );
      style.textContent = withoutWatermark;
    }

    return documentForExport.documentElement.outerHTML;
  };

  const waitForFrameImages = async (frameDocument) => {
    const images = Array.from(frameDocument.images || []);
    if (!images.length) return;

    await Promise.all(
      images.map(async (img) => {
        const source = String(img.currentSrc || img.src || "").trim();
        if (!source || source === "about:blank") {
          return;
        }

        if (img.complete) {
          if (img.naturalWidth === 0) {
            console.warn("[PDF export] Image failed to decode in print frame:", source);
          }
          return;
        }

        try {
          if (typeof img.decode === "function") {
            await withTimeout(
              img.decode(),
              FRAME_SINGLE_IMAGE_TIMEOUT_MS,
              "Timed out waiting for image decode."
            );
            if (img.naturalWidth > 0) return;
          }
        } catch {
          // Fall through to load/error listener path.
        }

        await withTimeout(
          new Promise((resolve) => {
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          }),
          FRAME_SINGLE_IMAGE_TIMEOUT_MS,
          "Timed out waiting for image load event."
        ).catch(() => {
          // Per-image timeout is non-fatal; final check below logs actual state.
        });

        if (img.naturalWidth === 0) {
          console.warn("[PDF export] Image failed to decode in print frame:", source);
        }
      })
    );
  };

  const waitForFrameReady = async (frameDocument) => {
    if (frameDocument?.fonts?.ready) {
      try {
        await withTimeout(
          frameDocument.fonts.ready,
          PRINT_RESOURCE_TIMEOUT_MS,
          "Timed out waiting for print fonts."
        );
      } catch (error) {
        console.warn("[PDF export] Font readiness warning:", error);
      }
    }

    await withTimeout(
      waitForFrameImages(frameDocument),
      PRINT_RESOURCE_TIMEOUT_MS,
      "Timed out waiting for print images."
    ).catch((error) => {
      console.warn("[PDF export] Image readiness warning:", error);
    });
  };

  const printHtmlDocument = async (html, title) => {
    const previousTitle = document.title;
    let restored = false;

    const restoreTitle = () => {
      if (restored) return;
      restored = true;
      document.title = previousTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };

    document.title = title;
    window.addEventListener("afterprint", restoreTitle);

    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.right = "-10000px";
    frame.style.bottom = "-10000px";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";

    document.body.appendChild(frame);

    const frameWindow = frame.contentWindow;
    const frameDocument = frame.contentDocument || frameWindow?.document;
    if (!frameWindow || !frameDocument) {
      document.body.removeChild(frame);
      restoreTitle();
      throw new Error("Unable to open print frame.");
    }

    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();

    const cleanup = () => {
      window.setTimeout(() => {
        if (document.body.contains(frame)) {
          document.body.removeChild(frame);
        }
        restoreTitle();
      }, 500);
    };

    const triggerPrint = () => {
      frameDocument.title = title;
      frameWindow.focus();
      frameWindow.print();
      cleanup();
    };

    frameWindow.addEventListener("afterprint", cleanup, { once: true });
    await waitForFrameReady(frameDocument);
    triggerPrint();

    window.setTimeout(restoreTitle, 1500);
  };

  const handleExportPdfNoLogo = async () => {
    if (isExportingPdfNoLogo) return;

    setIsExportingPdfNoLogo(true);
    setErrorMessage("");

    try {
      if (!renderedPreviewHtml) {
        throw new Error("Preview is still loading. Please try again.");
      }

      const fileName = buildClearanceFileName(formData);
      const printableHtml = buildNoAssetsPrintHtml(renderedPreviewHtml);
      await printHtmlDocument(printableHtml, fileName);
      setStatusMessage("PDF export without logo/watermark started.");
    } catch (error) {
      setErrorMessage(error?.message || "Failed to export PDF.");
    } finally {
      setIsExportingPdfNoLogo(false);
    }
  };

  return (
    <main className="app-shell">
      <HeaderBar
        onPrint={handlePrint}
        isExportingPdf={isExportingPdf}
        onSave={handleSaveDocument}
        isSaving={isSaving}
        onExportDocx={handleExportDocx}
        isExportingDocx={isExportingDocx}
        hideExportDocx
        onExportPdfNoLogo={handleExportPdfNoLogo}
        isExportingPdfNoLogo={isExportingPdfNoLogo}
      />
      <div className={`${styles.statusBar} noPrint`}>
        {isLoadingDocument ? <span>Loading document...</span> : <span>{statusMessage}</span>}
        {errorMessage && <span className={styles.errorText}>{errorMessage}</span>}
      </div>
      <div className={styles.workspace}>
        <EditorPanel
          formData={formData}
          onFieldChange={handleFieldChange}
          photoSrc={photoSrc}
          onPhotoChange={handlePhotoChange}
          onPhotoRemove={handlePhotoRemove}
          signatureSrc={signatureSrc}
          onSignatureChange={handleSignatureChange}
          onSignatureRemove={handleSignatureRemove}
        />
        <PreviewPanel
          formData={formData}
          photoSrc={photoSrc}
          signatureSrc={signatureSrc}
          onRenderedTemplateChange={setRenderedPreviewHtml}
        />
      </div>
    </main>
  );
}
