"use client";

import React, { useState, useEffect, useRef } from "react";
import { useMock } from "../../lib/mockStore";
import PreviewPanel from "../preview/PreviewPanel";
import { defaultClearanceData } from "../../lib/defaultClearanceData";
import { buildActualDocumentHtml } from "../../lib/documentHtmlBuilder";
import { exportClearanceDocx } from "../../lib/exportDocx";
import { generateQrDataUrl } from "../../lib/qrGenerator";
import { decodeQrFromImageData, decodeQrFromImageFile } from "../../lib/qrScannerHelper";

export default function UserPortal() {
  const { userPayment, setUserPayment, userDocument, setUserDocument, submitUserDocument, resetAllStore } = useMock();

  // Payment form local state
  const [paymentNoInput, setPaymentNoInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isReceiptScannerOpen, setIsReceiptScannerOpen] = useState(false);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [receiptScanStatus, setReceiptScanStatus] = useState("");
  const receiptVideoRef = useRef(null);
  const [photoSrc, setPhotoSrc] = useState("");
  const [realQrUrl, setRealQrUrl] = useState("");
  const [isFullscreenPreviewOpen, setIsFullscreenPreviewOpen] = useState(false);
  const [fullscreenZoomMode, setFullscreenZoomMode] = useState("fit");
  const stepContainerRef = useRef(null);

  useEffect(() => {
    if (userDocument?.id) {
      const payload = userDocument.id;
      generateQrDataUrl(payload, { width: 300 }).then((url) => {
        if (url) setRealQrUrl(url);
      });
    }
  }, [userDocument]);

  const [formData, setFormData] = useState({
    lastName: "",
    firstName: "",
    middleName: "",
    birthDate: "",
    birthPlace: "",
    gender: "Male",
    citizenship: "Filipino",
    contactNo: "",
    address: "",
    purpose: "",
    civilStatus: "Single",
    documentType: "Official Clearance Document",
  });

  // Restore local portal state from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedInput = localStorage.getItem("clearance_user_payment_input");
      if (savedInput) setPaymentNoInput(JSON.parse(savedInput));

      const savedPhoto = localStorage.getItem("clearance_user_photo_src");
      if (savedPhoto) setPhotoSrc(JSON.parse(savedPhoto));

      const savedForm = localStorage.getItem("clearance_user_form_data");
      if (savedForm) setFormData(JSON.parse(savedForm));
    } catch (e) {
      console.error("Failed restoring saved portal state:", e);
    }
  }, []);



  // Save changes to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("clearance_user_payment_input", JSON.stringify(paymentNoInput));
    } catch (err) {}
  }, [paymentNoInput]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("clearance_user_photo_src", JSON.stringify(photoSrc));
    } catch (err) {}
  }, [photoSrc]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("clearance_user_form_data", JSON.stringify(formData));
    } catch (err) {}
  }, [formData]);

  // Handle Scanned Receipt QR Text
  const handleProcessScannedReceipt = (text) => {
    if (!text) return;
    let cleanCode = text.trim();
    try {
      const parsed = JSON.parse(text);
      if (parsed && (parsed.paymentNo || parsed.id)) {
        cleanCode = parsed.paymentNo || parsed.id;
      }
    } catch (err) {}

    setPaymentNoInput(cleanCode);
    setUserPayment({
      paymentNo: cleanCode,
      amount: "₱150.00",
      isPaid: true,
      verifiedAt: new Date().toLocaleTimeString(),
    });
    setIsScanningReceipt(false);
    setIsReceiptScannerOpen(false);
  };

  // Real Receipt Camera Scanner Loop
  useEffect(() => {
    let stream = null;
    let animId = null;

    if (isReceiptScannerOpen && isScanningReceipt) {
      setReceiptScanStatus("Accessing webcam...");
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" } })
        .then((s) => {
          stream = s;
          if (receiptVideoRef.current) {
            receiptVideoRef.current.srcObject = stream;
            receiptVideoRef.current.play();
          }
          setReceiptScanStatus("Webcam active. Align receipt QR...");

          const scanCanvas = document.createElement("canvas");
          const scanCtx = scanCanvas.getContext("2d");

          const tick = () => {
            if (receiptVideoRef.current && receiptVideoRef.current.readyState === receiptVideoRef.current.HAVE_ENOUGH_DATA) {
              scanCanvas.width = receiptVideoRef.current.videoWidth;
              scanCanvas.height = receiptVideoRef.current.videoHeight;
              scanCtx.drawImage(receiptVideoRef.current, 0, 0, scanCanvas.width, scanCanvas.height);
              const imageData = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
              const decoded = decodeQrFromImageData(imageData);
              if (decoded) {
                handleProcessScannedReceipt(decoded);
                return;
              }
            }
            animId = requestAnimationFrame(tick);
          };
          animId = requestAnimationFrame(tick);
        })
        .catch((err) => {
          console.warn("Receipt camera error:", err);
          setReceiptScanStatus("Camera unavailable. Use image file upload below.");
          setIsScanningReceipt(false);
        });
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isReceiptScannerOpen, isScanningReceipt]);

  const handleStartReceiptScan = () => {
    setIsReceiptScannerOpen(true);
    setIsScanningReceipt(true);
  };

  const handleReceiptQrFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptScanStatus("Reading uploaded image...");
    const decoded = await decodeQrFromImageFile(file);
    if (decoded) {
      handleProcessScannedReceipt(decoded);
    } else {
      setReceiptScanStatus("Could not find a valid QR Code in image.");
      alert("No valid QR Code detected in uploaded image.");
    }
  };

  const [isPreviewingDoc, setIsPreviewingDoc] = useState(false);

  // Download handlers for Step 4 (QR Pass & Clearance Document in PNG/PDF)
  const handleDownloadQrPng = async (doc) => {
    try {
      const qrDataUrl = realQrUrl || (await generateQrDataUrl(doc.id || "CLR-2026", { width: 400 }));
      if (!qrDataUrl) return;

      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 500;
        canvas.height = 620;
        const ctx = canvas.getContext("2d");

        // White background
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Header Title
        ctx.fillStyle = "#09090B";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("DIGITAL COUNTER QR PASS", 250, 45);

        ctx.fillStyle = "#71717A";
        ctx.font = "13px sans-serif";
        ctx.fillText("Regional Trial Court Clearance Portal", 250, 68);

        // Draw real QR Code image
        ctx.drawImage(image, 100, 90, 300, 300);

        // Ref ID Box
        ctx.fillStyle = "#FAF9F6";
        ctx.strokeStyle = "#E4E4E7";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(80, 410, 340, 50, 12);
        } else {
          ctx.rect(80, 410, 340, 50);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#09090B";
        ctx.font = "bold 22px monospace";
        ctx.fillText(doc.id || "CLR-2026-0001", 250, 442);

        // Applicant Details
        ctx.fillStyle = "#09090B";
        ctx.font = "bold 16px sans-serif";
        ctx.fillText(doc.fullName || "APPLICANT NAME", 250, 495);

        ctx.fillStyle = "#52525B";
        ctx.font = "13px sans-serif";
        ctx.fillText(`${doc.documentType || "Clearance Pass"} | ${doc.purpose || "Official Purpose"}`, 250, 520);
        ctx.fillText(`Payment Ref: ${doc.paymentNo || "PAY-2026"}`, 250, 545);
        ctx.fillText(`Date: ${doc.dateRequested || new Date().toLocaleDateString()}`, 250, 570);

        const pngData = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngData;
        downloadLink.download = `${(doc.fullName || "Clearance").replace(/[^a-zA-Z0-9]/g, "_")}_QR_Pass.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      };
      image.src = qrDataUrl;
    } catch (err) {
      console.error("Failed to generate QR Pass PNG", err);
    }
  };

  const handleDownloadQrPdf = async (doc) => {
    try {
      const qrDataUrl = realQrUrl || (await generateQrDataUrl(doc.id || "CLR-2026", { width: 400 }));
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>QR Pass - ${doc.id || "Clearance"}</title>
            <style>
              @page { size: A4 portrait; margin: 20mm; }
              body { font-family: system-ui, -apple-system, sans-serif; text-align: center; color: #09090B; padding: 30px; background: #ffffff; }
              .card { border: 2px solid #09090B; border-radius: 20px; padding: 40px; max-width: 440px; margin: 0 auto; background: #fff; }
              .badge { display: inline-block; background: #09090B; color: #fff; font-size: 11px; font-weight: 800; padding: 6px 16px; border-radius: 99px; text-transform: uppercase; margin-bottom: 16px; letter-spacing: 0.05em; }
              h2 { margin: 0 0 6px; font-size: 22px; }
              p { color: #52525B; font-size: 13px; margin: 0 0 24px; }
              .qr-box { background: #FAF9F6; border: 1px solid #E4E4E7; border-radius: 16px; padding: 24px; display: inline-block; margin-bottom: 24px; }
              .ref-id { font-family: monospace; font-size: 24px; font-weight: 800; margin-top: 14px; letter-spacing: 0.05em; }
              .details { text-align: left; background: #FAF9F6; border: 1px solid #E4E4E7; padding: 18px; border-radius: 14px; font-size: 13px; line-height: 1.7; }
              .details-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
              .details-label { color: #71717A; font-weight: 600; }
              .details-val { color: #09090B; font-weight: 700; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="badge">Digital Counter QR Pass</div>
              <h2>Regional Trial Court Clearance Pass</h2>
              <p>Present this QR pass code at Counter 3 for fast-track clearance certificate printing.</p>
              <div class="qr-box">
                <img src="${qrDataUrl}" width="220" height="220" style="display: block; margin: 0 auto; border-radius: 8px;" />
                <div class="ref-id">${doc.id || "CLR-2026-0001"}</div>
              </div>
              <div class="details">
                <div class="details-row"><span class="details-label">Applicant:</span><span class="details-val">${doc.fullName || ""}</span></div>
                <div class="details-row"><span class="details-label">Document:</span><span class="details-val">${doc.documentType || ""}</span></div>
                <div class="details-row"><span class="details-label">Purpose:</span><span class="details-val">${doc.purpose || ""}</span></div>
                <div class="details-row"><span class="details-label">Payment Ref:</span><span class="details-val">${doc.paymentNo || ""}</span></div>
                <div class="details-row"><span class="details-label">Issued On:</span><span class="details-val">${doc.dateRequested || new Date().toLocaleDateString()}</span></div>
              </div>
            </div>
          </body>
        </html>
      `;

      let iframe = document.getElementById("hidden-print-iframe");
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "hidden-print-iframe";
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        iframe.style.visibility = "hidden";
        document.body.appendChild(iframe);
      }

      const iframeDoc = iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      const img = iframeDoc.querySelector("img");
      if (img) {
        img.onload = () => {
          setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          }, 200);
        };
      } else {
        setTimeout(() => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        }, 300);
      }
    } catch (err) {
      console.error("Error printing QR Pass PDF", err);
    }
  };

  const handleDownloadDocPdf = async (doc, previewData) => {
    try {
      const fullHtml = await buildActualDocumentHtml(previewData, photoSrc);

      let iframe = document.getElementById("hidden-print-iframe");
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "hidden-print-iframe";
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
            setTimeout(resolve, 1200);
          });
        })
      );

      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 250);
    } catch (err) {
      console.error("Error generating actual document PDF", err);
    }
  };

  const handleDownloadDocxFile = async (doc, previewData) => {
    try {
      await exportClearanceDocx({
        ...previewData,
        sigImageUrl: "",
        photoImageUrl: photoSrc || ""
      });
    } catch (err) {
      console.error("Failed to export DOCX document", err);
      handleDownloadDocPdf(doc, previewData);
    }
  };

  const handleDownloadDocPng = async (doc, previewData) => {
    try {
      const fullHtml = await buildActualDocumentHtml(previewData, photoSrc);
      const printWin = window.open("", "_blank");
      if (!printWin) return;

      printWin.document.write(fullHtml);
      printWin.document.close();
    } catch (err) {
      console.error("Error generating actual document view", err);
    }
  };



  // Handle Payment simulation
  const handleVerifyPayment = (e) => {
    e.preventDefault();
    if (!paymentNoInput.trim()) return;

    setIsVerifying(true);
    setTimeout(() => {
      setUserPayment({
        paymentNo: paymentNoInput.trim().toUpperCase(),
        amount: "₱150.00",
        isPaid: true,
        verifiedAt: new Date().toLocaleTimeString(),
      });
      setIsVerifying(false);
    }, 800);
  };

  const handleSimulateInstantPay = () => {
    const randomPayNo = `PAY-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    setIsVerifying(true);
    setTimeout(() => {
      setUserPayment({
        paymentNo: randomPayNo,
        amount: "₱150.00",
        isPaid: true,
        verifiedAt: new Date().toLocaleTimeString(),
      });
      setIsVerifying(false);
    }, 500);
  };

  // Handle Document submission -> Advances to Step 3 (Digital Preview)
  const handleSubmitDoc = (e) => {
    e.preventDefault();
    if (!formData.lastName.trim() || !formData.firstName.trim() || !formData.address.trim() || !formData.purpose.trim()) {
      alert("Please fill in all required fields marked with an asterisk (*).");
      return;
    }
    setIsPreviewingDoc(true);
  };

  const currentStep = !userPayment ? 1 : !userDocument ? (isPreviewingDoc ? 3 : 2) : 4;

  // Auto-scroll viewable area to the top of the step card when moving next or back
  useEffect(() => {
    if (stepContainerRef.current) {
      const element = stepContainerRef.current;
      const rect = element.getBoundingClientRect();
      const yOffset = -24; // Margin offset below top navbar
      const targetY = window.pageYOffset + rect.top + yOffset;
      
      window.scrollTo({
        top: Math.max(0, targetY),
        behavior: "smooth"
      });
    }
  }, [currentStep]);

  const formattedFullName = formData.lastName.trim()
    ? `${formData.lastName.trim().toUpperCase()}, ${formData.firstName.trim().toUpperCase()}${formData.middleName.trim() ? " " + formData.middleName.trim().toUpperCase() : ""}`
    : "DELA CRUZ, JUAN PEDRO";

  const previewData = {
    ...defaultClearanceData,
    fullName: formattedFullName,
    dob: formData.birthDate || "",
    birthPlace: formData.birthPlace || "",
    gender: formData.gender || "Male",
    nationality: formData.citizenship || "Filipino",
    contactNo: formData.contactNo || "",
    civilStatus: formData.civilStatus || "Single",
    purpose: (formData.purpose || "LOCAL EMPLOYMENT").toUpperCase(),
    address: formData.address || "123 Mabini St., Naga City, Camarines Sur",
    orNo: userPayment?.paymentNo || "PAY-2026-8921",
    issuedOn: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    givenDay: new Date().getDate().toString(),
    givenMonth: new Date().toLocaleDateString("en-US", { month: "long" }),
    givenYear: new Date().getFullYear().toString(),
    givenPlace: "Iriga City, Camarines Sur",
    ctc: `CTC-${Math.floor(10000000 + Math.random() * 90000000)}`,
    certNo: `${Math.floor(100 + Math.random() * 900)}`,
    finding: "NO CRIMINAL OR CIVIL CASE FILED OR PENDING",
  };

  return (
    <div style={{ maxWidth: "920px", margin: "40px auto", padding: "0 24px 80px" }}>
      {/* STEP COUNTER & PROGRESS BAR */}
      <div ref={stepContainerRef} style={{
        backgroundColor: "#FFFFFF",
        borderRadius: "20px",
        padding: "20px 24px",
        border: "1px solid #E4E4E7",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.02)",
        marginBottom: "28px"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <span style={{ fontSize: "0.75rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", color: "#71717A" }}>
              STEP {currentStep} OF 4
            </span>
            <h3 style={{ fontSize: "1.05rem", fontWeight: "800", color: "#09090B", marginTop: "2px" }}>
              {currentStep === 1 && "Payment Reference Verification"}
              {currentStep === 2 && "Clearance Application Details"}
              {currentStep === 3 && "Digital Document Certificate Preview"}
              {currentStep === 4 && "Digital Counter QR Pass"}
            </h3>
          </div>
          <span style={{ fontSize: "0.825rem", fontWeight: "800", color: "#09090B", backgroundColor: "#FAF9F6", padding: "4px 12px", borderRadius: "9999px", border: "1px solid #E4E4E7" }}>
            {Math.round((currentStep / 4) * 100)}% Completed
          </span>
        </div>

        {/* Progress Bar Track */}
        <div style={{
          height: "8px",
          width: "100%",
          backgroundColor: "#F4F4F5",
          borderRadius: "9999px",
          overflow: "hidden",
          border: "1px solid #E4E4E7",
          marginBottom: "14px"
        }}>
          <div style={{
            height: "100%",
            width: `${(currentStep / 4) * 100}%`,
            backgroundColor: "#09090B",
            borderRadius: "9999px",
            transition: "width 0.3s ease"
          }} />
        </div>

        {/* Step Badges Row (Interactive Back Navigation) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px", textAlign: "center" }}>
          <button
            type="button"
            onClick={() => {
              if (currentStep > 1) {
                setUserDocument(null);
                setIsPreviewingDoc(false);
                setUserPayment(null);
              }
            }}
            style={{
              padding: "8px 6px",
              borderRadius: "10px",
              fontSize: "0.75rem",
              fontWeight: "700",
              backgroundColor: currentStep >= 1 ? "#FAF9F6" : "transparent",
              color: currentStep >= 1 ? "#09090B" : "#A1A1AA",
              border: currentStep === 1 ? "1px solid #09090B" : "1px solid #E4E4E7",
              cursor: currentStep > 1 ? "pointer" : "default",
              transition: "all 0.15s ease"
            }}
            title={currentStep > 1 ? "Click to return to Step 1" : ""}
          >
            01 Payment
          </button>

          <button
            type="button"
            onClick={() => {
              if (currentStep > 2) {
                setUserDocument(null);
                setIsPreviewingDoc(false);
              }
            }}
            style={{
              padding: "8px 6px",
              borderRadius: "10px",
              fontSize: "0.75rem",
              fontWeight: "700",
              backgroundColor: currentStep >= 2 ? "#FAF9F6" : "transparent",
              color: currentStep >= 2 ? "#09090B" : "#A1A1AA",
              border: currentStep === 2 ? "1px solid #09090B" : "1px solid #E4E4E7",
              cursor: currentStep > 2 ? "pointer" : "default",
              transition: "all 0.15s ease"
            }}
            title={currentStep > 2 ? "Click to return to Step 2" : ""}
          >
            02 Details
          </button>

          <button
            type="button"
            onClick={() => {
              if (currentStep === 4) {
                setUserDocument(null);
                setIsPreviewingDoc(true);
              }
            }}
            style={{
              padding: "8px 6px",
              borderRadius: "10px",
              fontSize: "0.75rem",
              fontWeight: "700",
              backgroundColor: currentStep >= 3 ? "#FAF9F6" : "transparent",
              color: currentStep >= 3 ? "#09090B" : "#A1A1AA",
              border: currentStep === 3 ? "1px solid #09090B" : "1px solid #E4E4E7",
              cursor: currentStep === 4 ? "pointer" : "default",
              transition: "all 0.15s ease"
            }}
            title={currentStep === 4 ? "Click to return to Step 3 Preview" : ""}
          >
            03 Preview
          </button>

          <div style={{
            padding: "8px 6px",
            borderRadius: "10px",
            fontSize: "0.75rem",
            fontWeight: "700",
            backgroundColor: currentStep === 4 ? "#FAF9F6" : "transparent",
            color: currentStep === 4 ? "#09090B" : "#A1A1AA",
            border: currentStep === 4 ? "1px solid #09090B" : "1px solid transparent"
          }}>
            04 QR Pass
          </div>
        </div>
      </div>

      {/* STEP 1: PAYMENT VERIFICATION */}
      {!userPayment ? (
        <div className="portal-step-card" style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "20px",
          padding: "32px",
          border: "1px solid #E4E4E7",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.02)",
          marginBottom: "32px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
            <div style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              backgroundColor: "#FAF9F6",
              border: "1px solid #E4E4E7",
              color: "#09090B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "800",
              fontSize: "0.95rem"
            }}>01</div>
            <div>
              <h2 style={{ fontSize: "1.35rem", fontWeight: "800", color: "#09090B", letterSpacing: "-0.02em" }}>
                Verify Payment Reference
              </h2>
              <span style={{ fontSize: "0.8rem", color: "#71717A", fontWeight: "600" }}>E-PAYMENT OR MUNICIPAL TREASURY RECEIPT</span>
            </div>
          </div>

          <p style={{ color: "#52525B", fontSize: "0.95rem", marginBottom: "24px", lineHeight: 1.5 }}>
            Payment is handled by an official municipal treasury counter or e-wallet gateway (GCash, Maya, Landbank). Enter your official receipt or e-wallet transaction code below to unlock your clearance form.
          </p>

          <form onSubmit={handleVerifyPayment} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#09090B" }}>
                  Official Receipt Number / E-Wallet Reference Code
                </label>

                {/* Quiet QR Alternative Trigger in Label Row */}
                <button
                  type="button"
                  onClick={handleStartReceiptScan}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#09090B",
                    fontWeight: 700,
                    fontSize: "0.825rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    textDecoration: "underline"
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="14" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                  </svg>
                  Scan QR instead
                </button>
              </div>

              {/* Integrated Input Container with Inline QR Icon Button */}
              <div style={{ position: "relative", width: "100%" }}>
                <input
                  type="text"
                  placeholder="e.g. PAY-2026-8921 or RTC-2026-88492"
                  value={paymentNoInput}
                  onChange={(e) => setPaymentNoInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "16px 52px 16px 20px",
                    borderRadius: "14px",
                    border: "1px solid #D4D4D8",
                    fontSize: "1rem",
                    outline: "none",
                    backgroundColor: "#FFFFFF",
                    color: "#09090B",
                    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)"
                  }}
                />
                <button
                  type="button"
                  onClick={handleStartReceiptScan}
                  title="Scan QR Code from receipt"
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "#FFFFFF",
                    border: "1px solid #E4E4E7",
                    borderRadius: "10px",
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#09090B",
                    transition: "all 0.15s ease"
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="14" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Standalone Primary Submit Action */}
            <button
              type="submit"
              disabled={isVerifying}
              style={{
                width: "100%",
                padding: "16px 32px",
                backgroundColor: "#09090B",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "9999px",
                fontWeight: 700,
                fontSize: "1rem",
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(9, 9, 11, 0.2)",
                transition: "all 0.15s ease",
                minHeight: "52px"
              }}
            >
              {isVerifying ? "Verifying Reference..." : "Verify Payment Reference →"}
            </button>
          </form>

          <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #F4F4F5", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <span style={{ fontSize: "0.85rem", color: "#71717A" }}>Testing payment integration?</span>
            <button
              type="button"
              onClick={handleSimulateInstantPay}
              style={{
                background: "none",
                border: "none",
                color: "#09090B",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
                textDecoration: "underline"
              }}
            >
              Generate Demo Payment Reference Code
            </button>
          </div>
        </div>
      ) : null}

      {/* STEP 2: FILL UP DOCUMENT FORM (Active only when payment verified, not previewing, and document not submitted) */}
      {userPayment && !isPreviewingDoc && !userDocument && (
        <div className="portal-step-card" style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "20px",
          padding: "32px",
          border: "1px solid #E4E4E7",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.02)",
          marginBottom: "32px"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                backgroundColor: "#FAF9F6",
                border: "1px solid #E4E4E7",
                color: "#09090B",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "800",
                fontSize: "0.95rem"
              }}>02</div>
              <div>
                <h2 style={{ fontSize: "1.35rem", fontWeight: "800", color: "#09090B", letterSpacing: "-0.02em" }}>
                  Fill Up Clearance Details
                </h2>
                <span style={{ fontSize: "0.8rem", color: "#71717A", fontWeight: "600" }}>CONSTITUENT INFORMATION</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setUserPayment(null)}
              style={{
                padding: "8px 16px",
                borderRadius: "9999px",
                backgroundColor: "#FAF9F6",
                border: "1px solid #E4E4E7",
                color: "#09090B",
                fontWeight: 700,
                fontSize: "0.825rem",
                cursor: "pointer"
              }}
            >
              ← Back to Payment Verification
            </button>
          </div>

          <form onSubmit={handleSubmitDoc} style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            
            {/* SECTION 1: CLEARANCE REQUEST INFORMATION */}
            <div className="portal-form-section" style={{
              backgroundColor: "#FAF9F6",
              border: "1px solid #E4E4E7",
              borderRadius: "16px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "20px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #E4E4E7", paddingBottom: "12px" }}>
                <span style={{
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  backgroundColor: "#09090B",
                  color: "#FFFFFF",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  textTransform: "uppercase"
                }}>1</span>
                <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#09090B" }}>
                  Clearance Request Details
                </h3>
              </div>

              <div className="portal-form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#09090B", marginBottom: "6px" }}>
                    Document Type <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <select
                    value={formData.documentType}
                    onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      borderRadius: "12px",
                      border: "1px solid #D4D4D8",
                      fontSize: "0.95rem",
                      backgroundColor: "#FFFFFF",
                      color: "#09090B",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)"
                    }}
                  >
                    <option value="Official Clearance Document">Official Clearance Document</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#09090B", marginBottom: "6px" }}>
                    Purpose of Request <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Local Employment"
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      borderRadius: "12px",
                      border: "1px solid #D4D4D8",
                      fontSize: "0.95rem",
                      backgroundColor: "#FFFFFF",
                      color: "#09090B",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)"
                    }}
                  />
                  <span style={{ display: "block", fontSize: "0.775rem", color: "#71717A", marginTop: "6px", fontWeight: 500 }}>
                    Specify exact reason (e.g., Local Employment, Passport Application, Postal ID, Business License).
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 2: PERSONAL IDENTITY & PHOTO */}
            <div className="portal-form-section" style={{
              backgroundColor: "#FAF9F6",
              border: "1px solid #E4E4E7",
              borderRadius: "16px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "20px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #E4E4E7", paddingBottom: "12px" }}>
                <span style={{
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  backgroundColor: "#09090B",
                  color: "#FFFFFF",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  textTransform: "uppercase"
                }}>2</span>
                <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#09090B" }}>
                  Personal Identity Details
                </h3>
              </div>

              {/* COMPACT & BALANCED PHOTO UPLOAD CARD */}
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#09090B", marginBottom: "4px" }}>
                  Applicant ID Photo <span style={{ fontSize: "0.8rem", color: "#71717A", fontWeight: 500 }}>(optional)</span>
                </label>
                <p style={{ fontSize: "0.8rem", color: "#71717A", marginBottom: "14px" }}>
                  Note: 2×2 inch photo for Court & Barangay Clearance; 1×1 inch photo for Police Clearance.
                </p>

                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "20px",
                  backgroundColor: "#FFFFFF",
                  border: "1px dashed #D4D4D8",
                  borderRadius: "14px",
                  maxWidth: "360px",
                  margin: "0 auto",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
                }}>
                  <div style={{
                    width: "110px",
                    height: "110px",
                    borderRadius: "14px",
                    backgroundColor: "#FAF9F6",
                    border: "1px solid #D4D4D8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    marginBottom: "14px"
                  }}>
                    {photoSrc ? (
                      <img src={photoSrc} alt="Applicant Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ textAlign: "center", color: "#71717A", fontSize: "0.75rem", fontWeight: 700 }}>
                        2×2 / 1×1<br />NO PHOTO
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
                    <label style={{
                      padding: "8px 16px",
                      borderRadius: "9999px",
                      backgroundColor: "#09090B",
                      color: "#FFFFFF",
                      fontWeight: 700,
                      fontSize: "0.825rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}>
                      Upload Photo
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => setPhotoSrc(ev.target.result);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>

                    <label style={{
                      padding: "8px 16px",
                      borderRadius: "9999px",
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #D4D4D8",
                      color: "#09090B",
                      fontWeight: 700,
                      fontSize: "0.825rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}>
                      Camera Capture
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => setPhotoSrc(ev.target.result);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {photoSrc && (
                    <button
                      type="button"
                      onClick={() => setPhotoSrc("")}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#DC2626",
                        fontSize: "0.775rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        marginTop: "10px"
                      }}
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
              </div>

              {/* SPLIT NAME FIELDS & CIVIL STATUS */}
              <div className="portal-form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#09090B", marginBottom: "6px" }}>
                    Last Name (Apelyido) <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dela Cruz"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      borderRadius: "12px",
                      border: "1px solid #D4D4D8",
                      fontSize: "0.95rem",
                      backgroundColor: "#FFFFFF",
                      color: "#09090B",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#09090B", marginBottom: "6px" }}>
                    First Name (Pangalan) <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Juan"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      borderRadius: "12px",
                      border: "1px solid #D4D4D8",
                      fontSize: "0.95rem",
                      backgroundColor: "#FFFFFF",
                      color: "#09090B",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#09090B", marginBottom: "6px" }}>
                    Middle Name <span style={{ fontSize: "0.8rem", color: "#71717A", fontWeight: 500 }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Santos"
                    value={formData.middleName}
                    onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      borderRadius: "12px",
                      border: "1px solid #D4D4D8",
                      fontSize: "0.95rem",
                      backgroundColor: "#FFFFFF",
                      color: "#09090B",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#09090B", marginBottom: "6px" }}>
                    Civil Status <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <select
                    value={formData.civilStatus}
                    onChange={(e) => setFormData({ ...formData, civilStatus: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      borderRadius: "12px",
                      border: "1px solid #D4D4D8",
                      fontSize: "0.95rem",
                      backgroundColor: "#FFFFFF",
                      color: "#09090B",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)"
                    }}
                  >
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#09090B", marginBottom: "6px" }}>
                    Date of Birth (Petsa ng Kapanganakan) <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      borderRadius: "12px",
                      border: "1px solid #D4D4D8",
                      fontSize: "0.95rem",
                      backgroundColor: "#FFFFFF",
                      color: "#09090B",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#09090B", marginBottom: "6px" }}>
                    Place of Birth (Lugar ng Kapanganakan)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Iriga City, Camarines Sur"
                    value={formData.birthPlace}
                    onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      borderRadius: "12px",
                      border: "1px solid #D4D4D8",
                      fontSize: "0.95rem",
                      backgroundColor: "#FFFFFF",
                      color: "#09090B",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#09090B", marginBottom: "6px" }}>
                    Sex / Gender (Kasarian) <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      borderRadius: "12px",
                      border: "1px solid #D4D4D8",
                      fontSize: "0.95rem",
                      backgroundColor: "#FFFFFF",
                      color: "#09090B",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)"
                    }}
                  >
                    <option value="Male">Male (Lalaki)</option>
                    <option value="Female">Female (Babae)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#09090B", marginBottom: "6px" }}>
                    Citizenship / Nationality (Pagkamamamayan)
                  </label>
                  <input
                    type="text"
                    placeholder="Filipino"
                    value={formData.citizenship}
                    onChange={(e) => setFormData({ ...formData, citizenship: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      borderRadius: "12px",
                      border: "1px solid #D4D4D8",
                      fontSize: "0.95rem",
                      backgroundColor: "#FFFFFF",
                      color: "#09090B",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#09090B", marginBottom: "6px" }}>
                    Mobile / Contact Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 0917 123 4567"
                    value={formData.contactNo}
                    onChange={(e) => setFormData({ ...formData, contactNo: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      borderRadius: "12px",
                      border: "1px solid #D4D4D8",
                      fontSize: "0.95rem",
                      backgroundColor: "#FFFFFF",
                      color: "#09090B",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)"
                    }}
                  />
                </div>
              </div>
              <span style={{ display: "block", fontSize: "0.775rem", color: "#71717A", fontWeight: 500 }}>
                Enter your official details as they appear on your birth certificate or valid government ID.
              </span>
            </div>

            {/* SECTION 3: LOCATION & RESIDENCE */}
            <div className="portal-form-section" style={{
              backgroundColor: "#FAF9F6",
              border: "1px solid #E4E4E7",
              borderRadius: "16px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "20px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #E4E4E7", paddingBottom: "12px" }}>
                <span style={{
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  backgroundColor: "#09090B",
                  color: "#FFFFFF",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  textTransform: "uppercase"
                }}>3</span>
                <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#09090B" }}>
                  Residence & Contact Address
                </h3>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#09090B", marginBottom: "6px" }}>
                  Complete Address <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Brgy. San Jose, Iriga City"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "14px 18px",
                    borderRadius: "12px",
                    border: "1px solid #D4D4D8",
                    fontSize: "0.95rem",
                    backgroundColor: "#FFFFFF",
                    color: "#09090B",
                    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)"
                  }}
                />
                <span style={{ display: "block", fontSize: "0.775rem", color: "#71717A", marginTop: "6px", fontWeight: 500 }}>
                  Enter your complete address (additional specifics like street or province are optional).
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setUserPayment(null)}
                style={{
                  padding: "16px 28px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #D4D4D8",
                  color: "#09090B",
                  borderRadius: "9999px",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  cursor: "pointer"
                }}
              >
                ← Back
              </button>
              <button
                type="submit"
                style={{
                  flex: 1,
                  minWidth: "220px",
                  padding: "16px 32px",
                  backgroundColor: "#09090B",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "9999px",
                  fontWeight: 700,
                  fontSize: "1rem",
                  cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(9, 9, 11, 0.2)",
                  minHeight: "52px"
                }}
              >
                Preview Generated Certificate →
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 3: DIGITAL DOCUMENT CERTIFICATE PREVIEW */}
      {userPayment && isPreviewingDoc && !userDocument && (
        <div className="portal-step-card" style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "20px",
          padding: "32px",
          border: "1px solid #E4E4E7",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.02)",
          marginBottom: "32px"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                backgroundColor: "#FAF9F6",
                border: "1px solid #E4E4E7",
                color: "#09090B",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "800",
                fontSize: "0.95rem"
              }}>03</div>
              <div>
                <h2 style={{ fontSize: "1.35rem", fontWeight: "800", color: "#09090B", letterSpacing: "-0.02em" }}>
                  Digital Document Certificate Preview
                </h2>
                <span style={{ fontSize: "0.8rem", color: "#71717A", fontWeight: "600" }}>LIVE COURT CLEARANCE DRAFT</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPreviewingDoc(false)}
              style={{
                padding: "8px 16px",
                borderRadius: "9999px",
                backgroundColor: "#FAF9F6",
                border: "1px solid #E4E4E7",
                color: "#09090B",
                fontWeight: 700,
                fontSize: "0.825rem",
                cursor: "pointer"
              }}
            >
              ← Edit Application Details
            </button>
          </div>

          <p style={{ color: "#52525B", fontSize: "0.95rem", marginBottom: "24px", lineHeight: "1.5" }}>
            Review your generated official 8.5x13 Regional Trial Court clearance certificate below before confirming your application.
          </p>

          {/* ACTION TOOLBAR ABOVE DOCUMENT PREVIEW */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "14px",
            flexWrap: "wrap",
            gap: "12px"
          }}>
            <span style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "#52525B",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              textAlign: "center"
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Official 8.5×13 Court Certificate Draft
            </span>

            <button
              type="button"
              onClick={() => setIsFullscreenPreviewOpen(true)}
              style={{
                padding: "8px 18px",
                borderRadius: "9999px",
                backgroundColor: "#09090B",
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: "0.825rem",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                boxShadow: "0 2px 8px rgba(9, 9, 11, 0.15)",
                textAlign: "center"
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 3 21 3 21 9"/>
                <polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/>
                <line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
              <span>Full Screen Document View</span>
            </button>
          </div>

          {/* DOCUMENT PREVIEW WRAPPER */}
          <div style={{
            backgroundColor: "#FAF9F6",
            border: "1px solid #E4E4E7",
            borderRadius: "20px",
            padding: "16px",
            marginBottom: "28px",
            maxHeight: "650px",
            overflowY: "auto",
            boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.02)"
          }}>
            <PreviewPanel formData={previewData} photoSrc={photoSrc} />
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setIsPreviewingDoc(false)}
              style={{
                padding: "16px 28px",
                backgroundColor: "#FFFFFF",
                border: "1px solid #E4E4E7",
                color: "#09090B",
                borderRadius: "9999px",
                fontWeight: 700,
                fontSize: "0.95rem",
                cursor: "pointer"
              }}
            >
              ← Edit Details
            </button>

            <button
              type="button"
              onClick={() => {
                submitUserDocument(formData);
                setIsPreviewingDoc(false);
              }}
              style={{
                flex: 1,
                minWidth: "240px",
                padding: "16px 32px",
                backgroundColor: "#09090B",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "9999px",
                fontWeight: 700,
                fontSize: "1rem",
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(9, 9, 11, 0.2)",
                minHeight: "52px"
              }}
            >
              Confirm & Issue Digital QR Pass →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CREATED DOCUMENT & QR CODE FOR STAFF */}
      {userDocument && (
        <div className="portal-step-card" style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "24px",
          padding: "36px",
          border: "1px solid #E4E4E7",
          boxShadow: "0 12px 32px -4px rgba(0, 0, 0, 0.06)",
          textAlign: "center"
        }}>
          <div style={{
            display: "inline-block",
            padding: "6px 16px",
            borderRadius: "9999px",
            backgroundColor: userDocument.status === "Printed & Released" ? "#ECFDF5" : "#FEF3C7",
            color: userDocument.status === "Printed & Released" ? "#065F46" : "#D97706",
            fontWeight: 800,
            fontSize: "0.825rem",
            marginBottom: "20px",
            letterSpacing: "0.04em"
          }}>
            STATUS: {userDocument.status.toUpperCase()}
          </div>

          <h2 style={{ fontSize: "1.6rem", fontWeight: "800", color: "#09090B", marginBottom: "8px", letterSpacing: "-0.02em" }}>
            Ready for Station Clerk Printing
          </h2>
          <p style={{ color: "#52525B", fontSize: "0.95rem", marginBottom: "28px" }}>
            Present this QR pass code or Reference ID to Counter 3 at the Hall of Justice for rapid certificate issuance.
          </p>

          {/* REAL SCANNABLE QR CODE DISPLAY */}
          <div style={{
            backgroundColor: "#FAF9F6",
            border: "1px solid #E4E4E7",
            borderRadius: "20px",
            padding: "28px",
            display: "inline-block",
            marginBottom: "24px"
          }}>
            {realQrUrl ? (
              <img
                id="clearance-qr-img"
                src={realQrUrl}
                alt={`QR Pass for ${userDocument.id}`}
                style={{ width: "200px", height: "200px", borderRadius: "8px" }}
              />
            ) : (
              <svg id="clearance-qr-svg" width="180" height="180" viewBox="0 0 100 100" style={{ shapeRendering: "crispEdges" }}>
                <rect width="100" height="100" fill="#ffffff" />
                <rect x="10" y="10" width="25" height="25" fill="#09090B" />
                <rect x="15" y="15" width="15" height="15" fill="#ffffff" />
                <rect x="18" y="18" width="9" height="9" fill="#09090B" />
                <rect x="65" y="10" width="25" height="25" fill="#09090B" />
                <rect x="70" y="15" width="15" height="15" fill="#ffffff" />
                <rect x="73" y="18" width="9" height="9" fill="#09090B" />
                <rect x="10" y="65" width="25" height="25" fill="#09090B" />
                <rect x="15" y="70" width="15" height="15" fill="#ffffff" />
                <rect x="18" y="73" width="9" height="9" fill="#09090B" />
                <rect x="42" y="12" width="12" height="6" fill="#09090B" />
                <rect x="40" y="24" width="8" height="12" fill="#09090B" />
                <rect x="12" y="42" width="18" height="6" fill="#09090B" />
                <rect x="45" y="45" width="18" height="18" fill="#09090B" />
                <rect x="70" y="42" width="15" height="8" fill="#09090B" />
                <rect x="40" y="70" width="12" height="12" fill="#09090B" />
                <rect x="68" y="68" width="20" height="20" fill="#09090B" />
              </svg>
            )}
            <div style={{ marginTop: "14px", fontFamily: "monospace", fontSize: "1.2rem", fontWeight: "800", color: "#09090B" }}>
              {userDocument.id}
            </div>
            <div style={{ fontSize: "0.825rem", color: "#71717A", marginTop: "2px" }}>
              Payment Ref: {userDocument.paymentNo}
            </div>
          </div>

          <div style={{ textAlign: "left", backgroundColor: "#FAF9F6", border: "1px solid #E4E4E7", padding: "20px 24px", borderRadius: "16px", fontSize: "0.925rem", color: "#52525B", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div><strong>Applicant:</strong> <span style={{ color: "#09090B" }}>{userDocument.fullName}</span></div>
            <div><strong>Document:</strong> <span style={{ color: "#09090B" }}>{userDocument.documentType}</span></div>
            <div><strong>Purpose:</strong> <span style={{ color: "#09090B" }}>{userDocument.purpose}</span></div>
            <div><strong>Timestamp:</strong> <span style={{ color: "#09090B" }}>{userDocument.dateRequested}</span></div>
          </div>

          {/* DOWNLOAD & EXPORT OPTIONS PANEL (LAST PLACE) */}
          <div style={{
            backgroundColor: "#FAF9F6",
            border: "1px solid #E4E4E7",
            borderRadius: "20px",
            padding: "24px",
            marginTop: "24px",
            textAlign: "left"
          }}>
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "800", color: "#09090B", display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download Offline Copies (PNG & PDF)
              </h3>
              <p style={{ fontSize: "0.825rem", color: "#71717A", marginTop: "2px" }}>
                Save digital copies of your QR pass code and official clearance certificate directly to your device.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
              {/* 1. DIGITAL QR PASS DOWNLOAD GROUP */}
              <div style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E4E4E7",
                borderRadius: "16px",
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "14px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#FAF9F6",
                    border: "1px solid #E4E4E7", display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" rx="1"/>
                      <rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="14" y="14" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.9rem", fontWeight: "700", color: "#09090B" }}>Digital QR Pass</div>
                    <div style={{ fontSize: "0.775rem", color: "#71717A" }}>Counter verification code</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => handleDownloadQrPng(userDocument)}
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      backgroundColor: "#09090B",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: "10px",
                      fontWeight: 700,
                      fontSize: "0.825rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px"
                    }}
                  >
                    PNG Image
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadQrPdf(userDocument)}
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #D4D4D8",
                      color: "#09090B",
                      borderRadius: "10px",
                      fontWeight: 700,
                      fontSize: "0.825rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px"
                    }}
                  >
                    PDF Document
                  </button>
                </div>
              </div>

              {/* 2. CLEARANCE DOCUMENT CERTIFICATE DOWNLOAD GROUP */}
              <div style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E4E4E7",
                borderRadius: "16px",
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "14px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#FAF9F6",
                    border: "1px solid #E4E4E7", display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.9rem", fontWeight: "700", color: "#09090B" }}>Clearance Certificate</div>
                    <div style={{ fontSize: "0.775rem", color: "#71717A" }}>Official 8.5x13 document</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => handleDownloadDocPdf(userDocument, previewData)}
                    style={{
                      flex: 1,
                      minWidth: "90px",
                      padding: "10px 14px",
                      backgroundColor: "#09090B",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: "10px",
                      fontWeight: 700,
                      fontSize: "0.825rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px"
                    }}
                  >
                    PDF Document
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadDocxFile(userDocument, previewData)}
                    style={{
                      flex: 1,
                      minWidth: "90px",
                      padding: "10px 14px",
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #D4D4D8",
                      color: "#09090B",
                      borderRadius: "10px",
                      fontWeight: 700,
                      fontSize: "0.825rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px"
                    }}
                  >
                    DOCX File
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginTop: "24px" }}>
            <button
              onClick={() => setUserDocument(null)}
              style={{
                padding: "14px 28px",
                backgroundColor: "#09090B",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "9999px",
                fontWeight: 700,
                fontSize: "0.95rem",
                cursor: "pointer"
              }}
            >
              ← Edit Application Details
            </button>

            <button
              onClick={() => {
                resetAllStore();
                setPaymentNoInput("");
                setPhotoSrc("");
                setFormData({
                  lastName: "",
                  firstName: "",
                  middleName: "",
                  address: "",
                  purpose: "",
                  civilStatus: "Single",
                  documentType: "Barangay / Police Clearance",
                });
                if (typeof window !== "undefined") {
                  localStorage.removeItem("clearance_user_payment_input");
                  localStorage.removeItem("clearance_user_photo_src");
                  localStorage.removeItem("clearance_user_form_data");
                }
              }}
              style={{
                padding: "14px 28px",
                backgroundColor: "#FFFFFF",
                border: "1px solid #E4E4E7",
                color: "#09090B",
                borderRadius: "9999px",
                fontWeight: 700,
                fontSize: "0.95rem",
                cursor: "pointer"
              }}
            >
              Start New Application
            </button>
          </div>
        </div>
      )}

      {/* RECEIPT QR CODE SCANNER MODAL */}
      {isReceiptScannerOpen && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(9, 9, 11, 0.65)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <div style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "24px",
            width: "100%",
            maxWidth: "500px",
            padding: "32px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            textAlign: "center"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.3rem", fontWeight: "800", color: "#09090B" }}>Scan Treasury Receipt QR</h3>
              <button
                onClick={() => setIsReceiptScannerOpen(false)}
                style={{ background: "#F4F4F5", border: "none", width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", color: "#52525B", fontWeight: 700 }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: "#52525B", fontSize: "0.9rem", marginBottom: "24px", lineHeight: "1.5" }}>
              Align your municipal receipt or e-wallet QR code in the webcam viewfinder below, or upload a receipt photo.
            </p>

            {/* Viewfinder Graphic / Video Element */}
            <div style={{
              position: "relative",
              width: "260px",
              height: "260px",
              margin: "0 auto 20px",
              borderRadius: "20px",
              border: "2px solid #09090B",
              backgroundColor: "#FAF9F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden"
            }}>
              {/* Corner Reticles */}
              <div style={{ position: "absolute", top: 10, left: 10, width: 20, height: 20, borderTop: "3px solid #09090B", borderLeft: "3px solid #09090B", zIndex: 10 }} />
              <div style={{ position: "absolute", top: 10, right: 10, width: 20, height: 20, borderTop: "3px solid #09090B", borderRight: "3px solid #09090B", zIndex: 10 }} />
              <div style={{ position: "absolute", bottom: 10, left: 10, width: 20, height: 20, borderBottom: "3px solid #09090B", borderLeft: "3px solid #09090B", zIndex: 10 }} />
              <div style={{ position: "absolute", bottom: 10, right: 10, width: 20, height: 20, borderBottom: "3px solid #09090B", borderRight: "3px solid #09090B", zIndex: 10 }} />

              {isScanningReceipt ? (
                <video
                  ref={receiptVideoRef}
                  playsInline
                  muted
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "16px" }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#09090B" strokeWidth="1.5">
                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="14" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                  </svg>
                  <span style={{ fontSize: "0.825rem", color: "#52525B" }}>{receiptScanStatus || "Scanner paused"}</span>
                </div>
              )}
            </div>

            <div style={{ fontSize: "0.875rem", fontWeight: "700", color: "#09090B", marginBottom: "16px" }}>
              {receiptScanStatus || "Webcam Active — Detecting QR..."}
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setIsScanningReceipt((prev) => !prev)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "9999px",
                  border: "none",
                  backgroundColor: isScanningReceipt ? "#EF4444" : "#09090B",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer"
                }}
              >
                {isScanningReceipt ? "Stop Camera" : "Start Camera"}
              </button>

              <label style={{
                padding: "10px 20px",
                borderRadius: "9999px",
                border: "1px solid #D4D4D8",
                backgroundColor: "#FFFFFF",
                color: "#09090B",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer"
              }}>
                Upload QR Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleReceiptQrFileUpload}
                  style={{ display: "none" }}
                />
              </label>

              <button
                type="button"
                onClick={() => setIsReceiptScannerOpen(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "9999px",
                  border: "1px solid #E4E4E7",
                  backgroundColor: "#F4F4F5",
                  color: "#52525B",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN DOCUMENT PREVIEW OVERLAY MODAL */}
      {isFullscreenPreviewOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          backgroundColor: "rgba(9, 9, 11, 0.92)",
          backdropFilter: "blur(8px)",
          display: "flex",
          flexDirection: "column"
        }}>
          {/* Modal Header */}
          <div style={{
            padding: "14px 20px",
            backgroundColor: "#09090B",
            borderBottom: "1px solid #27272A",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#FFFFFF",
            flexWrap: "wrap",
            gap: "10px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{
                backgroundColor: "#27272A",
                color: "#FAF9F6",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 800
              }}>8.5 × 13 LEGAL DRAFT</span>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, margin: 0, color: "#FFFFFF" }}>
                Full Court Certificate View
              </h3>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {/* Zoom mode toggle: Fit Screen vs Actual 100% */}
              <div style={{ display: "flex", backgroundColor: "#18181B", padding: "3px", borderRadius: "9999px", border: "1px solid #27272A" }}>
                <button
                  type="button"
                  onClick={() => setFullscreenZoomMode("fit")}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "9999px",
                    border: "none",
                    backgroundColor: fullscreenZoomMode === "fit" ? "#FFFFFF" : "transparent",
                    color: fullscreenZoomMode === "fit" ? "#09090B" : "#A1A1AA",
                    fontWeight: 700,
                    fontSize: "0.775rem",
                    cursor: "pointer"
                  }}
                >
                  Fit Screen
                </button>
                <button
                  type="button"
                  onClick={() => setFullscreenZoomMode("full")}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "9999px",
                    border: "none",
                    backgroundColor: fullscreenZoomMode === "full" ? "#FFFFFF" : "transparent",
                    color: fullscreenZoomMode === "full" ? "#09090B" : "#A1A1AA",
                    fontWeight: 700,
                    fontSize: "0.775rem",
                    cursor: "pointer"
                  }}
                >
                  100% Size
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsFullscreenPreviewOpen(false)}
                style={{
                  padding: "8px 18px",
                  borderRadius: "9999px",
                  backgroundColor: "#FFFFFF",
                  color: "#09090B",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Modal Main Document Container */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 12px",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start"
          }}>
            <div style={{ width: "100%", maxWidth: "860px" }}>
              <PreviewPanel
                formData={previewData}
                photoSrc={photoSrc}
                disableAutoFit={fullscreenZoomMode === "full"}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
