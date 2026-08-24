"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MockProvider, useMock } from "../lib/mockStore";

export default function WorkstationLandingPage() {
  return (
    <MockProvider>
      <LandingPageContent />
    </MockProvider>
  );
}

function LandingPageContent() {
  const { lookupDocument } = useMock();
  // Language & Helper Tool State
  const [lang, setLang] = useState("en"); // 'en' | 'fil'
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState("constituent");
  const [activeModal, setActiveModal] = useState(null); // null | 'requirements' | 'proceed' | 'howToUse'
  const [testRefInput, setTestRefInput] = useState("");
  const [lookupResult, setLookupResult] = useState(null);

  const toggleLanguage = () => {
    setLang((prev) => (prev === "en" ? "fil" : "en"));
  };

  const handleTestLookup = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!testRefInput.trim()) {
      setLookupResult({
        status: "error",
        message: lang === "en" 
          ? "Please enter your reference code (e.g., DOC-8921, PAY-2026-8921, or OR-981245)." 
          : "Mangyaring ilagay ang inyong reference code (hal. DOC-8921, PAY-2026-8921, o OR-981245)."
      });
      return;
    }

    const match = lookupDocument(testRefInput);
    if (match) {
      setLookupResult({
        status: "success",
        ref: match.id,
        paymentNo: match.paymentNo,
        orNumber: match.orNumber,
        name: match.fullName,
        type: match.documentType || (lang === "en" ? "RTC Court Document Clearance" : "RTC Clearance sa Hukuman"),
        date: match.dateRequested || new Date().toISOString().split("T")[0],
        clearanceStatus: match.status,
        remarks: match.remarks,
        location: lang === "en" ? "Hall of Justice - Counter 3" : "Hall of Justice - Counter 3"
      });
    } else {
      setLookupResult({
        status: "not_found",
        ref: testRefInput.trim().toUpperCase(),
        message: lang === "en"
          ? `No clearance document record found for "${testRefInput.trim()}". Please check your reference ID, payment OR number, or submit a new request.`
          : `Walang nahanap na clearance record para sa "${testRefInput.trim()}". Mangyaring suriin ang inyong reference ID o magsumite ng bagong request.`
      });
    }
  };

  // Content dictionary for Mobbin layout with helper tabs
  const t = {
    en: {
      portalTitle: "RTC Clearance Express",
      portalSubtitle: "Official Municipal & Court Portal",
      trustBadge: "Official Government Service • Hall of Justice",
      staffLogin: "Court Staff Login",
      navHowToUse: "How to Use",
      navHowToProceed: "How to Proceed",
      navRequirements: "Requirements & Fees",
      navTrackStatus: "Track Status",
      heroBadge: "REPUBLIC OF THE PHILIPPINES • REGIONAL TRIAL COURT",
      heroTitle: "File your official court clearance online.",
      heroDesc: "Skip the long queue at the Hall of Justice. Complete your application in 3 minutes, link your payment receipt, and receive an instant digital QR pass for rapid counter pickup.",
      primaryCta: "Start Clearance Application →",
      secondaryCta: "Track Application Status",
      section2Header: "Find clearance services in seconds.",
      section2Sub: "Designed for citizens to complete requests quickly on mobile or desktop.",
      card1Title: "1. Online Request Form",
      card1Desc: "Fill personal details, state purpose (employment, legal, business), and upload photo ID.",
      card2Title: "2. E-Payment & Receipt Link",
      card2Desc: "Attach official municipal receipt code or e-wallet reference (GCash, Maya, Landbank).",
      card3Title: "3. Digital QR Pass & Pickup",
      card3Desc: "Present your QR code to the station clerk for instant 8.5x13 certificate printing.",
      featureHeader: "From application to official certificate.",
      featureSub: "Streamlined tools designed for maximum speed and accessibility.",
      feature1Title: "Smart Application Form",
      feature1Desc: "Guided inputs prevent errors and auto-validate government ID numbers.",
      feature2Title: "Instant Payment Linkage",
      feature2Desc: "Direct verification with municipal treasury and electronic payment gateways.",
      feature3Title: "Fast-Track Counter Pass",
      feature3Desc: "Bypass general lines with dedicated digital QR counter clearance.",
      staffTitle: "Court Staff & Counter Personnel Terminal",
      staffDesc: "For authorized RTC clerks processing constituent records and issuing sealed 8.5x13 court certificates.",
      staffBtn: "Access Counter Terminal →",
      footerGov: "REPUBLIC OF THE PHILIPPINES • REGIONAL TRIAL COURT",
      footerAddress: "Hall of Justice Building, Municipal Center • Hours: Mon–Fri 8:00 AM - 5:00 PM",
      footerHelp: "Public Assistance Hotline: (02) 8920-0000 | Email: clearance-help@rtc.gov.ph",
      footerPrivacy: "Public Privacy Notice & Terms of Service",

      // Modal strings
      reqModalTitle: "Application Requirements & Official Fees",
      reqModalDesc: "Prepare the following items before submitting your court clearance request:",
      reqIdHeader: "Accepted Government Photo IDs (at least 1):",
      reqIds: ["Philippine National ID (Philsys)", "Driver's License", "Passport", "UMID Card", "Voter's ID / PRC License"],
      reqFeeHeader: "Official Fee Schedule:",
      reqFees: ["P150.00 — Regional Trial Court Clearance Fee", "P50.00 — Official Document Stamp & Seal", "Total: P200.00 (Payable via Treasury Counter, GCash, Maya, or Landbank)"],

      procModalTitle: "How to Proceed with Your Application",
      procModalStep1: "Step 1: Click 'Start Clearance Application' to open the constituent portal.",
      procModalStep2: "Step 2: Enter your full legal name, complete address, and specific clearance purpose.",
      procModalStep3: "Step 3: Upload your valid ID photo and attach your payment reference number.",
      procModalStep4: "Step 4: Save or screenshot your digital QR pass and proceed to Counter 3 at the Hall of Justice."
    },
    fil: {
      portalTitle: "RTC Clearance Express",
      portalSubtitle: "Opisyal na Portal sa Court Clearance",
      trustBadge: "Opisyal na Serbisyo ng Pamahalaan • Hall of Justice",
      staffLogin: "Login ng Empleyado",
      navHowToUse: "Paano Gamitin",
      navHowToProceed: "Paano Magsimula",
      navRequirements: "Kailangan & Bayad",
      navTrackStatus: "Subaybayan",
      heroBadge: "REPUBLIKA NG PILIPINAS • REGIONAL TRIAL COURT",
      heroTitle: "Mag-apply ng opisyal na court clearance online.",
      heroDesc: "Hindi na kailangang pumila nang maaga sa Hall of Justice. Tapusin ang application sa loob ng 3 minuto, i-link ang resibo ng bayad, at kumuha ng instant digital QR pass.",
      primaryCta: "Simulan ang Application →",
      secondaryCta: "Subaybayan ang Request",
      section2Header: "Mag-apply sa loob lamang ng ilang segundo.",
      section2Sub: "Ginawa para sa mabilis na pagproseso ng mamamayan sa mobile o desktop.",
      card1Title: "1. Online Application Form",
      card1Desc: "Sagutan ang detalye, layunin (trabaho, negosyo, legal), at i-upload ang ID.",
      card2Title: "2. Resibo ng Bayad & E-Payment",
      card2Desc: "I-link ang official receipt code o e-wallet transaction (GCash, Maya, Landbank).",
      card3Title: "3. Digital QR Pass & Claim",
      card3Desc: "Ipakita ang QR pass sa counter clerk para sa instant 8.5x13 certificate printing.",
      featureHeader: "Mula sa application hanggang sa opisyal na sertipiko.",
      featureSub: "Mabilis at madaling gamitin para sa lahat ng mamamayan.",
      feature1Title: "Smart Application Form",
      feature1Desc: "Tiyak na gabay upang maiwasan ang mali sa pangalan at ID numbers.",
      feature2Title: "Mabilis na Pagtala ng Bayad",
      feature2Desc: "Direktang nakakonekta sa Municipal Treasury at e-payment channels.",
      feature3Title: "Fast-Track Counter Clearance",
      feature3Desc: "Iwas-pila gamit ang nakalaang digital QR pass counter.",
      staffTitle: "Counter Desk para sa Empleyado ng Hukuman",
      staffDesc: "Para sa mga opisyal na tauhan ng RTC na nagpoproseso ng records at nag-iisyu ng selyadong 8.5x13 clearance.",
      staffBtn: "Buksan ang Counter Terminal →",
      footerGov: "REPUBLIKA NG PILIPINAS • REGIONAL TRIAL COURT",
      footerAddress: "Gusali ng Hall of Justice, Sentro ng Bayan • Oras: Lun–Biy 8:00 AM - 5:00 PM",
      footerHelp: "Tulong sa Publiko Hotline: (02) 8920-0000 | Email: clearance-help@rtc.gov.ph",
      footerPrivacy: "Patakaran sa Pagkapribado at Maging Kasunduan sa Serbisyo",

      // Modal strings
      reqModalTitle: "Mga kailangan at Opisyal na Bayad",
      reqModalDesc: "Ihanda ang mga sumusunod bago magsumite ng inyong court clearance request:",
      reqIdHeader: "Mga Tinatanggap na Valid Government Photo ID (kahit 1 lang):",
      reqIds: ["Philippine National ID (Philsys)", "Driver's License", "Passport", "UMID Card", "Voter's ID / PRC License"],
      reqFeeHeader: "Opisyal na Halaga ng Bayad:",
      reqFees: ["P150.00 — Bayad sa RTC Court Clearance", "P50.00 — Opisyal na Selyo at Dokumento", "Kabuuan: P200.00 (Maaaring bayaran sa Treasury Counter, GCash, Maya, o Landbank)"],

      procModalTitle: "Paano Magsimula ng Inyong Application",
      procModalStep1: "Hakbang 1: I-click ang 'Simulan ang Application' para buksan ang portal.",
      procModalStep2: "Hakbang 2: Isulat ang inyong buong pangalan, tirahan, at tiyak na layunin ng clearance.",
      procModalStep3: "Hakbang 3: I-upload ang larawan ng valid ID at ilagay ang reference number ng bayad.",
      procModalStep4: "Hakbang 4: I-save ang inyong digital QR pass at pumunta sa Counter 3 sa Hall of Justice."
    }
  };

  const curr = t[lang];

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#FAF9F6",
      color: "#09090B",
      display: "flex",
      flexDirection: "column",
      fontFamily: "var(--font-body)",
      letterSpacing: "-0.01em"
    }}>
      {/* 1. Sleek Top Header Bar with Helper Tabs & Responsive Mobile Drawer */}
      <header className="site-header">
        {/* Main Header Container */}
        <div className="header-container">
          {/* Brand Mark Text */}
          <div className="brand-block">
            <h1 className="brand-title">
              {curr.portalTitle}
            </h1>
            <span className="brand-subtitle">
              {curr.portalSubtitle}
            </span>
          </div>

          {/* Mobile Action Icons Row (<640px) */}
          <div className="mobile-action-row">
            <button
              type="button"
              className="icon-btn lang-toggle-icon-btn"
              onClick={toggleLanguage}
              aria-label={`Switch language. Current language: ${lang === "en" ? "English" : "Tagalog"}`}
              title={lang === "en" ? "Switch to Tagalog" : "Switch to English"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span className="lang-code-badge">{lang === "en" ? "EN" : "TAG"}</span>
            </button>

            <button
              type="button"
              className="icon-btn hamburger-btn"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-nav-panel"
              aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              {isMobileMenuOpen ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="4" y1="7" x2="20" y2="7"/>
                  <line x1="4" y1="12" x2="20" y2="12"/>
                  <line x1="4" y1="17" x2="20" y2="17"/>
                </svg>
              )}
            </button>
          </div>

          {/* Center Navigation Helper Tabs Bar (Desktop) */}
          <nav className="desktop-nav">
            <button
              type="button"
              className="nav-tab-btn"
              onClick={() => scrollToSection("services-steps-section")}
            >
              {curr.navHowToUse}
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${activeModal === "proceed" ? "active" : ""}`}
              onClick={() => setActiveModal("proceed")}
            >
              {curr.navHowToProceed}
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${activeModal === "requirements" ? "active" : ""}`}
              onClick={() => setActiveModal("requirements")}
            >
              {curr.navRequirements}
            </button>
            <button
              type="button"
              className="nav-tab-btn"
              onClick={() => scrollToSection("lookup-section")}
            >
              {curr.navTrackStatus}
            </button>
          </nav>

          {/* Right Controls: Language Switcher + Staff Login (Desktop) */}
          <div className="desktop-controls">
            <button
              type="button"
              className="desktop-lang-btn"
              onClick={toggleLanguage}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span>{lang === "en" ? "Tagalog" : "English"}</span>
            </button>

            <Link href="/login" className="desktop-staff-btn">
              {curr.staffLogin}
            </Link>
          </div>
        </div>

        {/* Mobile Navigation Panel (<640px) */}
        {isMobileMenuOpen && (
          <div id="mobile-nav-panel" className="mobile-nav-panel">
            <nav className="mobile-menu-list">
              <button
                type="button"
                className="mobile-menu-item"
                onClick={() => {
                  scrollToSection("services-steps-section");
                  setIsMobileMenuOpen(false);
                }}
              >
                {curr.navHowToUse}
              </button>
              <button
                type="button"
                className="mobile-menu-item"
                onClick={() => {
                  setActiveModal("proceed");
                  setIsMobileMenuOpen(false);
                }}
              >
                {curr.navHowToProceed}
              </button>
              <button
                type="button"
                className="mobile-menu-item"
                onClick={() => {
                  setActiveModal("requirements");
                  setIsMobileMenuOpen(false);
                }}
              >
                {curr.navRequirements}
              </button>
              <button
                type="button"
                className="mobile-menu-item"
                onClick={() => {
                  scrollToSection("lookup-section");
                  setIsMobileMenuOpen(false);
                }}
              >
                {curr.navTrackStatus}
              </button>
            </nav>

            <div className="mobile-menu-footer">
              <Link
                href="/login"
                className="mobile-staff-link"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span>{curr.staffLogin}</span>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="mobile-main" style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "96px 24px 100px",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "64px"
      }}>
        {/* 2. Centered Hero Section */}
        <section style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: "24px",
          maxWidth: "860px",
          margin: "16px auto 0"
        }}>
          {/* Headline Typography */}
          <h1 className="mobile-hero-title" style={{
            fontSize: "3.4rem",
            fontWeight: "800",
            color: "#09090B",
            lineHeight: 1.08,
            letterSpacing: "-0.035em",
            maxWidth: "780px"
          }}>
            {curr.heroTitle}
          </h1>

          {/* Subtitle */}
          <p className="mobile-hero-desc" style={{
            fontSize: "1.18rem",
            color: "#52525B",
            lineHeight: 1.6,
            maxWidth: "680px"
          }}>
            {curr.heroDesc}
          </p>

          {/* Centered Action Pill Buttons */}
          <div className="mobile-cta-group" style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "8px", flexWrap: "wrap", justifyContent: "center" }}>
            <Link
              href="/portal"
              style={{
                padding: "16px 36px",
                borderRadius: "9999px",
                backgroundColor: "#09090B",
                color: "#FFFFFF",
                fontWeight: "700",
                fontSize: "1.05rem",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 4px 16px rgba(9, 9, 11, 0.2)",
                minHeight: "54px"
              }}
            >
              {curr.primaryCta}
            </Link>

            <button
              type="button"
              onClick={() => scrollToSection("lookup-section")}
              style={{
                padding: "16px 28px",
                borderRadius: "9999px",
                backgroundColor: "#FFFFFF",
                border: "1px solid #E4E4E7",
                color: "#09090B",
                fontWeight: "700",
                fontSize: "1rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                minHeight: "54px"
              }}
            >
              {curr.secondaryCta}
            </button>
          </div>


        </section>

        {/* 4. Mobbin 3-Card Screen Preview Section ("Find clearance services in seconds.") */}
        <section id="services-steps-section" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          <div style={{ textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
            <h2 style={{ fontSize: "2.25rem", fontWeight: "800", color: "#09090B", letterSpacing: "-0.025em" }}>
              {curr.section2Header}
            </h2>
            <p style={{ fontSize: "1.05rem", color: "#52525B", marginTop: "8px" }}>
              {curr.section2Sub}
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "24px"
          }}>
            {/* Card 1 */}
            <div style={{
              backgroundColor: "#F4F4F5",
              borderRadius: "20px",
              border: "1px solid #E4E4E7",
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "24px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.02)"
            }}>
              <div>
                <div style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E4E4E7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#09090B",
                  marginBottom: "16px",
                  fontWeight: "800"
                }}>
                  01
                </div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: "800", color: "#09090B", marginBottom: "8px" }}>
                  {curr.card1Title}
                </h3>
                <p style={{ fontSize: "0.95rem", color: "#52525B", lineHeight: 1.5 }}>
                  {curr.card1Desc}
                </p>
              </div>

              <div style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #E4E4E7",
                padding: "16px",
                fontSize: "0.825rem",
                color: "#71717A"
              }}>
                <div style={{ fontWeight: "700", color: "#09090B", marginBottom: "4px" }}>Direct Online Input</div>
                <div>Full name, legal purpose & ID photo upload</div>
              </div>
            </div>

            {/* Card 2 */}
            <div style={{
              backgroundColor: "#F4F4F5",
              borderRadius: "20px",
              border: "1px solid #E4E4E7",
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "24px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.02)"
            }}>
              <div>
                <div style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E4E4E7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#09090B",
                  marginBottom: "16px",
                  fontWeight: "800"
                }}>
                  02
                </div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: "800", color: "#09090B", marginBottom: "8px" }}>
                  {curr.card2Title}
                </h3>
                <p style={{ fontSize: "0.95rem", color: "#52525B", lineHeight: 1.5 }}>
                  {curr.card2Desc}
                </p>
              </div>

              <div style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #E4E4E7",
                padding: "16px",
                fontSize: "0.825rem",
                color: "#71717A"
              }}>
                <div style={{ fontWeight: "700", color: "#09090B", marginBottom: "4px" }}>E-Payment Linked</div>
                <div>Treasury OR #, GCash, Maya & Landbank</div>
              </div>
            </div>

            {/* Card 3 */}
            <div style={{
              backgroundColor: "#F4F4F5",
              borderRadius: "20px",
              border: "1px solid #E4E4E7",
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "24px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.02)"
            }}>
              <div>
                <div style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E4E4E7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#09090B",
                  marginBottom: "16px",
                  fontWeight: "800"
                }}>
                  03
                </div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: "800", color: "#09090B", marginBottom: "8px" }}>
                  {curr.card3Title}
                </h3>
                <p style={{ fontSize: "0.95rem", color: "#52525B", lineHeight: 1.5 }}>
                  {curr.card3Desc}
                </p>
              </div>

              <div style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #E4E4E7",
                padding: "16px",
                fontSize: "0.825rem",
                color: "#71717A"
              }}>
                <div style={{ fontWeight: "700", color: "#09090B", marginBottom: "4px" }}>Rapid Counter Print</div>
                <div>Instant QR scan at Hall of Justice Counter</div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Application Status Lookup Tool Section */}
        <section id="lookup-section" style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "24px",
          border: "1px solid #E4E4E7",
          boxShadow: "0 8px 24px -4px rgba(0,0,0,0.05)",
          padding: "36px",
          display: "flex",
          flexDirection: "column",
          gap: "20px"
        }}>
          <div>
            <span style={{ fontSize: "0.8rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.08em", color: "#71717A" }}>
              CONSTITUENT TOOL
            </span>
            <h3 style={{ fontSize: "1.6rem", fontWeight: "800", color: "#09090B", marginTop: "4px" }}>
              {curr.secondaryCta}
            </h3>
            <p style={{ fontSize: "0.95rem", color: "#52525B", marginTop: "2px" }}>
              Check your application reference status before heading to the Hall of Justice counter.
            </p>
          </div>

          <form onSubmit={handleTestLookup} style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "280px" }}>
              <label htmlFor="ref-lookup-input" style={{ display: "block", fontSize: "0.875rem", fontWeight: "700", color: "#09090B", marginBottom: "6px" }}>
                Reference Code, OR Number, or Document ID
              </label>
              <input
                id="ref-lookup-input"
                type="text"
                placeholder="e.g. DOC-8921, PAY-2026-8921, or OR-981245"
                value={testRefInput}
                onChange={(e) => setTestRefInput(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px 18px",
                  borderRadius: "12px",
                  border: "1px solid #E4E4E7",
                  fontSize: "1rem",
                  color: "#09090B",
                  backgroundColor: "#FAF9F6"
                }}
              />
            </div>
            <button
              type="submit"
              style={{
                padding: "14px 28px",
                borderRadius: "12px",
                backgroundColor: "#09090B",
                color: "#FFFFFF",
                fontWeight: "700",
                fontSize: "0.95rem",
                border: "none",
                cursor: "pointer",
                minHeight: "50px"
              }}
            >
              Verify Clearance Status
            </button>
          </form>

          {/* Sample quick test pills */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "0.8rem", color: "#71717A" }}>
            <span>Try sample codes:</span>
            {["DOC-8921", "DOC-3105", "DOC-4409", "DOC-5219"].map((sampleId) => (
              <button
                key={sampleId}
                type="button"
                onClick={() => {
                  setTestRefInput(sampleId);
                  const match = lookupDocument(sampleId);
                  if (match) {
                    setLookupResult({
                      status: "success",
                      ref: match.id,
                      paymentNo: match.paymentNo,
                      orNumber: match.orNumber,
                      name: match.fullName,
                      type: match.documentType || "RTC Court Document Clearance",
                      date: match.dateRequested || new Date().toISOString().split("T")[0],
                      clearanceStatus: match.status,
                      remarks: match.remarks,
                      location: "Hall of Justice - Counter 3"
                    });
                  }
                }}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  backgroundColor: "#F4F4F5",
                  border: "1px solid #E4E4E7",
                  color: "#09090B",
                  fontSize: "0.775rem",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                {sampleId}
              </button>
            ))}
          </div>

          {lookupResult && (
            <div style={{
              padding: "20px",
              borderRadius: "14px",
              backgroundColor: lookupResult.status === "error" || lookupResult.status === "not_found" ? "#FEF2F2" : "#ECFDF5",
              border: `1px solid ${lookupResult.status === "error" || lookupResult.status === "not_found" ? "#FCA5A5" : "#A7F3D0"}`,
              color: lookupResult.status === "error" || lookupResult.status === "not_found" ? "#991B1B" : "#065F46",
              fontSize: "0.95rem",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}>
              {lookupResult.status === "error" || lookupResult.status === "not_found" ? (
                <span>{lookupResult.message}</span>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "800", fontSize: "1rem", flexWrap: "wrap", gap: "8px" }}>
                    <span>Reference Matched: {lookupResult.ref} ({lookupResult.paymentNo})</span>
                    <span style={{
                      backgroundColor: lookupResult.clearanceStatus.includes("Released") ? "#047857" : "#D97706",
                      color: "#FFFFFF",
                      padding: "4px 14px",
                      borderRadius: "9999px",
                      fontSize: "0.775rem",
                      fontWeight: "700"
                    }}>
                      {lookupResult.clearanceStatus}
                    </span>
                  </div>
                  <div>Applicant: <strong>{lookupResult.name}</strong> | Type: <strong>{lookupResult.type}</strong></div>
                  <div style={{ fontSize: "0.85rem", opacity: 0.9 }}>
                    OR #: <strong>{lookupResult.orNumber}</strong> • Pickup Location: <strong>{lookupResult.location}</strong> • Requested: <strong>{lookupResult.date}</strong>
                  </div>
                  {lookupResult.remarks && (
                    <div style={{ fontSize: "0.8rem", fontStyle: "italic", opacity: 0.85, marginTop: "2px" }}>
                      Remarks: {lookupResult.remarks}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>

        {/* 6. Demoted Court Staff Entry Bar */}
        <section style={{
          backgroundColor: "#F4F4F5",
          borderRadius: "16px",
          border: "1px solid #E4E4E7",
          padding: "20px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px"
        }}>
          <div>
            <h4 style={{ fontSize: "0.95rem", fontWeight: "800", color: "#09090B" }}>
              {curr.staffTitle}
            </h4>
            <p style={{ fontSize: "0.825rem", color: "#52525B" }}>
              {curr.staffDesc}
            </p>
          </div>

          <Link
            href="/login"
            style={{
              padding: "8px 20px",
              borderRadius: "9999px",
              backgroundColor: "#FFFFFF",
              border: "1px solid #E4E4E7",
              color: "#09090B",
              fontWeight: "700",
              fontSize: "0.85rem",
              textDecoration: "none"
            }}
          >
            {curr.staffBtn}
          </Link>
        </section>
      </main>

      {/* 7. Interactive Helper Modal (Requirements & How to Proceed) */}
      {activeModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(9, 9, 11, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          padding: "20px"
        }}>
          <div style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "20px",
            maxWidth: "600px",
            width: "100%",
            padding: "32px",
            border: "1px solid #E4E4E7",
            boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
            maxHeight: "90vh",
            overflowY: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "1.35rem", fontWeight: "800", color: "#09090B" }}>
                {activeModal === "requirements" ? curr.reqModalTitle : curr.procModalTitle}
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                style={{
                  border: "none",
                  backgroundColor: "#F4F4F5",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  cursor: "pointer",
                  fontWeight: "700"
                }}
              >
                ✕
              </button>
            </div>

            {activeModal === "requirements" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", color: "#3F3F46", fontSize: "0.95rem" }}>
                <p>{curr.reqModalDesc}</p>
                <div style={{ backgroundColor: "#FAF9F6", padding: "16px", borderRadius: "12px", border: "1px solid #E4E4E7" }}>
                  <strong style={{ color: "#09090B", display: "block", marginBottom: "8px" }}>{curr.reqIdHeader}</strong>
                  <ul style={{ paddingLeft: "20px", margin: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
                    {curr.reqIds.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ backgroundColor: "#FAF9F6", padding: "16px", borderRadius: "12px", border: "1px solid #E4E4E7" }}>
                  <strong style={{ color: "#09090B", display: "block", marginBottom: "8px" }}>{curr.reqFeeHeader}</strong>
                  <ul style={{ paddingLeft: "20px", margin: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
                    {curr.reqFees.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", color: "#3F3F46", fontSize: "0.95rem" }}>
                <div style={{ padding: "12px 16px", backgroundColor: "#FAF9F6", borderRadius: "10px", border: "1px solid #E4E4E7" }}>
                  {curr.procModalStep1}
                </div>
                <div style={{ padding: "12px 16px", backgroundColor: "#FAF9F6", borderRadius: "10px", border: "1px solid #E4E4E7" }}>
                  {curr.procModalStep2}
                </div>
                <div style={{ padding: "12px 16px", backgroundColor: "#FAF9F6", borderRadius: "10px", border: "1px solid #E4E4E7" }}>
                  {curr.procModalStep3}
                </div>
                <div style={{ padding: "12px 16px", backgroundColor: "#FAF9F6", borderRadius: "10px", border: "1px solid #E4E4E7" }}>
                  {curr.procModalStep4}
                </div>
              </div>
            )}

            <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                style={{
                  padding: "10px 24px",
                  borderRadius: "9999px",
                  backgroundColor: "#09090B",
                  color: "#FFFFFF",
                  fontWeight: "700",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modern Footer Bar */}
      <footer style={{
        backgroundColor: "#09090B",
        color: "#FAF9F6",
        padding: "48px 28px 32px",
        marginTop: "auto"
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "32px", flexWrap: "wrap", marginBottom: "40px" }}>
            <div>
              <div style={{ fontSize: "1.2rem", fontWeight: "800", letterSpacing: "-0.02em", color: "#FFFFFF" }}>
                RTC Clearance Express
              </div>
              <div style={{ fontSize: "0.825rem", color: "#A1A1AA", marginTop: "4px" }}>
                {curr.footerGov}
              </div>
              <div style={{ fontSize: "0.825rem", color: "#71717A", marginTop: "12px" }}>
                {curr.footerAddress}
              </div>
            </div>

            <div style={{ display: "flex", gap: "48px", flexWrap: "wrap" }}>
              <div>
                <strong style={{ color: "#FFFFFF", display: "block", marginBottom: "8px" }}>Public Assistance</strong>
                <span style={{ display: "block", fontSize: "0.825rem", color: "#A1A1AA" }}>(02) 8920-0000</span>
                <span style={{ display: "block", fontSize: "0.825rem", color: "#A1A1AA" }}>clearance-help@rtc.gov.ph</span>
              </div>
              <div>
                <strong style={{ color: "#FFFFFF", display: "block", marginBottom: "8px" }}>Quick Links</strong>
                <Link href="/portal" style={{ display: "block", color: "#A1A1AA", textDecoration: "none", fontSize: "0.825rem" }}>Constituent Application</Link>
                <Link href="/login" style={{ display: "block", color: "#A1A1AA", textDecoration: "none", fontSize: "0.825rem" }}>Court Staff Login</Link>
              </div>
            </div>
          </div>

          <div style={{
            borderTop: "1px solid #27272A",
            paddingTop: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.775rem",
            color: "#71717A",
            flexWrap: "wrap",
            gap: "12px"
          }}>
            <span>© 2026 Republic of the Philippines • Regional Trial Court Office</span>
            <span>{curr.footerPrivacy}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
