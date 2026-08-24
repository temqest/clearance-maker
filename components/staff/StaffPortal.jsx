"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMock } from "../../lib/mockStore";
import { buildActualDocumentHtml } from "../../lib/documentHtmlBuilder";
import { defaultClearanceData } from "../../lib/defaultClearanceData";
import EditorPanel from "../editor/EditorPanel";
import PreviewPanel from "../preview/PreviewPanel";
import { decodeQrFromImageData, decodeQrFromImageFile } from "../../lib/qrScannerHelper";

export default function StaffPortal({ headerSearchQuery = "", onLogout }) {
  const router = useRouter();
  const { documents, markAsPrinted, createStaffDocument, deleteDocument, lookupDocument } = useMock();

  // Active sidebar navigation pill
  const [activeNav, setActiveNav] = useState("dashboard"); // 'dashboard' | 'queue' | 'registry' | 'scanner' | 'create'
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
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

  const effectiveSearch = headerSearchQuery || searchTerm;

  // Statistics
  const totalCount = documents.length;
  const pendingCount = documents.filter((d) => d.status.includes("Pending")).length;
  const releasedCount = documents.filter((d) => d.status.includes("Released") || d.status.includes("Printed")).length;
  const totalRevenue = documents.length * 150;

  // Priority Sort: Surface pending/actionable items at the top of the queue
  const sortedDocs = [...documents].sort((a, b) => {
    const aIsPending = a.status.includes("Pending") ? 0 : 1;
    const bIsPending = b.status.includes("Pending") ? 0 : 1;
    return aIsPending - bIsPending;
  });

  // Filter documents
  const filteredDocs = sortedDocs.filter((doc) => {
    const matchesSearch =
      doc.fullName.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
      doc.id.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
      doc.paymentNo.toLowerCase().includes(effectiveSearch.toLowerCase());

    if (statusFilter === "pending") return matchesSearch && doc.status.includes("Pending");
    if (statusFilter === "released") return matchesSearch && (doc.status.includes("Released") || doc.status.includes("Printed"));
    return matchesSearch;
  });

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
    setFormData({
      ...defaultClearanceData,
      fullName: doc.fullName || "",
      address: doc.address || "",
      purpose: doc.purpose || "",
      civilStatus: doc.civilStatus || "Single",
      orNo: doc.orNumber || doc.paymentNo || "PAY-2026-8921",
      issuedOn: doc.dateRequested || new Date().toLocaleDateString(),
    });
    setActiveNav("create");
  };

  // Reset form and open blank split view
  const handleOpenBlankSplitView = () => {
    setInspectedDoc(null);
    setFormData(defaultClearanceData);
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

    const created = createStaffDocument({
      fullName: formData.fullName.toUpperCase(),
      address: formData.address || "",
      purpose: formData.purpose || "LOCAL EMPLOYMENT",
      civilStatus: formData.civilStatus || "Single",
      documentType: "Barangay / Police Clearance",
      amountPaid: "₱150.00"
    });

    handlePrintActualDocument(created);
    setInspectedDoc(null);
    setActiveNav("queue");
  };

  // Handle scanned string payload
  const handleProcessScannedText = (text) => {
    if (!text) return;
    let refId = text.trim();
    try {
      const parsed = JSON.parse(text);
      if (parsed && parsed.id) refId = parsed.id;
    } catch (err) {}

    setScannerInput(refId);
    const match = lookupDocument(refId);
    if (match) {
      setScannedDocMatch(match);
      setCameraStatus(`Match verified: ${match.id}`);
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
      const previewData = {
        fullName: doc.fullName || formData.fullName,
        address: doc.address || formData.address,
        purpose: doc.purpose || formData.purpose,
        civilStatus: doc.civilStatus || formData.civilStatus || "Single",
        orNo: doc.orNumber || doc.paymentNo || formData.orNo || "PAY-2026-8921",
        issuedOn: doc.dateRequested || formData.issuedOn || new Date().toLocaleDateString(),
        documentType: doc.documentType || "Barangay / Police Clearance"
      };

      const fullHtml = await buildActualDocumentHtml(previewData, photoSrc);

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
    <div className="staff-layout-container" style={{ display: "flex", minHeight: "calc(100vh - 61px)", backgroundColor: "#F3F4F6" }}>
      {/* SIDEBAR NAVIGATION (Light Neutral Background so Primary Action pops) */}
      <aside className="staff-sidebar-aside" style={{
        width: "250px",
        backgroundColor: "#FFFFFF",
        borderRight: "1px solid #E4E4E7",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        flexShrink: 0
      }}>
        <div>
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
          </nav>
        </div>

        {/* BOTTOM SIDEBAR USER PROFILE CARD */}
        <div style={{
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
      <main style={{ flex: 1, padding: "28px 36px", overflowY: "auto" }}>

        {/* 1. DASHBOARD OVERVIEW */}
        {activeNav === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* ACTION & STATUS HEADER (Front-loading stats and establishing button priority) */}
            <div style={{
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

                {/* UTILITY ACTION: + Clearance Document (Outlined Pill - Rare creation) */}
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
                  + Clearance Document
                </button>
              </div>
            </div>

            {/* REAL-TIME COUNTER STAT CARDS GRID (Task-focused Operational Metrics) */}
            <div style={{
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

              {/* TABLE */}
              <div style={{ borderRadius: "14px", border: "1px solid #E4E4E7", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#FAF9F6", borderBottom: "1px solid #E4E4E7", color: "#71717A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      <th style={{ padding: "14px 18px" }}>Doc ID</th>
                      <th style={{ padding: "14px 18px" }}>Constituent Name</th>
                      <th style={{ padding: "14px 18px" }}>Purpose</th>
                      <th style={{ padding: "14px 18px" }}>Status</th>
                      <th style={{ padding: "14px 18px", textAlign: "right" }}>Next Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.map((doc) => {
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
                          <td style={{ padding: "14px 18px", fontWeight: 800, fontFamily: "monospace", color: "#09090B" }}>
                            {doc.id}
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            <div style={{ fontWeight: 700, color: "#09090B" }}>{doc.fullName}</div>
                            <div style={{ fontSize: "0.775rem", color: "#71717A" }}>{doc.address}</div>
                          </td>
                          <td style={{ padding: "14px 18px", color: "#52525B" }}>{doc.purpose}</td>
                          <td style={{ padding: "14px 18px" }}>
                            <span style={{
                              padding: "4px 10px",
                              borderRadius: "9999px",
                              fontSize: "0.725rem",
                              fontWeight: 800,
                              backgroundColor: isPending ? "#FEF3C7" : "#ECFDF5",
                              color: isPending ? "#D97706" : "#065F46",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: isPending ? "#D97706" : "#059669" }}></span>
                              {doc.status}
                            </span>
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "right" }}>
                            {/* DYNAMIC CONTEXT-AWARE BUTTON ACTION & DELETE */}
                            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                              {isPending ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePrintActualDocument(doc);
                                  }}
                                  style={{
                                    padding: "7px 18px",
                                    backgroundColor: "#09090B",
                                    color: "#FFFFFF",
                                    border: "none",
                                    borderRadius: "9999px",
                                    fontWeight: 700,
                                    fontSize: "0.8rem",
                                    cursor: "pointer",
                                    boxShadow: "0 2px 8px rgba(9, 9, 11, 0.12)"
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
                                    padding: "7px 16px",
                                    backgroundColor: "#FFFFFF",
                                    color: "#09090B",
                                    border: "1px solid #D4D4D8",
                                    borderRadius: "9999px",
                                    fontWeight: 600,
                                    fontSize: "0.8rem",
                                    cursor: "pointer"
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
                                  padding: "7px 10px",
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
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                placeholder="Filter by constituent name, Doc ID, or Payment Ref..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
                  onClick={() => setStatusFilter("all")}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "9999px",
                    border: "1px solid #D4D4D8",
                    backgroundColor: statusFilter === "all" ? "#09090B" : "#FFFFFF",
                    color: statusFilter === "all" ? "#FFFFFF" : "#09090B",
                    fontWeight: 700,
                    fontSize: "0.825rem",
                    cursor: "pointer"
                  }}
                >
                  All Applications ({documents.length})
                </button>
                <button
                  onClick={() => setStatusFilter("pending")}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "9999px",
                    border: "1px solid #D4D4D8",
                    backgroundColor: statusFilter === "pending" ? "#09090B" : "#FFFFFF",
                    color: statusFilter === "pending" ? "#FFFFFF" : "#09090B",
                    fontWeight: 700,
                    fontSize: "0.825rem",
                    cursor: "pointer"
                  }}
                >
                  Pending Only ({pendingCount})
                </button>
              </div>
            </div>

            <div className="responsive-table-wrapper" style={{ backgroundColor: "#FFFFFF", borderRadius: "20px", border: "1px solid #E4E4E7", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "#FAF9F6", borderBottom: "1px solid #E4E4E7", color: "#71717A", fontSize: "0.775rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <th style={{ padding: "16px 20px" }}>Doc ID</th>
                    <th style={{ padding: "16px 20px" }}>Constituent Name</th>
                    <th style={{ padding: "16px 20px" }}>Document Type</th>
                    <th style={{ padding: "16px 20px" }}>Payment Ref</th>
                    <th style={{ padding: "16px 20px" }}>Status</th>
                    <th style={{ padding: "16px 20px", textAlign: "right" }}>Next Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc) => {
                    const isPending = doc.status.includes("Pending");
                    return (
                      <tr
                        key={doc.id}
                        onClick={() => handleOpenDocumentSplitView(doc)}
                        style={{
                          borderBottom: "1px solid #F4F4F5",
                          fontSize: "0.925rem",
                          cursor: "pointer",
                          backgroundColor: isPending ? "#FFFDF5" : "#FFFFFF"
                        }}
                      >
                        <td style={{ padding: "16px 20px", fontWeight: 800, color: "#09090B", fontFamily: "monospace" }}>{doc.id}</td>
                        <td style={{ padding: "16px 20px" }}>
                          <div style={{ fontWeight: 700, color: "#09090B" }}>{doc.fullName}</div>
                          <div style={{ fontSize: "0.8rem", color: "#71717A", marginTop: "2px" }}>{doc.purpose}</div>
                        </td>
                        <td style={{ padding: "16px 20px", color: "#52525B" }}>{doc.documentType}</td>
                        <td style={{ padding: "16px 20px", fontFamily: "monospace", fontSize: "0.85rem", color: "#71717A" }}>{doc.paymentNo}</td>
                        <td style={{ padding: "16px 20px" }}>
                          <span style={{
                            padding: "6px 14px",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            backgroundColor: isPending ? "#FEF3C7" : "#ECFDF5",
                            color: isPending ? "#D97706" : "#065F46"
                          }}>
                            {doc.status}
                          </span>
                        </td>
                        <td style={{ padding: "16px 20px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                            {isPending ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePrintActualDocument(doc);
                                }}
                                style={{
                                  padding: "8px 18px",
                                  backgroundColor: "#09090B",
                                  color: "#FFFFFF",
                                  border: "none",
                                  borderRadius: "9999px",
                                  fontWeight: 700,
                                  fontSize: "0.825rem",
                                  cursor: "pointer"
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
                                  padding: "8px 18px",
                                  backgroundColor: "#FFFFFF",
                                  color: "#09090B",
                                  border: "1px solid #D4D4D8",
                                  borderRadius: "9999px",
                                  fontWeight: 600,
                                  fontSize: "0.825rem",
                                  cursor: "pointer"
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
                                padding: "8px 10px",
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
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: "280px",
                  padding: "12px 18px",
                  borderRadius: "12px",
                  border: "1px solid #D4D4D8",
                  fontSize: "0.95rem",
                  outline: "none"
                }}
              />

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

            <div className="responsive-table-wrapper" style={{ backgroundColor: "#FFFFFF", borderRadius: "20px", border: "1px solid #E4E4E7", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "#FAF9F6", borderBottom: "1px solid #E4E4E7", color: "#71717A", fontSize: "0.775rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <th style={{ padding: "16px 20px" }}>Doc ID</th>
                    <th style={{ padding: "16px 20px" }}>Full Name</th>
                    <th style={{ padding: "16px 20px" }}>Document Type</th>
                    <th style={{ padding: "16px 20px" }}>Purpose</th>
                    <th style={{ padding: "16px 20px" }}>Date Requested</th>
                    <th style={{ padding: "16px 20px" }}>Status</th>
                    <th style={{ padding: "16px 20px", textAlign: "right" }}>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => handleOpenDocumentSplitView(doc)}
                      style={{ borderBottom: "1px solid #F4F4F5", fontSize: "0.925rem", cursor: "pointer" }}
                    >
                      <td style={{ padding: "16px 20px", fontWeight: 800, fontFamily: "monospace", color: "#09090B" }}>{doc.id}</td>
                      <td style={{ padding: "16px 20px", fontWeight: 700, color: "#09090B" }}>{doc.fullName}</td>
                      <td style={{ padding: "16px 20px", color: "#52525B" }}>{doc.documentType}</td>
                      <td style={{ padding: "16px 20px", color: "#52525B" }}>{doc.purpose}</td>
                      <td style={{ padding: "16px 20px", color: "#71717A", fontSize: "0.875rem" }}>{doc.dateRequested}</td>
                      <td style={{ padding: "16px 20px" }}>
                        <span style={{
                          padding: "6px 14px",
                          borderRadius: "9999px",
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          backgroundColor: doc.status.includes("Printed") || doc.status.includes("Released") ? "#ECFDF5" : "#FEF3C7",
                          color: doc.status.includes("Printed") || doc.status.includes("Released") ? "#065F46" : "#D97706"
                        }}>
                          {doc.status}
                        </span>
                      </td>
                      <td style={{ padding: "16px 20px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
                          <button
                            onClick={() => handleOpenDocumentSplitView(doc)}
                            style={{
                              padding: "6px 14px",
                              backgroundColor: "#FFFFFF",
                              color: "#09090B",
                              border: "1px solid #D4D4D8",
                              borderRadius: "9999px",
                              fontWeight: 600,
                              fontSize: "0.8rem",
                              cursor: "pointer"
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
                              padding: "6px 10px",
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
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
            {/* TOP NAVIGATION BACK BUTTON */}
            <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
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
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
                }}
              >
                ← Back to Queue
              </button>

              {inspectedDoc && (
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "0.85rem", color: "#71717A", fontWeight: 600 }}>
                    Editing Document: <strong style={{ color: "#09090B", fontFamily: "monospace" }}>{inspectedDoc.id}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDocToDelete(inspectedDoc);
                      setDeleteConfirmNameInput("");
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "9999px",
                      backgroundColor: "#FEF2F2",
                      color: "#DC2626",
                      border: "1px solid #FCA5A5",
                      fontWeight: 700,
                      fontSize: "0.775rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    Delete Record
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: "28px", alignItems: "flex-start" }}>
              {/* LEFT FORM COLUMN: EMBEDDED EditorPanel */}
              <div style={{
                backgroundColor: "#FFFFFF",
                padding: "24px",
                borderRadius: "24px",
                border: "1px solid #E4E4E7",
                boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                maxHeight: "calc(100vh - 170px)",
                overflowY: "auto"
              }}>
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
                    marginTop: "12px",
                    boxShadow: "0 4px 14px rgba(9, 9, 11, 0.15)",
                    width: "100%"
                  }}
                >
                  Print & Release Official Clearance →
                </button>
              </div>

              {/* RIGHT COLUMN: FULLY VERTICALLY SCROLLABLE LIVE PREVIEW PAGE */}
              <div style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "24px",
                border: "1px solid #E4E4E7",
                padding: "24px",
                height: "calc(100vh - 170px)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
                display: "flex",
                flexDirection: "column"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexShrink: 0 }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#D97706", backgroundColor: "#FEF3C7", padding: "4px 12px", borderRadius: "9999px" }}>
                    LIVE CLEARANCE PREVIEW (8.5" x 13" OFFICIAL RTC CERTIFICATE)
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "#71717A", fontWeight: 600 }}>
                    Scrollable Document View
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
    </div>
  );
}
