"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import HeaderBar from "components/layout/HeaderBar";
import EditorPanel from "components/editor/EditorPanel";
import PreviewPanel from "components/preview/PreviewPanel";
import { defaultClearanceData } from "lib/defaultClearanceData";
import { blobToDataUrl, dataUrlToBlob, getFileExtensionFromMime } from "lib/fileTransforms";
import { buildClearanceFileName } from "lib/printFileName";
import { createSupabaseBrowserClient } from "lib/supabase/client";
import styles from "./page.module.css";

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
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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

    setFormData({ ...defaultClearanceData, ...(data.form_data || {}) });
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

  const handlePrint = () => {
    const previousTitle = document.title;
    const nextTitle = buildClearanceFileName(formData);
    let restored = false;

    const restoreTitle = () => {
      if (restored) return;
      restored = true;
      document.title = previousTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };

    document.title = nextTitle;
    window.addEventListener("afterprint", restoreTitle);
    window.print();

    window.setTimeout(restoreTitle, 1500);
  };

  return (
    <main className="app-shell">
      <HeaderBar onPrint={handlePrint} onSave={handleSaveDocument} isSaving={isSaving} />
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
        <PreviewPanel formData={formData} photoSrc={photoSrc} signatureSrc={signatureSrc} />
      </div>
    </main>
  );
}
