"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMock } from "../../lib/mockStore";
import { buildActualDocumentHtml } from "../../lib/documentHtmlBuilder";
import { defaultClearanceData } from "../../lib/defaultClearanceData";
import EditorPanel from "../editor/EditorPanel";
import PreviewPanel from "../preview/PreviewPanel";
import { decodeQrFromImageData, decodeQrFromImageFile } from "../../lib/qrScannerHelper";
import { formatEnglishDate } from "../../lib/formatters";

export default function StaffPortal({ headerSearchQuery = "", onLogout }) {
  const router = useRouter();
  const { documents, markAsPrinted, createStaffDocument, updateDocument, deleteDocument, lookupDocument, nextCertNo, updateNextCertNo } = useMock();

  // Active sidebar navigation pill
  const [activeNav, setActiveNav] = useState("dashboard"); // 'dashboard' | 'queue' | 'registry' | 'scanner' | 'create' | 'settings'
  const [mobileEditorTab, setMobileEditorTab] = useState("form"); // 'form' | 'preview'
  // Dashboard filter state
  const [statusFilter, setStatusFilter] = useState("all");

  // Queue tab filter state
  const [queueSearchTerm, setQueueSearchTerm] = useState("");
  const [queueStatusFilter, setQueueStatusFilter] = useState("all");

  // Registry tab filter state
  const [registrySearchTerm, setRegistrySearchTerm] = useState("");
  const [registryStatusFilter, setRegistryStatusFilter] = useState("all");
  
  // Organization settings local state
  const [certNoInput, setCertNoInput] = useState(String(nextCertNo || 1));
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);

  useEffect(() => {
    setCertNoInput(String(nextCertNo || 1));
  }, [nextCertNo]);

  const handleSaveOrgSettings = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    updateNextCertNo(certNoInput);
    setSettingsSavedToast(true);
    setTimeout(() => setSettingsSavedToast(false), 4000);
  };
  
  // Inspected/edited document
  const [inspectedDoc, setInspectedDoc] = useState(null);

  // Deletion modal state (high-friction double-confirm)
  const [docToDelete, setDocToDelete] = useState(null);
  const [deleteConfirmNameInput, setDeleteConfirmNameInput] = useState("");

  // Scanner state
  const [scannerInput, setScannerInput] = useState("");
  const [scannedDocMatch, setScannedDocMatch] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("");
  const [scannedToast, setScannedToast] = useState(null);
  const videoRef = useRef(null);
  // Form State (matches original EditorPanel)
  const [formData, setFormData] = useState(defaultClearanceData);
  const [photoSrc, setPhotoSrc] = useState("");
  const [signatureSrc, setSignatureSrc] = useState("");

  const handlePerformLogout = async () => {
    if (onLogout) {
      await onLogout();
    } else {
      router.push("/login");
    }
  };

  const handleConfirmDelete = () => {
    if (!docToDelete) return;
    const isMatch = deleteConfirmNameInput.trim().toUpperCase() === docToDelete.fullName.trim().toUpperCase();
    if (!isMatch) return;

    deleteDocument(docToDelete.id);
    if (inspectedDoc && inspectedDoc.id === docToDelete.id) {
      setInspectedDoc(null);
      setActiveNav("queue");
    }
    setDocToDelete(null);
    setDeleteConfirmNameInput("");
  };

  const effectiveQueueSearch = headerSearchQuery || queueSearchTerm;

  // Statistics
  const totalCount = documents.length;
  const pendingCount = documents.filter((d) => d.status.includes("Pending")).length;
  const releasedCount = documents.filter((d) => d.status.includes("Released") || d.status.includes("Printed")).length;
  const totalRevenue = documents.length * 150;

  // Priority Sort & Deduplicate: Surface pending items at top with unique keys
  const uniqueDocsMap = new Map();
  documents.forEach((doc) => {
    if (doc && doc.id) {
      uniqueDocsMap.set(doc.id, doc);
    }
  });

  const sortedDocs = Array.from(uniqueDocsMap.values()).sort((a, b) => {
    const aIsPending = (a.status || "").includes("Pending") ? 0 : 1;
    const bIsPending = (b.status || "").includes("Pending") ? 0 : 1;
    return aIsPending - bIsPending;
  });

  // Flexible search matcher supporting numeric normalization (e.g. DOC-012, 012, 12)
  const matchesDocumentSearch = (doc, query) => {
    if (!doc || !query) return true;
    const q = query.trim().toLowerCase();
    if (!q) return true;

    const matchName = doc.fullName && doc.fullName.toLowerCase().includes(q);
    const matchId = doc.id && doc.id.toLowerCase().includes(q);
    const matchCertNo = doc.certNo && String(doc.certNo).toLowerCase().includes(q);
    const matchPayment = doc.paymentNo && doc.paymentNo.toLowerCase().includes(q);
    const matchOr = (doc.orNumber || doc.orNo) && String(doc.orNumber || doc.orNo).toLowerCase().includes(q);
    const matchPurpose = doc.purpose && doc.purpose.toLowerCase().includes(q);
    const matchType = doc.documentType && doc.documentType.toLowerCase().includes(q);

    if (matchName || matchId || matchCertNo || matchPayment || matchOr || matchPurpose || matchType) {
      return true;
    }

    const qDigits = q.replace(/\D/g, "");
    if (qDigits) {
      const qNum = parseInt(qDigits, 10);
      if (!isNaN(qNum)) {
        const idDigits = (doc.id || "").replace(/\D/g, "");
        const certDigits = String(doc.certNo || "").replace(/\D/g, "");
        const paymentDigits = (doc.paymentNo || "").replace(/\D/g, "");
        const orDigits = String(doc.orNumber || doc.orNo || "").replace(/\D/g, "");

        if (idDigits && parseInt(idDigits, 10) === qNum) return true;
        if (certDigits && parseInt(certDigits, 10) === qNum) return true;
        if (paymentDigits && parseInt(paymentDigits, 10) === qNum) return true;
        if (orDigits && parseInt(orDigits, 10) === qNum) return true;
      }
    }

    return false;
  };

  // Filter Dashboard live queue documents
  const filteredDocs = sortedDocs.filter((doc) => {
    const matchesSearch = matchesDocumentSearch(doc, effectiveQueueSearch);

    if (statusFilter === "pending") return matchesSearch && doc.status.includes("Pending");
    if (statusFilter === "released") return matchesSearch && (doc.status.includes("Released") || doc.status.includes("Printed"));
    return matchesSearch;
  });

  // Filter Queue tab documents
  const filteredQueueDocs = sortedDocs.filter((doc) => {
    const matchesSearch = matchesDocumentSearch(doc, effectiveQueueSearch);

    if (queueStatusFilter === "pending") return matchesSearch && doc.status.includes("Pending");
    if (queueStatusFilter === "released") return matchesSearch && (doc.status.includes("Released") || doc.status.includes("Printed"));
    return matchesSearch;
  });

  // Filter Registry tab documents (independent filter & search)
  const filteredRegistryDocs = sortedDocs.filter((doc) => {
    const matchesSearch = matchesDocumentSearch(doc, registrySearchTerm);

    if (registryStatusFilter === "pending") return matchesSearch && doc.status.includes("Pending");
    if (registryStatusFilter === "released") return matchesSearch && (doc.status.includes("Released") || doc.status.includes("Printed"));
    return matchesSearch;
  });

  // Pagination State (10 items per page)
  const [queuePage, setQueuePage] = useState(1);
  const [registryPage, setRegistryPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setQueuePage(1);
  }, [effectiveQueueSearch, queueStatusFilter]);

  useEffect(() => {
    setRegistryPage(1);
  }, [registrySearchTerm, registryStatusFilter]);

  const totalQueuePages = Math.ceil(filteredQueueDocs.length / ITEMS_PER_PAGE) || 1;
  const safeQueuePage = Math.min(queuePage, totalQueuePages);
  const paginatedQueueDocs = filteredQueueDocs.slice((safeQueuePage - 1) * ITEMS_PER_PAGE, safeQueuePage * ITEMS_PER_PAGE);

  const totalRegistryPages = Math.ceil(filteredRegistryDocs.length / ITEMS_PER_PAGE) || 1;
  const safeRegistryPage = Math.min(registryPage, totalRegistryPages);
  const paginatedRegistryDocs = filteredRegistryDocs.slice((safeRegistryPage - 1) * ITEMS_PER_PAGE, safeRegistryPage * ITEMS_PER_PAGE);

  // Handle original editor field updates
  const handleFieldChange = (fieldId, value) => {
    setFormData((prev) => ({
      ...prev,
      [fieldId]: value
    }));
  };

  // Open existing document in split view
  const handleOpenDocumentSplitView = (doc) => {
    setInspectedDoc(doc);
    const docDate = doc?.dateRequested ? new Date(doc.dateRequested) : new Date();
    const validDate = isNaN(docDate.getTime()) ? new Date() : docDate;
    const formattedDate = formatEnglishDate(validDate);

    setFormData({
      ...defaultClearanceData,
      fullName: doc.fullName || "",
      dob: doc.birthDate || doc.dob || "",
      birthPlace: doc.birthPlace || "",
      gender: doc.gender || "Male",
      nationality: doc.citizenship || doc.nationality || "Filipino",
      contactNo: doc.contactNo || "",
      address: doc.address || "",
      purpose: (doc.purpose || "LOCAL EMPLOYMENT").toUpperCase(),
      civilStatus: doc.civilStatus || "Single",
      orNo: doc.orNumber || doc.paymentNo || "PAY-2026-8921",
      ctc: doc.ctcNumber || doc.ctc || defaultClearanceData.ctc,
      issuedOn: formattedDate,
      orDate: formattedDate,
      stampDate: formattedDate,
      givenDay: validDate.getDate().toString(),
      givenMonth: validDate.toLocaleDateString("en-US", { month: "long" }),
      givenYear: validDate.getFullYear().toString(),
      givenPlace: "Iriga City, Camarines Sur",
      certNo: doc.certNo || (doc.id ? doc.id.replace(/^DOC-/, "") : String(nextCertNo || 1)),
      finding: doc.finding || defaultClearanceData.finding || "NO DEROGATORY RECORD FOUND",
    });
    setPhotoSrc(doc.photoSrc || "");
    setActiveNav("create");
  };

  // Reset form and open blank split view
  const handleOpenBlankSplitView = () => {
    setInspectedDoc(null);
    const today = new Date();
    const formattedToday = formatEnglishDate(today);

    setFormData({
      ...defaultClearanceData,
      issuedOn: formattedToday,
      orDate: formattedToday,
      stampDate: formattedToday,
      givenDay: today.getDate().toString(),
      givenMonth: today.toLocaleDateString("en-US", { month: "long" }),
      givenYear: today.getFullYear().toString(),
      givenPlace: "Iriga City, Camarines Sur",
      certNo: String(nextCertNo || 1),
    });
    setPhotoSrc("");
    setSignatureSrc("");
    setActiveNav("create");
  };

  // Handle direct staff issuance from editor
  const handleCreateDirectDoc = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formData.fullName) {
      alert("Please enter the Applicant's Full Name.");
      return;
    }

    const currentPhoto = photoSrc || inspectedDoc?.photoSrc || "";

    let targetDoc;
    if (inspectedDoc && inspectedDoc.id) {
      // Update existing document status to "Printed & Released" and preserve photoSrc
      targetDoc = {
        ...inspectedDoc,
        ...formData,
        status: "Printed & Released",
        photoSrc: currentPhoto
      };
      updateDocument(inspectedDoc.id, targetDoc);
      setInspectedDoc(targetDoc);
    } else {
      // Create new direct staff document
      targetDoc = createStaffDocument({
        ...formData,
        fullName: formData.fullName.toUpperCase(),
        address: formData.address || "",
        purpose: (formData.purpose || "LOCAL EMPLOYMENT").toUpperCase(),
        civilStatus: formData.civilStatus || "Single",
        ctcNumber: formData.ctc,
        orNumber: formData.orNo,
        amountPaid: "₱150.00",
        photoSrc: currentPhoto
      });
      setInspectedDoc(targetDoc);
    }

    // Print with full complete formData & photo
    handlePrintActualDocument({
      ...formData,
      ...targetDoc,
      photoSrc: currentPhoto
    });
  };

  // Handle scanned string payload
  const handleProcessScannedText = (text) => {
    if (!text) return;
    let refId = text.trim();
    let parsedObj = null;
    try {
      parsedObj = JSON.parse(text);
      if (parsedObj && (parsedObj.id || parsedObj.refId)) {
        refId = parsedObj.id || parsedObj.refId;
      }
    } catch (err) {}

    setScannerInput(refId);
    let match = lookupDocument(refId);
    if (!match && parsedObj && (parsedObj.fullName || parsedObj.name)) {
      match = {
        id: parsedObj.id || `DOC-${Math.floor(1000 + Math.random() * 9000)}`,
        fullName: (parsedObj.fullName || parsedObj.name || "").toUpperCase(),
        address: parsedObj.address || "",
        purpose: (parsedObj.purpose || "LOCAL EMPLOYMENT").toUpperCase(),
        civilStatus: parsedObj.civilStatus || "Single",
        citizenship: parsedObj.citizenship || parsedObj.nationality || "Filipino",
        birthDate: parsedObj.birthDate || parsedObj.dob || "",
        gender: parsedObj.gender || "Male",
        contactNo: parsedObj.contactNo || "",
        orNumber: parsedObj.orNumber || parsedObj.paymentNo || "PAY-2026-8921",
        ctcNumber: parsedObj.ctcNumber || parsedObj.ctc || "CTC-2026-0012",
        status: "Pending Printing",
        photoSrc: parsedObj.photoSrc || ""
      };
    }

    if (match) {
      setScannedDocMatch(match);
      setCameraStatus(`Match verified: ${match.id}`);
      setScannedToast(`QR Code Scanned! Auto-loaded file created for ${match.fullName} (${match.id}).`);
      setTimeout(() => setScannedToast(null), 6000);
      handleOpenDocumentSplitView(match);
    } else {
      setScannedDocMatch(null);
      setCameraStatus(`Scanned code "${refId}" — no matching record found.`);
    }
  };

  // Camera stream loop
  useEffect(() => {
    let stream = null;
    let animId = null;

    if (activeNav === "scanner" && isCameraActive) {
      setCameraStatus("Accessing camera...");
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
          setCameraStatus("Camera active. Align QR pass...");

          const scanCanvas = document.createElement("canvas");
          const scanCtx = scanCanvas.getContext("2d");

          const tick = () => {
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              scanCanvas.width = videoRef.current.videoWidth;
              scanCanvas.height = videoRef.current.videoHeight;
              scanCtx.drawImage(videoRef.current, 0, 0, scanCanvas.width, scanCanvas.height);
              const imageData = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
              const decoded = decodeQrFromImageData(imageData);
              if (decoded) {
                handleProcessScannedText(decoded);
                setIsCameraActive(false);
                return;
              }
            }
            animId = requestAnimationFrame(tick);
          };
          animId = requestAnimationFrame(tick);
        })
        .catch((err) => {
          console.warn("Camera error:", err);
          setCameraStatus("Camera access denied or unavailable. Use file upload or manual input below.");
          setIsCameraActive(false);
        });
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [activeNav, isCameraActive]);

  const handleQrFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraStatus("Analyzing uploaded QR image...");
    const decoded = await decodeQrFromImageFile(file);
    if (decoded) {
      handleProcessScannedText(decoded);
    } else {
      setCameraStatus("No QR code detected in uploaded image.");
      alert("Could not detect a valid QR Code in the uploaded image.");
    }
  };

  // Handle scanner manual search
  const handleScannerSearch = (query) => {
    const term = (query || scannerInput).trim();
    if (!term) return;
    handleProcessScannedText(term);
  };

  // Print actual official clearance document
  const handlePrintActualDocument = async (doc) => {
    try {
      const mergedDocData = {
        ...defaultClearanceData,
        ...formData,
        ...doc,
        fullName: doc?.fullName || formData.fullName,
        address: doc?.address || formData.address,
        purpose: doc?.purpose || formData.purpose,
        civilStatus: doc?.civilStatus || formData.civilStatus || "Single",
        nationality: doc?.nationality || doc?.citizenship || formData.nationality || "Filipino",
        dob: doc?.dob || doc?.birthDate || formData.dob,
        birthPlace: doc?.birthPlace || formData.birthPlace,
        gender: doc?.gender || formData.gender,
        contactNo: doc?.contactNo || formData.contactNo,
        orNo: doc?.orNo || doc?.orNumber || doc?.paymentNo || formData.orNo || "OR-ONLINE",
        orDate: doc?.orDate || formatEnglishDate(doc?.dateRequested) || formData.orDate || formatEnglishDate(new Date()),
        stampDate: doc?.stampDate || formatEnglishDate(doc?.dateRequested) || formData.stampDate || formatEnglishDate(new Date()),
        ctc: doc?.ctc || doc?.ctcNumber || formData.ctc,
        issuedAt: doc?.issuedAt || formData.issuedAt || "Iriga City",
        issuedOn: doc?.issuedOn || formatEnglishDate(doc?.dateRequested) || formData.issuedOn || formatEnglishDate(new Date()),
        certNo: doc?.certNo || formData.certNo || (doc?.id ? doc.id.replace(/^DOC-/, "") : String(nextCertNo || 1)),
        finding: doc?.finding || formData.finding || "NO DEROGATORY RECORD FOUND",
        givenDay: doc?.givenDay || formData.givenDay || new Date().getDate().toString(),
        givenMonth: doc?.givenMonth || formData.givenMonth || new Date().toLocaleDateString("en-US", { month: "long" }),
        givenYear: doc?.givenYear || formData.givenYear || new Date().getFullYear().toString(),
        givenPlace: doc?.givenPlace || formData.givenPlace || "Iriga City, Camarines Sur",
        noteText: doc?.noteText || formData.noteText || "Valid for 6 months from the date of issue.",
        noteInitials: doc?.noteInitials || formData.noteInitials || "MBL/jnr",
        clerkName: doc?.clerkName || formData.clerkName,
        clerkTitle1: doc?.clerkTitle1 || formData.clerkTitle1,
        clerkTitle2: doc?.clerkTitle2 || formData.clerkTitle2,
        assistantClerkName: doc?.assistantClerkName || formData.assistantClerkName,
        assistantClerkTitle: doc?.assistantClerkTitle || formData.assistantClerkTitle,
        courtName: doc?.courtName || formData.courtName,
        judicialRegion: doc?.judicialRegion || formData.judicialRegion,
        courtCity: doc?.courtCity || formData.courtCity,
        courtEmail: doc?.courtEmail || formData.courtEmail,
        courtTel: doc?.courtTel || formData.courtTel,
      };

      const fullHtml = await buildActualDocumentHtml(mergedDocData, photoSrc || doc?.photoSrc);

      let iframe = document.getElementById("staff-print-iframe");
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "staff-print-iframe";
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        iframe.style.visibility = "hidden";
        document.body.appendChild(iframe);
      }

      const docObj = iframe.contentWindow.document;
      docObj.open();
      docObj.write(fullHtml);
      docObj.close();

      const imageElements = Array.from(docObj.querySelectorAll("img"));
      await Promise.all(
        imageElements.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
            if (typeof img.decode === "function") {
              img.decode().then(resolve).catch(resolve);
            }
            setTimeout(resolve, 1000);
          });
        })
      );

      // Wait for font assets to finish decoding to prevent gibberish text in print spooler
      if (docObj.fonts && docObj.fonts.ready) {
        try {
          await docObj.fonts.ready;
        } catch (fErr) {}
      }

      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        if (doc.id) markAsPrinted(doc.id);
      }, 300);
    } catch (err) {
      console.error("Staff print failed", err);
      alert("Failed to build print document frame.");
    }
  };

  return (
    <div className="staff-layout-container" style={{ display: "flex", minHeight: "calc(100vh - 52px)", backgroundColor: "#F3F4F6" }}>
      {/* SIDEBAR NAVIGATION (Pinned to Visible Viewport Bottom) */}
      <aside className="staff-sidebar-aside" style={{
        width: "250px",
        height: "calc(100vh - 52px)",
        position: "sticky",
        top: "52px",
        backgroundColor: "#FFFFFF",
        borderRight: "1px solid #E4E4E7",
        padding: "20px 16px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        flexShrink: 0,
        boxSizing: "border-box"
      }}>
        <div style={{ overflowY: "auto", flex: 1, paddingBottom: "12px" }}>
          <nav className="staff-sidebar-nav" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {/* 1. Dashboard */}
            <button
              onClick={() => setActiveNav("dashboard")}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "11px 16px",
                borderRadius: "9999px",
                border: "none",
                backgroundColor: activeNav === "dashboard" ? "#F4F4F5" : "transparent",
                color: activeNav === "dashboard" ? "#09090B" : "#52525B",
                fontWeight: activeNav === "dashboard" ? 800 : 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease"
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              Dashboard
            </button>

            {/* 2. Live Counter Queue */}
            <button
              onClick={() => setActiveNav("queue")}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "11px 16px",
                borderRadius: "9999px",
                border: "none",
                backgroundColor: activeNav === "queue" ? "#F4F4F5" : "transparent",
                color: activeNav === "queue" ? "#09090B" : "#52525B",
                fontWeight: activeNav === "queue" ? 800 : 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 8v4l3 3"/>
                  <circle cx="12" cy="12" r="9"/>
                </svg>
                Live Queue
              </div>
              {pendingCount > 0 && (
                <span style={{
                  backgroundColor: "#FEF3C7",
                  color: "#D97706",
                  fontSize: "0.725rem",
                  fontWeight: 900,
                  padding: "2px 8px",
                  borderRadius: "9999px"
                }}>
                  {pendingCount}
                </span>
              )}
            </button>

            {/* 3. Clearance Registry */}
            <button
              onClick={() => setActiveNav("registry")}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "11px 16px",
                borderRadius: "9999px",
                border: "none",
                backgroundColor: activeNav === "registry" ? "#F4F4F5" : "transparent",
                color: activeNav === "registry" ? "#09090B" : "#52525B",
                fontWeight: activeNav === "registry" ? 800 : 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease"
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Clearance Registry
            </button>

            {/* 4. Quick QR Scanner */}
            <button
              onClick={() => setActiveNav("scanner")}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "11px 16px",
                borderRadius: "9999px",
                border: "none",
                backgroundColor: activeNav === "scanner" ? "#F4F4F5" : "transparent",
                color: activeNav === "scanner" ? "#09090B" : "#52525B",
                fontWeight: activeNav === "scanner" ? 800 : 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease"
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="7" y="7" width="10" height="10" rx="1"/>
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
              </svg>
              Quick QR Scanner
            </button>

            {/* 5. Clearance Document Pill */}
            <button
              onClick={handleOpenBlankSplitView}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "11px 16px",
                borderRadius: "9999px",
                border: "none",
                backgroundColor: activeNav === "create" ? "#F4F4F5" : "transparent",
                color: activeNav === "create" ? "#09090B" : "#52525B",
                fontWeight: activeNav === "create" ? 800 : 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease"
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Clearance Document
            </button>

            {/* 6. Organization Settings */}
            <button
              onClick={() => setActiveNav("settings")}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "11px 16px",
                borderRadius: "9999px",
                border: "none",
                backgroundColor: activeNav === "settings" ? "#F4F4F5" : "transparent",
                color: activeNav === "settings" ? "#09090B" : "#52525B",
                fontWeight: activeNav === "settings" ? 800 : 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease"
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Organization Settings
            </button>
          </nav>
        </div>

        {/* BOTTOM SIDEBAR USER PROFILE CARD */}
        <div className="staff-sidebar-user-block" style={{
          backgroundColor: "#FAF9F6",
          padding: "12px 14px",
          borderRadius: "14px",
          border: "1px solid #E4E4E7",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              backgroundColor: "#FEF3C7",
              color: "#D97706",
              border: "1px solid #FDE68A",
              fontWeight: 800,
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              I
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "#09090B" }}>Iriga Staff</span>
              <span style={{ fontSize: "0.7rem", color: "#71717A" }}>staff@rtc.gov.ph</span>
            </div>
          </div>
          <button
            type="button"
            title="Log out of Staff Terminal"
            onClick={handlePerformLogout}
            style={{
              background: "none",
              border: "none",
              padding: "6px",
              borderRadius: "8px",
              cursor: "pointer",
              color: "#71717A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease"
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* MAIN WORKSPACE PANEL */}
      <main className="staff-main-panel" style={{ flex: 1, padding: "28px 36px", overflowY: "auto" }}>

        {/* 1. DASHBOARD OVERVIEW */}
        {activeNav === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* ACTION & STATUS HEADER (Desktop Only - Hidden on Mobile to save space) */}
            <div className="staff-desktop-only" style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "20px",
              border: "1px solid #E4E4E7",
              padding: "24px 28px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02)"
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10B981" }}></span>
                  <span style={{ fontSize: "0.75rem", fontWeight: "800", color: "#71717A", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    RTC COUNTER 03 • TERMINAL ACTIVE
                  </span>
                </div>
                <h1 style={{ fontSize: "1.5rem", fontWeight: "800", color: "#09090B", letterSpacing: "-0.02em", margin: 0 }}>
                  Counter Workstation Queue
                </h1>
                <p style={{ fontSize: "0.875rem", color: "#71717A", margin: "2px 0 0" }}>
                  Clerk: <strong>Iriga Staff</strong> • Live Regional Trial Court Records
                </p>
              </div>

              {/* ACTION BUTTONS: Clear Priority Order */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                {/* PRIMARY ACTION: Scan QR Pass (Solid Black Button - Main Workflow) */}
                <button
                  onClick={() => setActiveNav("scanner")}
                  style={{
                    padding: "12px 24px",
                    backgroundColor: "#09090B",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "9999px",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 14px rgba(9, 9, 11, 0.18)",
                    transition: "transform 0.1s ease"
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="7" y="7" width="10" height="10" rx="1"/>
                    <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                    <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                  </svg>
                  Scan QR Pass
                </button>

                {/* SECONDARY ACTION: View Queue */}
                <button
                  onClick={() => setActiveNav("queue")}
                  style={{
                    padding: "12px 22px",
                    backgroundColor: "#FFFFFF",
                    color: "#09090B",
                    border: "1px solid #D4D4D8",
                    borderRadius: "9999px",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px"
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6"/>
                    <line x1="8" y1="12" x2="21" y2="12"/>
                  </svg>
                  View Queue
                  <span style={{
                    backgroundColor: "#FEF3C7",
                    color: "#D97706",
                    fontSize: "0.725rem",
                    fontWeight: 900,
                    padding: "2px 8px",
                    borderRadius: "9999px"
                  }}>
                    {pendingCount}
                  </span>
                </button>

                {/* UTILITY ACTION: Clearance Document */}
                <button
                  onClick={handleOpenBlankSplitView}
                  style={{
                    padding: "12px 20px",
                    backgroundColor: "#FFFFFF",
                    color: "#52525B",
                    border: "1px solid #E4E4E7",
                    borderRadius: "9999px",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  New Clearance Document
                </button>
              </div>
            </div>

            {/* MOBILE MICRO-STATS STRIP (60px Total Height) */}
            <div className="staff-micro-stats staff-mobile-only">
              <div className="staff-micro-stat-card">
                <span className="staff-micro-stat-num" style={{ color: "#D97706" }}>{pendingCount}</span>
                <span className="staff-micro-stat-label">Pending</span>
              </div>
              <div className="staff-micro-stat-card">
                <span className="staff-micro-stat-num" style={{ color: "#059669" }}>{releasedCount}</span>
                <span className="staff-micro-stat-label">Released</span>
              </div>
              <div className="staff-micro-stat-card">
                <span className="staff-micro-stat-num" style={{ color: "#09090B" }}>{totalCount}</span>
                <span className="staff-micro-stat-label">Total Vol</span>
              </div>
            </div>

            {/* DESKTOP REAL-TIME COUNTER STAT CARDS GRID */}
            <div className="staff-desktop-only" style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px"
            }}>
              {/* Stat 1: Pending Action */}
              <div style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "16px",
                border: "1px solid #E4E4E7",
                padding: "20px 24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#71717A", fontSize: "0.775rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <span>Pending Action</span>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#F59E0B" }}></span>
                </div>
                <div style={{ fontSize: "2.25rem", fontWeight: "900", color: "#09090B", marginTop: "6px", letterSpacing: "-0.03em" }}>
                  {pendingCount}
                </div>
                <div style={{ fontSize: "0.775rem", color: "#D97706", fontWeight: "700", marginTop: "4px" }}>
                  Paid & Needing Immediate Print
                </div>
              </div>

              {/* Stat 2: Released Today */}
              <div style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "16px",
                border: "1px solid #E4E4E7",
                padding: "20px 24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#71717A", fontSize: "0.775rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <span>Certificates Issued</span>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10B981" }}></span>
                </div>
                <div style={{ fontSize: "2.25rem", fontWeight: "900", color: "#09090B", marginTop: "6px", letterSpacing: "-0.03em" }}>
                  {releasedCount}
                </div>
                <div style={{ fontSize: "0.775rem", color: "#059669", fontWeight: "700", marginTop: "4px" }}>
                  Printed & Sealed Today
                </div>
              </div>

              {/* Stat 3: Total Logged Applications */}
              <div style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "16px",
                border: "1px solid #E4E4E7",
                padding: "20px 24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#71717A", fontSize: "0.775rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <span>Total Logged Volume</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  </svg>
                </div>
                <div style={{ fontSize: "2.25rem", fontWeight: "900", color: "#09090B", marginTop: "6px", letterSpacing: "-0.03em" }}>
                  {totalCount}
                </div>
                <div style={{ fontSize: "0.775rem", color: "#71717A", fontWeight: "600", marginTop: "4px" }}>
                  Total Counter Queue Records
                </div>
              </div>
            </div>

            {/* DASHBOARD TABLE CONTAINER */}
            <div style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "20px",
              border: "1px solid #E4E4E7",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#09090B", margin: 0 }}>
                    Live Queue (Priority Sorted)
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "#71717A", margin: "2px 0 0" }}>
                    Actionable applications requiring print/seal automatically surface at top.
                  </p>
                </div>

                {/* SEGMENT FILTER TABS */}
                <div style={{ display: "flex", gap: "6px", backgroundColor: "#F4F4F5", padding: "4px", borderRadius: "9999px" }}>
                  <button
                    onClick={() => setStatusFilter("all")}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "9999px",
                      border: "none",
                      backgroundColor: statusFilter === "all" ? "#FFFFFF" : "transparent",
                      color: statusFilter === "all" ? "#09090B" : "#71717A",
                      fontWeight: 700,
                      fontSize: "0.775rem",
                      cursor: "pointer",
                      boxShadow: statusFilter === "all" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                    }}
                  >
                    All ({documents.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("pending")}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "9999px",
                      border: "none",
                      backgroundColor: statusFilter === "pending" ? "#FFFFFF" : "transparent",
                      color: statusFilter === "pending" ? "#D97706" : "#71717A",
                      fontWeight: 700,
                      fontSize: "0.775rem",
                      cursor: "pointer",
                      boxShadow: statusFilter === "pending" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                    }}
                  >
                    Pending ({pendingCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter("released")}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "9999px",
                      border: "none",
                      backgroundColor: statusFilter === "released" ? "#FFFFFF" : "transparent",
                      color: statusFilter === "released" ? "#065F46" : "#71717A",
                      fontWeight: 700,
                      fontSize: "0.775rem",
                      cursor: "pointer",
                      boxShadow: statusFilter === "released" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                    }}
                  >
                    Released ({releasedCount})
                  </button>
                </div>
              </div>

              {/* DESKTOP TABLE */}
              <div className="staff-desktop-table responsive-table-wrapper" style={{ borderRadius: "14px", border: "1px solid #E4E4E7", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#FAF9F6", borderBottom: "1px solid #E4E4E7", color: "#71717A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle" }}>Doc ID</th>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle" }}>Constituent Name</th>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle" }}>Purpose</th>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle" }}>Status</th>
                      <th style={{ padding: "14px 18px", textAlign: "right", verticalAlign: "middle" }}>Next Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.slice(0, 5).map((doc) => {
                      const isPending = doc.status.includes("Pending");
                      return (
                        <tr
                          key={doc.id}
                          onClick={() => handleOpenDocumentSplitView(doc)}
                          style={{
                            borderBottom: "1px solid #F4F4F5",
                            fontSize: "0.875rem",
                            cursor: "pointer",
                            backgroundColor: isPending ? "#FFFDF5" : "#FFFFFF",
                            transition: "background-color 0.15s ease"
                          }}
                        >
                          <td style={{ padding: "14px 18px", fontWeight: 800, fontFamily: "monospace", color: "#09090B", verticalAlign: "middle" }}>
                            {doc.id}
                          </td>
                          <td style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 700, color: "#09090B" }}>{doc.fullName}</span>
                              {(doc.isSelfRequest || doc.source?.includes("Online")) && (
                                <span style={{
                                  fontSize: "0.675rem",
                                  fontWeight: 800,
                                  backgroundColor: "#EFF6FF",
                                  color: "#1D4ED8",
                                  padding: "2px 8px",
                                  borderRadius: "9999px",
                                  border: "1px solid #BFDBFE"
                                }}>
                                  Online App
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "0.775rem", color: "#71717A" }}>{doc.address}</div>
                          </td>
                          <td style={{ padding: "14px 18px", color: "#52525B", verticalAlign: "middle" }}>{doc.purpose}</td>
                          <td style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                            <span style={{
                              padding: "5px 12px",
                              borderRadius: "9999px",
                              fontSize: "0.725rem",
                              fontWeight: 800,
                              backgroundColor: isPending ? "#FEF3C7" : "#ECFDF5",
                              color: isPending ? "#D97706" : "#065F46",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              whiteSpace: "nowrap"
                            }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: isPending ? "#D97706" : "#059669", flexShrink: 0 }}></span>
                              {doc.status}
                            </span>
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "right", verticalAlign: "middle" }}>
                            {/* DYNAMIC CONTEXT-AWARE BUTTON ACTION & DELETE */}
                            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                              {isPending ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePrintActualDocument(doc);
                                  }}
                                  style={{
                                    padding: "5px 13px",
                                    backgroundColor: "#09090B",
                                    color: "#FFFFFF",
                                    border: "none",
                                    borderRadius: "9999px",
                                    fontWeight: 700,
                                    fontSize: "0.775rem",
                                    lineHeight: 1.2,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                    boxShadow: "0 2px 6px rgba(9, 9, 11, 0.12)"
                                  }}
                                >
                                  Print Clearance →
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePrintActualDocument(doc);
                                  }}
                                  style={{
                                    padding: "5px 13px",
                                    backgroundColor: "#FFFFFF",
                                    color: "#09090B",
                                    border: "1px solid #D4D4D8",
                                    borderRadius: "9999px",
                                    fontWeight: 600,
                                    fontSize: "0.775rem",
                                    lineHeight: 1.2,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap"
                                  }}
                                >
                                  Reprint
                                </button>
                              )}

                              <button
                                type="button"
                                title="Delete Document"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDocToDelete(doc);
                                  setDeleteConfirmNameInput("");
                                }}
                                style={{
                                  padding: "5px 7px",
                                  backgroundColor: "#FEF2F2",
                                  color: "#DC2626",
                                  border: "1px solid #FCA5A5",
                                  borderRadius: "9999px",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center"
                                }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"/>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredDocs.length > 5 && (
                  <div style={{ padding: "10px 18px", backgroundColor: "#FAF9F6", borderTop: "1px solid #E4E4E7", textAlign: "center" }}>
                    <button
                      onClick={() => setActiveNav("queue")}
                      style={{ background: "none", border: "none", color: "#09090B", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}
                    >
                      Showing latest 5 of {filteredDocs.length} items — View Full Queue →
                    </button>
                  </div>
                )}
              </div>

              {/* MOBILE CARDS VIEW */}
              <div className="staff-mobile-cards staff-mobile-only" style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "14px", marginBottom: "16px" }}>
                {filteredDocs.slice(0, 5).map((doc) => {
                  const isPending = doc.status.includes("Pending");
                  return (
                    <div key={doc.id} className="staff-card-item" onClick={() => handleOpenDocumentSplitView(doc)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                        <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: "0.85rem", color: "#09090B" }}>{doc.id}</span>
                        <span style={{
                          padding: "4px 12px",
                          borderRadius: "9999px",
                          fontSize: "0.725rem",
                          fontWeight: 800,
                          backgroundColor: isPending ? "#FEF3C7" : "#ECFDF5",
                          color: isPending ? "#D97706" : "#065F46"
                        }}>
                          {doc.status}
                        </span>
                      </div>
                      <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#09090B", lineHeight: "1.25" }}>{doc.fullName}</div>
                        <div style={{ fontSize: "0.825rem", color: "#71717A", marginTop: "4px" }}>{doc.purpose} • {doc.paymentNo}</div>
                      </div>
                      <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintActualDocument(doc);
                          }}
                          style={{
                            flex: 1,
                            minHeight: "44px",
                            padding: "8px 16px",
                            backgroundColor: isPending ? "#09090B" : "#FFFFFF",
                            color: isPending ? "#FFFFFF" : "#09090B",
                            border: isPending ? "none" : "1px solid #D4D4D8",
                            borderRadius: "9999px",
                            fontWeight: 700,
                            fontSize: "0.825rem",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px"
                          }}
                        >
                          {isPending ? "Print Clearance" : "Reprint"}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <line x1="5" y1="12" x2="19" y2="12"/>
                            <polyline points="12 5 19 12 12 19"/>
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDocumentSplitView(doc);
                          }}
                          style={{
                            padding: "8px 16px",
                            backgroundColor: "#F4F4F5",
                            color: "#09090B",
                            border: "1px solid #E4E4E7",
                            borderRadius: "9999px",
                            fontWeight: 700,
                            fontSize: "0.825rem",
                            cursor: "pointer",
                            minHeight: "44px"
                          }}
                        >
                          Inspect
                        </button>
                      </div>
                    </div>
                  );
                })}
                {filteredDocs.length > 5 && (
                  <button
                    onClick={() => setActiveNav("queue")}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "14px",
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #D4D4D8",
                      color: "#09090B",
                      fontWeight: 700,
                      fontSize: "0.825rem",
                      cursor: "pointer",
                      minHeight: "44px"
                    }}
                  >
                    View All {filteredDocs.length} Queue Items →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. LIVE QUEUE TAB */}
        {activeNav === "queue" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "20px",
              padding: "20px 24px",
              border: "1px solid #E4E4E7",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)"
            }}>
              <input
                type="text"
                placeholder="Filter queue by constituent name, Doc ID, or Payment Ref..."
                value={queueSearchTerm}
                onChange={(e) => setQueueSearchTerm(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: "260px",
                  padding: "12px 18px",
                  borderRadius: "12px",
                  border: "1px solid #D4D4D8",
                  fontSize: "0.95rem",
                  backgroundColor: "#FFFFFF",
                  color: "#09090B",
                  outline: "none"
                }}
              />

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setQueueStatusFilter("all")}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "9999px",
                    border: "1px solid #D4D4D8",
                    backgroundColor: queueStatusFilter === "all" ? "#09090B" : "#FFFFFF",
                    color: queueStatusFilter === "all" ? "#FFFFFF" : "#09090B",
                    fontWeight: 700,
                    fontSize: "0.825rem",
                    cursor: "pointer"
                  }}
                >
                  All ({documents.length})
                </button>
                <button
                  onClick={() => setQueueStatusFilter("pending")}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "9999px",
                    border: "1px solid #D4D4D8",
                    backgroundColor: queueStatusFilter === "pending" ? "#09090B" : "#FFFFFF",
                    color: queueStatusFilter === "pending" ? "#FFFFFF" : "#09090B",
                    fontWeight: 700,
                    fontSize: "0.825rem",
                    cursor: "pointer"
                  }}
                >
                  Pending Only ({pendingCount})
                </button>
              </div>
            </div>

            <div className="staff-desktop-table responsive-table-wrapper" style={{ backgroundColor: "#FFFFFF", borderRadius: "20px", border: "1px solid #E4E4E7", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "#FAF9F6", borderBottom: "1px solid #E4E4E7", color: "#71717A", fontSize: "0.775rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <th style={{ padding: "14px 18px", verticalAlign: "middle" }}>Doc ID</th>
                    <th style={{ padding: "14px 18px", verticalAlign: "middle" }}>Constituent Name</th>
                    <th style={{ padding: "14px 18px", verticalAlign: "middle" }}>Document Type</th>
                    <th style={{ padding: "14px 18px", verticalAlign: "middle" }}>Payment Ref</th>
                    <th style={{ padding: "14px 18px", verticalAlign: "middle" }}>Status</th>
                    <th style={{ padding: "14px 18px", textAlign: "right", verticalAlign: "middle" }}>Next Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedQueueDocs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "32px 20px", textAlign: "center", color: "#71717A", fontSize: "0.9rem" }}>
                        No application records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedQueueDocs.map((doc, idx) => {
                      const isPending = doc.status.includes("Pending");
                      return (
                        <tr
                          key={`${doc.id}-${idx}`}
                          onClick={() => handleOpenDocumentSplitView(doc)}
                          style={{
                            borderBottom: "1px solid #F4F4F5",
                            fontSize: "0.925rem",
                            cursor: "pointer",
                            backgroundColor: isPending ? "#FFFDF5" : "#FFFFFF"
                          }}
                        >
                          <td style={{ padding: "14px 18px", fontWeight: 800, color: "#09090B", fontFamily: "monospace", verticalAlign: "middle" }}>{doc.id}</td>
                          <td style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 700, color: "#09090B" }}>{doc.fullName}</span>
                              {(doc.isSelfRequest || doc.source?.includes("Online")) && (
                                <span style={{
                                  fontSize: "0.675rem",
                                  fontWeight: 800,
                                  backgroundColor: "#EFF6FF",
                                  color: "#1D4ED8",
                                  padding: "2px 8px",
                                  borderRadius: "9999px",
                                  border: "1px solid #BFDBFE"
                                }}>
                                  Online App
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "#71717A", marginTop: "2px" }}>{doc.purpose}</div>
                          </td>
                          <td style={{ padding: "14px 18px", color: "#52525B", verticalAlign: "middle" }}>{doc.documentType}</td>
                          <td style={{ padding: "14px 18px", fontFamily: "monospace", fontSize: "0.85rem", color: "#71717A", verticalAlign: "middle" }}>{doc.paymentNo}</td>
                          <td style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                            <span style={{
                              padding: "5px 12px",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: 800,
                              backgroundColor: isPending ? "#FEF3C7" : "#ECFDF5",
                              color: isPending ? "#D97706" : "#065F46",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              whiteSpace: "nowrap"
                            }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: isPending ? "#D97706" : "#059669", flexShrink: 0 }}></span>
                              {doc.status}
                            </span>
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "right", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                              {isPending ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePrintActualDocument(doc);
                                  }}
                                  style={{
                                    padding: "5px 13px",
                                    backgroundColor: "#09090B",
                                    color: "#FFFFFF",
                                    border: "none",
                                    borderRadius: "9999px",
                                    fontWeight: 700,
                                    fontSize: "0.775rem",
                                    lineHeight: 1.2,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                    boxShadow: "0 2px 6px rgba(9, 9, 11, 0.12)"
                                  }}
                                >
                                  Print Clearance →
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePrintActualDocument(doc);
                                  }}
                                  style={{
                                    padding: "5px 13px",
                                    backgroundColor: "#FFFFFF",
                                    color: "#09090B",
                                    border: "1px solid #D4D4D8",
                                    borderRadius: "9999px",
                                    fontWeight: 600,
                                    fontSize: "0.775rem",
                                    lineHeight: 1.2,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap"
                                  }}
                                >
                                  Reprint
                                </button>
                              )}

                              <button
                                type="button"
                                title="Delete Document"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDocToDelete(doc);
                                  setDeleteConfirmNameInput("");
                                }}
                                style={{
                                  padding: "5px 7px",
                                  backgroundColor: "#FEF2F2",
                                  color: "#DC2626",
                                  border: "1px solid #FCA5A5",
                                  borderRadius: "9999px",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center"
                                }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"/>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS VIEW */}
            <div className="staff-mobile-cards staff-mobile-only" style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "14px", marginBottom: "16px" }}>
              {paginatedQueueDocs.length === 0 ? (
                <div style={{ backgroundColor: "#FFFFFF", padding: "24px 16px", borderRadius: "16px", textAlign: "center", color: "#71717A", fontSize: "0.875rem" }}>
                  No application records found matching your filters.
                </div>
              ) : (
                paginatedQueueDocs.map((doc, idx) => {
                  const isPending = doc.status.includes("Pending");
                  return (
                    <div key={`${doc.id}-${idx}`} className="staff-card-item" onClick={() => handleOpenDocumentSplitView(doc)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                        <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: "0.85rem", color: "#09090B" }}>{doc.id}</span>
                        <span style={{
                          padding: "4px 12px",
                          borderRadius: "9999px",
                          fontSize: "0.725rem",
                          fontWeight: 800,
                          backgroundColor: isPending ? "#FEF3C7" : "#ECFDF5",
                          color: isPending ? "#D97706" : "#065F46"
                        }}>
                          {doc.status}
                        </span>
                      </div>
                      <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#09090B", lineHeight: "1.25" }}>{doc.fullName}</div>
                        <div style={{ fontSize: "0.825rem", color: "#71717A", marginTop: "4px" }}>{doc.purpose} • {doc.paymentNo}</div>
                      </div>
                      <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintActualDocument(doc);
                          }}
                          style={{
                            flex: 1,
                            minHeight: "44px",
                            padding: "8px 16px",
                            backgroundColor: isPending ? "#09090B" : "#FFFFFF",
                            color: isPending ? "#FFFFFF" : "#09090B",
                            border: isPending ? "none" : "1px solid #D4D4D8",
                            borderRadius: "9999px",
                            fontWeight: 700,
                            fontSize: "0.825rem",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px"
                          }}
                        >
                          {isPending ? "Print Clearance" : "Reprint"}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <line x1="5" y1="12" x2="19" y2="12"/>
                            <polyline points="12 5 19 12 12 19"/>
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDocumentSplitView(doc);
                          }}
                          style={{
                            padding: "8px 16px",
                            backgroundColor: "#F4F4F5",
                            color: "#09090B",
                            border: "1px solid #E4E4E7",
                            borderRadius: "9999px",
                            fontWeight: 700,
                            fontSize: "0.825rem",
                            cursor: "pointer",
                            minHeight: "44px"
                          }}
                        >
                          Inspect
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* PAGINATION TOOLBAR */}
            <div style={{
              padding: "14px 20px",
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #E4E4E7",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
              fontSize: "0.825rem",
              color: "#71717A"
            }}>
              <div>
                Showing {filteredQueueDocs.length === 0 ? 0 : (safeQueuePage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(safeQueuePage * ITEMS_PER_PAGE, filteredQueueDocs.length)} of {filteredQueueDocs.length} entries
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  onClick={() => setQueuePage((p) => Math.max(p - 1, 1))}
                  disabled={safeQueuePage === 1}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "9999px",
                    border: "1px solid #D4D4D8",
                    backgroundColor: safeQueuePage === 1 ? "#F4F4F5" : "#FFFFFF",
                    color: safeQueuePage === 1 ? "#A1A1AA" : "#09090B",
                    fontWeight: 600,
                    fontSize: "0.775rem",
                    cursor: safeQueuePage === 1 ? "not-allowed" : "pointer"
                  }}
                >
                  ← Prev
                </button>

                {Array.from({ length: totalQueuePages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setQueuePage(pageNum)}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      border: pageNum === safeQueuePage ? "none" : "1px solid #E4E4E7",
                      backgroundColor: pageNum === safeQueuePage ? "#09090B" : "#FFFFFF",
                      color: pageNum === safeQueuePage ? "#FFFFFF" : "#09090B",
                      fontWeight: 700,
                      fontSize: "0.775rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  onClick={() => setQueuePage((p) => Math.min(p + 1, totalQueuePages))}
                  disabled={safeQueuePage >= totalQueuePages}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "9999px",
                    border: "1px solid #D4D4D8",
                    backgroundColor: safeQueuePage >= totalQueuePages ? "#F4F4F5" : "#FFFFFF",
                    color: safeQueuePage >= totalQueuePages ? "#A1A1AA" : "#09090B",
                    fontWeight: 600,
                    fontSize: "0.775rem",
                    cursor: safeQueuePage >= totalQueuePages ? "not-allowed" : "pointer"
                  }}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. REGISTRY FILES TAB */}
        {activeNav === "registry" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{
              backgroundColor: "#FFFFFF",
              padding: "18px 24px",
              borderRadius: "20px",
              border: "1px solid #E4E4E7",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap"
            }}>
              <input
                type="text"
                placeholder="Search master clearance registry by name, Doc ID, or purpose..."
                value={registrySearchTerm}
                onChange={(e) => setRegistrySearchTerm(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: "260px",
                  padding: "12px 18px",
                  borderRadius: "12px",
                  border: "1px solid #D4D4D8",
                  fontSize: "0.95rem",
                  outline: "none"
                }}
              />

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setRegistryStatusFilter("all")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "9999px",
                    border: "1px solid #D4D4D8",
                    backgroundColor: registryStatusFilter === "all" ? "#09090B" : "#FFFFFF",
                    color: registryStatusFilter === "all" ? "#FFFFFF" : "#09090B",
                    fontWeight: 700,
                    fontSize: "0.825rem",
                    cursor: "pointer"
                  }}
                >
                  All ({documents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRegistryStatusFilter("pending")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "9999px",
                    border: "1px solid #D4D4D8",
                    backgroundColor: registryStatusFilter === "pending" ? "#09090B" : "#FFFFFF",
                    color: registryStatusFilter === "pending" ? "#FFFFFF" : "#09090B",
                    fontWeight: 700,
                    fontSize: "0.825rem",
                    cursor: "pointer"
                  }}
                >
                  Pending ({pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setRegistryStatusFilter("released")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "9999px",
                    border: "1px solid #D4D4D8",
                    backgroundColor: registryStatusFilter === "released" ? "#09090B" : "#FFFFFF",
                    color: registryStatusFilter === "released" ? "#FFFFFF" : "#09090B",
                    fontWeight: 700,
                    fontSize: "0.825rem",
                    cursor: "pointer"
                  }}
                >
                  Released ({releasedCount})
                </button>
              </div>

              <button
                onClick={handleOpenBlankSplitView}
                style={{
                  padding: "12px 22px",
                  backgroundColor: "#09090B",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "9999px",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 14px rgba(9, 9, 11, 0.15)",
                  whiteSpace: "nowrap"
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Create New Document
              </button>
            </div>

            {/* DESKTOP TABLE */}
            <div className="staff-desktop-table responsive-table-wrapper" style={{ backgroundColor: "#FFFFFF", borderRadius: "20px", border: "1px solid #E4E4E7", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "#FAF9F6", borderBottom: "1px solid #E4E4E7", color: "#71717A", fontSize: "0.775rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <th style={{ padding: "14px 18px", verticalAlign: "middle" }}>Doc ID</th>
                    <th style={{ padding: "14px 18px", verticalAlign: "middle" }}>Full Name</th>
                    <th style={{ padding: "14px 18px", verticalAlign: "middle" }}>Document Type</th>
                    <th style={{ padding: "14px 18px", verticalAlign: "middle" }}>Purpose</th>
                    <th style={{ padding: "14px 18px", verticalAlign: "middle" }}>Date Requested</th>
                    <th style={{ padding: "14px 18px", verticalAlign: "middle" }}>Status</th>
                    <th style={{ padding: "14px 18px", textAlign: "right", verticalAlign: "middle" }}>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRegistryDocs.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "32px 20px", textAlign: "center", color: "#71717A", fontSize: "0.9rem" }}>
                        No clearance registry records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedRegistryDocs.map((doc) => (
                      <tr
                        key={doc.id}
                        onClick={() => handleOpenDocumentSplitView(doc)}
                        style={{ borderBottom: "1px solid #F4F4F5", fontSize: "0.925rem", cursor: "pointer" }}
                      >
                        <td style={{ padding: "14px 18px", fontWeight: 800, fontFamily: "monospace", color: "#09090B", verticalAlign: "middle" }}>{doc.id}</td>
                        <td style={{ padding: "14px 18px", fontWeight: 700, color: "#09090B", verticalAlign: "middle" }}>{doc.fullName}</td>
                        <td style={{ padding: "14px 18px", color: "#52525B", verticalAlign: "middle" }}>{doc.documentType}</td>
                        <td style={{ padding: "14px 18px", color: "#52525B", verticalAlign: "middle" }}>{doc.purpose}</td>
                        <td style={{ padding: "14px 18px", color: "#71717A", fontSize: "0.875rem", verticalAlign: "middle" }}>{formatEnglishDate(doc.dateRequested)}</td>
                        <td style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                          <span style={{
                            padding: "5px 12px",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            backgroundColor: doc.status.includes("Printed") || doc.status.includes("Released") ? "#ECFDF5" : "#FEF3C7",
                            color: doc.status.includes("Printed") || doc.status.includes("Released") ? "#065F46" : "#D97706",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            whiteSpace: "nowrap"
                          }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: doc.status.includes("Printed") || doc.status.includes("Released") ? "#059669" : "#D97706", flexShrink: 0 }}></span>
                            {doc.status}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                            <button
                              onClick={() => handleOpenDocumentSplitView(doc)}
                              style={{
                                padding: "5px 13px",
                                backgroundColor: "#FFFFFF",
                                color: "#09090B",
                                border: "1px solid #D4D4D8",
                                borderRadius: "9999px",
                                fontWeight: 600,
                                fontSize: "0.775rem",
                                lineHeight: 1.2,
                                cursor: "pointer",
                                whiteSpace: "nowrap"
                              }}
                            >
                              Inspect / Edit
                            </button>
                            <button
                              type="button"
                              title="Delete Document"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDocToDelete(doc);
                                setDeleteConfirmNameInput("");
                              }}
                              style={{
                                padding: "5px 7px",
                                backgroundColor: "#FEF2F2",
                                color: "#DC2626",
                                border: "1px solid #FCA5A5",
                                borderRadius: "9999px",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center"
                              }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS VIEW */}
            <div className="staff-mobile-cards staff-mobile-only" style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "14px", marginBottom: "16px" }}>
              {paginatedRegistryDocs.length === 0 ? (
                <div style={{ backgroundColor: "#FFFFFF", padding: "24px 16px", borderRadius: "16px", textAlign: "center", color: "#71717A", fontSize: "0.875rem" }}>
                  No clearance registry records found matching your filters.
                </div>
              ) : (
                paginatedRegistryDocs.map((doc) => {
                  const isReleased = doc.status.includes("Printed") || doc.status.includes("Released");
                  return (
                    <div key={doc.id} className="staff-card-item" onClick={() => handleOpenDocumentSplitView(doc)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                        <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: "0.85rem", color: "#09090B" }}>{doc.id}</span>
                        <span style={{
                          padding: "4px 12px",
                          borderRadius: "9999px",
                          fontSize: "0.725rem",
                          fontWeight: 800,
                          backgroundColor: isReleased ? "#ECFDF5" : "#FEF3C7",
                          color: isReleased ? "#065F46" : "#D97706"
                        }}>
                          {doc.status}
                        </span>
                      </div>
                      <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#09090B", lineHeight: "1.25" }}>{doc.fullName}</div>
                        <div style={{ fontSize: "0.825rem", color: "#71717A", marginTop: "4px" }}>{doc.documentType} • {doc.purpose}</div>
                        <div style={{ fontSize: "0.775rem", color: "#A1A1AA", marginTop: "4px" }}>Requested: {formatEnglishDate(doc.dateRequested)}</div>
                      </div>
                      <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDocumentSplitView(doc);
                          }}
                          style={{
                            flex: 1,
                            minHeight: "44px",
                            padding: "8px 16px",
                            backgroundColor: "#09090B",
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: "9999px",
                            fontWeight: 700,
                            fontSize: "0.825rem",
                            cursor: "pointer"
                          }}
                        >
                          Inspect / Edit Record
                        </button>
                        <button
                          type="button"
                          title="Delete Document"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDocToDelete(doc);
                            setDeleteConfirmNameInput("");
                          }}
                          style={{
                            padding: "8px 14px",
                            backgroundColor: "#FEF2F2",
                            color: "#DC2626",
                            border: "1px solid #FCA5A5",
                            borderRadius: "9999px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: "44px"
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* PAGINATION TOOLBAR */}
            <div style={{
              padding: "14px 20px",
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #E4E4E7",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
              fontSize: "0.825rem",
              color: "#71717A"
            }}>
              <div>
                Showing {filteredRegistryDocs.length === 0 ? 0 : (safeRegistryPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(safeRegistryPage * ITEMS_PER_PAGE, filteredRegistryDocs.length)} of {filteredRegistryDocs.length} entries
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  onClick={() => setRegistryPage((p) => Math.max(p - 1, 1))}
                  disabled={safeRegistryPage === 1}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "9999px",
                    border: "1px solid #D4D4D8",
                    backgroundColor: safeRegistryPage === 1 ? "#F4F4F5" : "#FFFFFF",
                    color: safeRegistryPage === 1 ? "#A1A1AA" : "#09090B",
                    fontWeight: 600,
                    fontSize: "0.775rem",
                    cursor: safeRegistryPage === 1 ? "not-allowed" : "pointer"
                  }}
                >
                  ← Prev
                </button>

                {Array.from({ length: totalRegistryPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setRegistryPage(pageNum)}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      border: pageNum === safeRegistryPage ? "none" : "1px solid #E4E4E7",
                      backgroundColor: pageNum === safeRegistryPage ? "#09090B" : "#FFFFFF",
                      color: pageNum === safeRegistryPage ? "#FFFFFF" : "#09090B",
                      fontWeight: 700,
                      fontSize: "0.775rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  onClick={() => setRegistryPage((p) => Math.min(p + 1, totalRegistryPages))}
                  disabled={safeRegistryPage >= totalRegistryPages}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "9999px",
                    border: "1px solid #D4D4D8",
                    backgroundColor: safeRegistryPage >= totalRegistryPages ? "#F4F4F5" : "#FFFFFF",
                    color: safeRegistryPage >= totalRegistryPages ? "#A1A1AA" : "#09090B",
                    fontWeight: 600,
                    fontSize: "0.775rem",
                    cursor: safeRegistryPage >= totalRegistryPages ? "not-allowed" : "pointer"
                  }}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. QUICK SCANNER TAB */}
        {activeNav === "scanner" && (
          <div style={{ maxWidth: "680px", margin: "0 auto" }}>
            <div style={{
              backgroundColor: "#09090B",
              borderRadius: "24px",
              padding: "32px",
              color: "#FFFFFF",
              textAlign: "center",
              marginBottom: "24px",
              border: "1px solid #27272A",
              boxShadow: "0 8px 30px rgba(0,0,0,0.25)"
            }}>
              <div style={{
                height: "260px",
                border: "2px dashed #4ADE80",
                borderRadius: "16px",
                overflow: "hidden",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(74, 222, 128, 0.04)"
              }}>
                {isCameraActive ? (
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="1.5">
                      <rect x="7" y="7" width="10" height="10" rx="1"/>
                      <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                      <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                      <path d="M17 21h2a2 2 0 0 0 2-2v-2"/>
                      <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                    </svg>
                    <div style={{ marginTop: "12px", fontSize: "0.9rem", color: "#E4E4E7", fontWeight: 600 }}>
                      {cameraStatus || "Align Constituent Digital QR Pass"}
                    </div>
                  </>
                )}
              </div>

              {cameraStatus && (
                <div style={{ marginTop: "12px", fontSize: "0.825rem", color: "#A1A1AA" }}>
                  {cameraStatus}
                </div>
              )}

              <div style={{ marginTop: "20px", display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setIsCameraActive((prev) => !prev)}
                  style={{
                    padding: "12px 24px",
                    backgroundColor: isCameraActive ? "#EF4444" : "#FFFFFF",
                    color: isCameraActive ? "#FFFFFF" : "#09090B",
                    border: "none",
                    borderRadius: "9999px",
                    fontWeight: 800,
                    fontSize: "0.9rem",
                    cursor: "pointer"
                  }}
                >
                  {isCameraActive ? "Stop Camera" : "Start Live Webcam Scanner"}
                </button>

                <label style={{
                  padding: "12px 24px",
                  backgroundColor: "#27272A",
                  color: "#FFFFFF",
                  border: "1px solid #3F3F46",
                  borderRadius: "9999px",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}>
                  Upload QR Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQrFileUpload}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            </div>

            <div style={{ backgroundColor: "#FFFFFF", padding: "24px", borderRadius: "20px", border: "1px solid #E4E4E7", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#09090B", marginBottom: "8px" }}>
                Manual Ref Code Lookup
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text"
                  placeholder="Enter DOC-xxxx, PAY-2026-xxxx, or OR-xxxx..."
                  value={scannerInput}
                  onChange={(e) => setScannerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleScannerSearch();
                  }}
                  style={{
                    flex: 1,
                    padding: "12px 18px",
                    borderRadius: "12px",
                    border: "1px solid #D4D4D8",
                    fontSize: "0.95rem"
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleScannerSearch()}
                  style={{
                    padding: "12px 24px",
                    backgroundColor: "#09090B",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "9999px",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    cursor: "pointer"
                  }}
                >
                  Verify Match
                </button>
              </div>
            </div>

            {scannedDocMatch && (
              <div style={{ marginTop: "24px", backgroundColor: "#FFFFFF", borderRadius: "20px", border: "2px solid #09090B", padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#059669", backgroundColor: "#ECFDF5", padding: "4px 12px", borderRadius: "9999px" }}>
                    MATCH VERIFIED
                  </span>
                  <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: "1.1rem" }}>{scannedDocMatch.id}</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.95rem", color: "#52525B", marginBottom: "20px" }}>
                  <div><strong>Constituent:</strong> <span style={{ color: "#09090B", fontWeight: 700 }}>{scannedDocMatch.fullName}</span></div>
                  <div><strong>Purpose:</strong> <span style={{ color: "#09090B" }}>{scannedDocMatch.purpose}</span></div>
                  <div><strong>Payment Ref:</strong> <span style={{ color: "#09090B" }}>{scannedDocMatch.paymentNo}</span></div>
                </div>

                <div>
                  <button
                    onClick={() => handlePrintActualDocument(scannedDocMatch)}
                    style={{
                      width: "100%",
                      padding: "14px",
                      backgroundColor: "#09090B",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: "9999px",
                      fontWeight: 800,
                      fontSize: "0.9rem",
                      cursor: "pointer"
                    }}
                  >
                    Print Certificate →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. CLEARANCE DOCUMENT SPLIT VIEW (WITH BACK BUTTON) */}
        {activeNav === "create" && (
          <div>
            {scannedToast && (
              <div style={{
                backgroundColor: "#ECFDF5",
                border: "1px solid #6EE7B7",
                color: "#065F46",
                padding: "12px 20px",
                borderRadius: "16px",
                marginBottom: "16px",
                fontWeight: 700,
                fontSize: "0.9rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "0 2px 8px rgba(16, 185, 129, 0.12)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "1.1rem" }}>✓</span>
                  <span>{scannedToast}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setScannedToast(null)}
                  style={{ background: "none", border: "none", color: "#065F46", cursor: "pointer", fontWeight: 800, fontSize: "1rem" }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* TOP NAVIGATION BACK BUTTON & DOC BADGE & PRIMARY TOP RIGHT PRINT BUTTON */}
            <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="staff-btn-back"
                onClick={() => setActiveNav("queue")}
                style={{
                  padding: "8px 18px",
                  borderRadius: "9999px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #D4D4D8",
                  color: "#09090B",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  minHeight: "44px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
                }}
              >
                ← Back to Queue
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                {inspectedDoc && (
                  <span style={{ fontSize: "0.825rem", color: "#71717A", fontWeight: 600 }}>
                    Editing: <strong style={{ color: "#09090B", fontFamily: "monospace" }}>{inspectedDoc.id}</strong>
                  </span>
                )}

                <button
                  type="button"
                  className="staff-btn-print-top"
                  onClick={handleCreateDirectDoc}
                  style={{
                    padding: "10px 22px",
                    backgroundColor: "#09090B",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "9999px",
                    fontWeight: 800,
                    fontSize: "0.875rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 14px rgba(9, 9, 11, 0.22)",
                    transition: "transform 0.1s ease"
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polyline points="6 9 6 2 18 2 18 9"/>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                    <rect x="6" y="14" width="12" height="8"/>
                  </svg>
                  Print →
                </button>
              </div>
            </div>

            {/* MOBILE SEGMENTED TOGGLE (SVG Vector Icons Only - No Emojis) */}
            <div className="staff-segmented-control staff-mobile-flex-only">
              <button
                type="button"
                className={mobileEditorTab === "form" ? "active" : ""}
                onClick={() => setMobileEditorTab("form")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Form Controls
              </button>
              <button
                type="button"
                className={mobileEditorTab === "preview" ? "active" : ""}
                onClick={() => setMobileEditorTab("preview")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                View Certificate
              </button>
            </div>

            <div className="staff-editor-grid" style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: "28px", alignItems: "flex-start" }}>
              {/* LEFT FORM COLUMN: EMBEDDED EditorPanel */}
              <div
                className={mobileEditorTab === "preview" ? "staff-desktop-only" : ""}
                style={{
                  backgroundColor: "#FFFFFF",
                  padding: "20px",
                  borderRadius: "24px",
                  border: "1px solid #E4E4E7",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  maxHeight: "calc(100vh - 170px)",
                  overflowY: "auto"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #F4F4F5", paddingBottom: "12px" }}>
                  <div>
                    <span style={{ fontSize: "0.6875rem", fontWeight: "800", color: "#D97706", backgroundColor: "#FEF3C7", padding: "2px 8px", borderRadius: "9999px", textTransform: "uppercase" }}>
                      {inspectedDoc ? `INSPECTING ${inspectedDoc.id}` : "ORIGINAL DOCUMENT EDITOR"}
                    </span>
                    <h2 style={{ fontSize: "1.2rem", fontWeight: "800", color: "#09090B", margin: "4px 0 0" }}>
                      Clearance Form Controls
                    </h2>
                  </div>
                  {inspectedDoc && (
                    <button
                      onClick={handleOpenBlankSplitView}
                      style={{ background: "none", border: "none", color: "#71717A", fontWeight: 700, cursor: "pointer", fontSize: "0.8rem" }}
                    >
                      New Form ×
                    </button>
                  )}
                </div>

                {/* ORIGINAL EditorPanel COMPONENT */}
                <EditorPanel
                  formData={formData}
                  onFieldChange={handleFieldChange}
                  photoSrc={photoSrc}
                  onPhotoChange={(src) => setPhotoSrc(src)}
                  onPhotoRemove={() => setPhotoSrc("")}
                  signatureSrc={signatureSrc}
                  onSignatureChange={(src) => setSignatureSrc(src)}
                  onSignatureRemove={() => setSignatureSrc("")}
                />

                <button
                  type="button"
                  onClick={handleCreateDirectDoc}
                  style={{
                    padding: "14px 24px",
                    backgroundColor: "#09090B",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "9999px",
                    fontWeight: 800,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    marginTop: "8px",
                    boxShadow: "0 4px 14px rgba(9, 9, 11, 0.15)",
                    width: "100%",
                    minHeight: "46px"
                  }}
                >
                  Print →
                </button>

                {/* DANGER ZONE: SAFE PLACEMENT FOR DELETE RECORD BUTTON */}
                {inspectedDoc && (
                  <div style={{ paddingTop: "12px", borderTop: "1px solid #F4F4F5", marginTop: "8px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setDocToDelete(inspectedDoc);
                        setDeleteConfirmNameInput("");
                      }}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "9999px",
                        backgroundColor: "#FEF2F2",
                        color: "#DC2626",
                        border: "1px solid #FCA5A5",
                        fontWeight: 700,
                        fontSize: "0.775rem",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        width: "100%",
                        minHeight: "44px"
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                      Delete Record {inspectedDoc.id}
                    </button>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: LIVE PREVIEW PAGE */}
              <div
                className={mobileEditorTab === "form" ? "staff-desktop-only" : ""}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "24px",
                  border: "1px solid #E4E4E7",
                  padding: "20px",
                  height: "calc(100vh - 170px)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
                  display: "flex",
                  flexDirection: "column"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexShrink: 0 }}>
                  <span className="staff-badge-preview" style={{ fontSize: "0.725rem", fontWeight: 800, color: "#D97706", backgroundColor: "#FEF3C7", padding: "4px 12px", borderRadius: "9999px" }}>
                    LIVE CLEARANCE PREVIEW (8.5" x 13" OFFICIAL RTC CERTIFICATE)
                  </span>
                </div>

                {/* VERTICALLY SCROLLABLE CONTAINER FOR THE FULL DOCUMENT */}
                <div style={{
                  flex: 1,
                  minHeight: 0,
                  borderRadius: "16px",
                  overflowY: "auto",
                  overflowX: "hidden",
                  border: "1px solid #E4E4E7",
                  backgroundColor: "#F4F4F5"
                }}>
                  <PreviewPanel
                    formData={formData}
                    photoSrc={photoSrc}
                    signatureSrc={signatureSrc}
                  />
                </div>

                <div className="staff-mobile-only" style={{ marginTop: "12px" }}>
                  <button
                    type="button"
                    onClick={handleCreateDirectDoc}
                    style={{
                      padding: "14px 24px",
                      backgroundColor: "#09090B",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: "9999px",
                      fontWeight: 800,
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      width: "100%",
                      minHeight: "48px"
                    }}
                  >
                    Print →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. ORGANIZATION SETTINGS PANEL */}
        {activeNav === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "20px",
              border: "1px solid #E4E4E7",
              padding: "32px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "8px" }}>
                <div style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  backgroundColor: "#FAF9F6",
                  border: "1px solid #E4E4E7",
                  color: "#09090B",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontSize: "1.35rem", fontWeight: "800", color: "#09090B", margin: 0, letterSpacing: "-0.02em" }}>
                    Organization Settings
                  </h2>
                  <span style={{ fontSize: "0.8rem", color: "#71717A", fontWeight: "600" }}>REGIONAL TRIAL COURT • IRIGA CITY OFFICE</span>
                </div>
              </div>

              {/* SETTING CARD: STARTING / NEXT CLEARANCE NO. */}
              <div style={{
                marginTop: "24px",
                padding: "24px",
                backgroundColor: "#FAF9F6",
                borderRadius: "16px",
                border: "1px solid #E4E4E7",
                display: "flex",
                flexDirection: "column",
                gap: "16px"
              }}>
                <div>
                  <label style={{ display: "block", fontSize: "1rem", fontWeight: "800", color: "#09090B", marginBottom: "4px" }}>
                    Starting Clearance / Certification No.
                  </label>
                  <p style={{ fontSize: "0.85rem", color: "#71717A", margin: 0, lineHeight: 1.5 }}>
                    Set the starting clearance sequence number (e.g., <strong>1</strong>). Every new clearance certificate created by constituents or staff will automatically increment sequentially from this number.
                  </p>
                </div>

                <form onSubmit={handleSaveOrgSettings} style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    type="number"
                    min="1"
                    required
                    value={certNoInput}
                    onChange={(e) => setCertNoInput(e.target.value)}
                    style={{
                      width: "180px",
                      padding: "12px 18px",
                      borderRadius: "12px",
                      border: "1px solid #D4D4D8",
                      fontSize: "1.1rem",
                      fontWeight: "800",
                      backgroundColor: "#FFFFFF",
                      color: "#09090B"
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: "12px 28px",
                      backgroundColor: "#09090B",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: "9999px",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(9, 9, 11, 0.15)"
                    }}
                  >
                    Save Settings
                  </button>
                </form>

                {settingsSavedToast && (
                  <div style={{
                    padding: "12px 16px",
                    backgroundColor: "#ECFDF5",
                    border: "1px solid #A7F3D0",
                    borderRadius: "10px",
                    color: "#047857",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                    ✓ Organization settings saved! Next clearance generated will be clearance No. {nextCertNo}.
                  </div>
                )}
              </div>

              {/* OFFICE INFO CARD */}
              <div style={{
                marginTop: "24px",
                padding: "24px",
                backgroundColor: "#FAF9F6",
                borderRadius: "16px",
                border: "1px solid #E4E4E7",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Active Office Profile
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", fontSize: "0.9rem" }}>
                  <div><strong>Court Name:</strong> <span style={{ color: "#52525B" }}>REGIONAL TRIAL COURT</span></div>
                  <div><strong>Judicial Region:</strong> <span style={{ color: "#52525B" }}>5th Judicial Region</span></div>
                  <div><strong>Station / City:</strong> <span style={{ color: "#52525B" }}>Iriga City, Camarines Sur</span></div>
                  <div><strong>Office:</strong> <span style={{ color: "#52525B" }}>Office of the Clerk of Court</span></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* DOUBLE CONFIRMATION DELETE MODAL */}
      {docToDelete && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(9, 9, 11, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 200,
          padding: "20px"
        }}>
          <div style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "24px",
            maxWidth: "520px",
            width: "100%",
            padding: "32px",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            border: "1px solid #E4E4E7"
          }}>
            {/* Danger Header Badge */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                backgroundColor: "#FEF2F2",
                color: "#DC2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #FCA5A5",
                flexShrink: 0
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <span style={{ fontSize: "0.725rem", fontWeight: "800", color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  HIGH-FRICTION DELETION CONFIRMATION
                </span>
                <h3 style={{ fontSize: "1.35rem", fontWeight: "800", color: "#09090B", margin: "2px 0 0" }}>
                  Delete Record {docToDelete.id}?
                </h3>
              </div>
            </div>

            <p style={{ fontSize: "0.925rem", color: "#52525B", lineHeight: 1.5, margin: 0 }}>
              This action will permanently remove this clearance record. To confirm, type the constituent's full name:
            </p>

            {/* Target Name Callout Box */}
            <div style={{
              padding: "14px 18px",
              backgroundColor: "#F4F4F5",
              borderRadius: "12px",
              border: "1px solid #E4E4E7",
              display: "flex",
              flexDirection: "column",
              gap: "4px"
            }}>
              <span style={{ fontSize: "0.725rem", fontWeight: 700, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Target Constituent Name:
              </span>
              <strong style={{ fontSize: "1.05rem", color: "#09090B", fontFamily: "monospace", letterSpacing: "-0.01em" }}>
                {docToDelete.fullName}
              </strong>
            </div>

            {/* Input Verification */}
            <div>
              <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 700, color: "#09090B", marginBottom: "6px" }}>
                Type Full Name to Unlock Delete Button:
              </label>
              <input
                type="text"
                placeholder="Type name exactly as shown above..."
                value={deleteConfirmNameInput}
                onChange={(e) => setDeleteConfirmNameInput(e.target.value)}
                autoFocus
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  border: `2px solid ${
                    deleteConfirmNameInput.trim().toUpperCase() === docToDelete.fullName.trim().toUpperCase()
                      ? "#10B981"
                      : "#D4D4D8"
                  }`,
                  fontSize: "0.95rem",
                  color: "#09090B",
                  outline: "none",
                  backgroundColor: "#FFFFFF"
                }}
              />
              {deleteConfirmNameInput.length > 0 && deleteConfirmNameInput.trim().toUpperCase() !== docToDelete.fullName.trim().toUpperCase() && (
                <span style={{ fontSize: "0.775rem", color: "#DC2626", marginTop: "4px", display: "block", fontWeight: 600 }}>
                  ✕ Name does not match yet.
                </span>
              )}
              {deleteConfirmNameInput.trim().toUpperCase() === docToDelete.fullName.trim().toUpperCase() && (
                <span style={{ fontSize: "0.775rem", color: "#059669", marginTop: "4px", display: "block", fontWeight: 600 }}>
                  ✓ Name verified. Click button below to delete.
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => {
                  setDocToDelete(null);
                  setDeleteConfirmNameInput("");
                }}
                style={{
                  padding: "12px 22px",
                  borderRadius: "9999px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #D4D4D8",
                  color: "#09090B",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteConfirmNameInput.trim().toUpperCase() !== docToDelete.fullName.trim().toUpperCase()}
                style={{
                  padding: "12px 24px",
                  borderRadius: "9999px",
                  backgroundColor: deleteConfirmNameInput.trim().toUpperCase() === docToDelete.fullName.trim().toUpperCase() ? "#DC2626" : "#E4E4E7",
                  color: deleteConfirmNameInput.trim().toUpperCase() === docToDelete.fullName.trim().toUpperCase() ? "#FFFFFF" : "#A1A1AA",
                  border: "none",
                  fontWeight: 800,
                  fontSize: "0.875rem",
                  cursor: deleteConfirmNameInput.trim().toUpperCase() === docToDelete.fullName.trim().toUpperCase() ? "pointer" : "not-allowed",
                  boxShadow: deleteConfirmNameInput.trim().toUpperCase() === docToDelete.fullName.trim().toUpperCase() ? "0 4px 14px rgba(220, 38, 38, 0.25)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIXED MOBILE BOTTOM NAVIGATION BAR (SVG VECTOR ICONS ONLY) */}
      <nav className="staff-mobile-bottom-nav">
        <button
          type="button"
          className={`staff-bottom-tab-btn ${activeNav === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveNav("dashboard")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          <span>Dash</span>
        </button>

        <button
          type="button"
          className={`staff-bottom-tab-btn ${activeNav === "queue" ? "active" : ""}`}
          onClick={() => setActiveNav("queue")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 8v4l3 3"/>
            <circle cx="12" cy="12" r="9"/>
          </svg>
          <span>Queue</span>
          {pendingCount > 0 && (
            <span className="staff-bottom-tab-badge">{pendingCount}</span>
          )}
        </button>

        <button
          type="button"
          className={`staff-bottom-tab-btn ${activeNav === "registry" ? "active" : ""}`}
          onClick={() => setActiveNav("registry")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span>Registry</span>
        </button>

        <button
          type="button"
          className={`staff-bottom-tab-btn ${activeNav === "scanner" ? "active" : ""}`}
          onClick={() => setActiveNav("scanner")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="7" y="7" width="10" height="10" rx="1"/>
            <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
            <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
            <path d="M17 21h2a2 2 0 0 0 2-2v-2"/>
            <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
          </svg>
          <span>Scan</span>
        </button>

        <button
          type="button"
          className={`staff-bottom-tab-btn ${activeNav === "create" ? "active" : ""}`}
          onClick={handleOpenBlankSplitView}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>New</span>
        </button>
        <button
          type="button"
          className={`staff-bottom-tab-btn ${activeNav === "settings" ? "active" : ""}`}
          onClick={() => setActiveNav("settings")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>Config</span>
        </button>
      </nav>
    </div>
  );
}
