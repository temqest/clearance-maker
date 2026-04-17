import { useEffect, useMemo, useState } from "react";
import styles from "./PreviewPanel.module.css";

const TEMPLATE_URL = "/assets/rtc-clearance-with-logo/RTCClearanceWithLogo.html";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function replaceAllLiteral(content, searchValue, replacementValue) {
  return content.split(searchValue).join(replacementValue);
}

function splitOrdinal(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return { number: "", suffix: "" };
  const match = raw.match(/^(\d+)(st|nd|rd|th)?$/i);
  if (match) {
    return {
      number: match[1],
      suffix: (match[2] || "").toLowerCase(),
    };
  }

  // Fallback for values like "16 th" or other mixed inputs.
  const num = raw.replace(/[^0-9]/g, "");
  const suffix = (raw.replace(/[0-9\s]/g, "") || "").toLowerCase();
  return { number: num, suffix };
}

function applyMinimalData(content, formData) {
  let html = content;
  const mapping = [
    ["RICA BORILLA ABINAL ,", escapeHtml(formData.fullName || "")],
    [">Single<", `>${escapeHtml(formData.civilStatus || "")}<`],
    [">Filipino<", `>${escapeHtml(formData.nationality || "")}<`],
    ["December 2, 1999", escapeHtml(formData.dob || "")],
    ["569 Luluasan, Balatan,, Camarines Sur", escapeHtml(formData.address || "")],
    ["NO CRIMINAL OR CIVIL CASE FILED OR PENDING", escapeHtml(formData.finding || "")],
    ["LOCAL EMPLOYMENT", escapeHtml(formData.purpose || "")],
    ["JEP-26-002967500", escapeHtml(formData.orNo || "")],
    ["23310708", escapeHtml(formData.ctc || "")],
    ["Naga City, Cam. Sur", escapeHtml(formData.issuedAt || "")],
    ["April 16, 2026", escapeHtml(formData.issuedOn || "")],
    ["103", escapeHtml(formData.certNo || "")],
    ["HARLETTE R. ARROYO-POTENCIO", escapeHtml(formData.clerkName || "")],
    ["Clerk of Court VI", escapeHtml(formData.clerkTitle1 || "")],
    ["Ex-Officio Provincial Sheriff &amp; Notary Public", escapeHtml(formData.clerkTitle2 || "")],
    [
      "Valid for 6 months from the date of issue.",
      escapeHtml(formData.noteText || "")
    ],
    ["MBL/jnr", escapeHtml(formData.noteInitials || "MBL/jnr")],
  ];

  for (const [searchValue, replacementValue] of mapping) {
    html = replaceAllLiteral(html, searchValue, replacementValue);
  }

  // Remove extra pre-name underlined gap so entered name starts closer to "Clearance of".
  html = html.replace(
    '<span class="c2 c13">&nbsp; &nbsp; </span><span class="c2 c13 c16">&nbsp; &nbsp;',
    '<span class="c2 c13 c16">'
  );

  // Keep exactly one normal (non-underlined) space between "of" and the name.
  html = html.replace(
    'Clearance of</span><span class="c2 c13 c16">',
    'Clearance of </span><span class="c2 c13 c16">'
  );

  return html;
}

function buildHeaderBlock(formData) {
  const courtName = escapeHtml(formData.courtName || "REGIONAL TRIAL COURT");
  const judicialRegion = escapeHtml(formData.judicialRegion || "5th Judicial Region");
  const courtCity = escapeHtml(formData.courtCity || "Iriga City");
  const courtEmail = escapeHtml(formData.courtEmail || "rtc1iriocc@judiciary.gov.ph");
  const courtTel = escapeHtml(formData.courtTel || "(054) 299-5922");

  return `
<div class="rtc-header">
  <img src="/assets/supreme-court-seal-left.png" alt="Supreme Court seal" class="rtc-header-logo" />
  <div class="rtc-header-center">
    <div class="rtc-h-republic">Republic of the Philippines</div>
    <div class="rtc-h-court">${courtName}</div>
    <div class="rtc-h-sub">${judicialRegion}</div>
    <div class="rtc-h-sub">${courtCity}</div>
    <div class="rtc-h-meta">Email add: ${courtEmail}</div>
    <div class="rtc-h-meta">Tel No: ${courtTel}</div>
  </div>
  <img src="/assets/regional-trial-court-seal-right.png" alt="Regional Trial Court seal" class="rtc-header-logo" />
</div>`;
}

function replaceHeaderBlock(content, formData) {
  const originalHeaderRegex =
    /<p class="c21"><span class="c5">Republic of the Philippines<\/span>[\s\S]*?<p class="c21"><span class="c9">Tel No: \(054\) 299-5922<\/span><\/p>/;

  if (!originalHeaderRegex.test(content)) return content;
  return content.replace(originalHeaderRegex, buildHeaderBlock(formData));
}

function replaceGivenLine(content, formData) {
  const givenLineRegex =
    /<p class="c18"><span class="c12">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Given this<\/span>[\s\S]*?<span class="c12">&nbsp;at Iriga City, Philippines\.<\/span><\/p>/;

  if (!givenLineRegex.test(content)) return content;

  const { number, suffix } = splitOrdinal(formData.givenDay);
  const month = escapeHtml(formData.givenMonth || "");
  const year = escapeHtml(formData.givenYear || "");
  const place = escapeHtml(formData.givenPlace || "");
  const monthYear = [month, year].filter(Boolean).join(" ").trim();

  const dayOrdinalHtml = suffix
    ? `<span class="rtc-ordinal-unit"><span class="rtc-ordinal-number">${escapeHtml(number || "")}</span><sup class="rtc-ordinal-suffix">${escapeHtml(suffix)}</sup></span>`
    : `<span class="rtc-ordinal-unit"><span class="rtc-ordinal-number">${escapeHtml(number || "")}</span></span>`;

  const replacement = `<p class="c18"><span class="c12">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Given this </span>${dayOrdinalHtml}<span class="c12"> day of </span><span class="c2 c13">${monthYear}</span><span class="c12"> at ${place}.</span></p>`;

  return content.replace(givenLineRegex, replacement);
}

function buildVerifiedBlock() {
  return `
<div class="rtc-verified-block">
  <div class="rtc-verified-title">Verified by:</div>
  <div class="rtc-verified-row">
    <span class="rtc-verified-label">Criminal Cases:</span>
    <span class="rtc-verified-line" aria-hidden="true"></span>
  </div>
  <div class="rtc-verified-row">
    <span class="rtc-verified-label">Civil Cases:</span>
    <span class="rtc-verified-line" aria-hidden="true"></span>
  </div>
</div>`;
}

function buildFindingPurposeBlock(formData) {
  const finding = escapeHtml(formData.finding || "NO CRIMINAL OR CIVIL CASE FILED OR PENDING");
  const purpose = escapeHtml(formData.purpose || "LOCAL EMPLOYMENT");

  return `
<div class="rtc-fp-block">
  <div class="rtc-fp-line rtc-fp-finding"><span class="rtc-fp-label">FINDING:</span><span class="rtc-fp-value">${finding}</span>.</div>
  <div class="rtc-fp-line rtc-fp-purpose"><span class="rtc-fp-label">PURPOSE:</span><span class="rtc-fp-value">${purpose}</span></div>
</div>`;
}

function replaceFindingPurposeBlock(content, formData) {
  const findingPurposeRegex =
    /<p class="c18"><span class="c12">[\s\S]*?FINDING:[\s\S]*?<\/p>\s*<p class="c18 c19">[\s\S]*?<\/p>\s*<p class="c8 c27"><span class="c12">PURPOSE:[\s\S]*?<\/p>/;

  if (!findingPurposeRegex.test(content)) return content;
  return content.replace(findingPurposeRegex, buildFindingPurposeBlock(formData || {}));
}

function replaceVerifiedBlock(content) {
  const verifiedBlockRegex =
    /<p class="c8 c17"><span class="c0">Verified by:<\/span><\/p>\s*<p class="c8"><span class="c0">[\s\S]*?Criminal Cases:[\s\S]*?_{5,}<\/span><\/p>\s*<p class="c8"><span class="c0">[\s\S]*?Civil Cases:[\s\S]*?_{5,}<\/span><\/p>/;

  if (!verifiedBlockRegex.test(content)) return content;
  return content.replace(verifiedBlockRegex, buildVerifiedBlock());
}

function buildSignatoryBlock(formData) {
  const clerkName = escapeHtml(formData.clerkName || "HARLETTE R. ARROYO-POTENCIO");
  const clerkTitle1 = escapeHtml(formData.clerkTitle1 || "Clerk of Court VI");
  const clerkTitle2 = escapeHtml(
    formData.clerkTitle2 || "Ex-Officio Provincial Sheriff & Notary Public"
  );

  return `
<div class="rtc-signatory-block">
  <div class="rtc-signatory-name">${clerkName}</div>
  <div class="rtc-signatory-title rtc-signatory-title-main">${clerkTitle1}</div>
  <div class="rtc-signatory-title rtc-signatory-title-secondary">${clerkTitle2}</div>
</div>`;
}

function replaceSignatoryBlock(content, formData) {
  const signatoryBlockRegex =
    /<p class="c8 c28"><span class="c2">[\s\S]*?<\/span><\/p>\s*<p class="c8"><span class="c12">[\s\S]*?<\/span><span class="c10 c15">[\s\S]*?<\/span><\/p>\s*<p class="c8 c37"><span class="c10">[\s\S]*?<\/span><span class="c14">[\s\S]*?<\/span><\/p>/;

  if (!signatoryBlockRegex.test(content)) return content;
  return content.replace(signatoryBlockRegex, buildSignatoryBlock(formData || {}));
}

function fieldValueHtml(value) {
  const text = String(value ?? "").trim();
  return text ? escapeHtml(text) : "&nbsp;";
}

function buildBottomBlock(formData, photoSrc) {
  const assistantName = escapeHtml(formData.assistantClerkName || "MARIBEL B. LLAGAS");
  const assistantTitle = escapeHtml(formData.assistantClerkTitle || "Clerk of Court V");
  const stampOr = fieldValueHtml(formData.stampOR || formData.orNo);
  const stampDate = fieldValueHtml(formData.stampDate || formData.orDate || formData.issuedOn);
  const orNo = fieldValueHtml(formData.orNo);
  const orDate = fieldValueHtml(formData.orDate);
  const ctc = fieldValueHtml(formData.ctc);
  const issuedAt = fieldValueHtml(formData.issuedAt);
  const issuedOn = fieldValueHtml(formData.issuedOn);

  const photoTag = photoSrc
    ? `<img src="${escapeHtml(photoSrc)}" alt="Applicant" class="rtc-photo-image" />`
    : `<span class="rtc-photo-placeholder">Picture</span>`;

  return `
<div class="rtc-bottom-wrap">
  <div class="rtc-stamp-assistant-row">
    <div class="rtc-stamp-box">
      <div class="rtc-stamp-title">\u201cDocumentary Stamp Tax Paid\u201d</div>
      <div class="rtc-stamp-line"><strong>O.R. No.</strong> ${stampOr}</div>
      <div class="rtc-stamp-line">${stampDate}</div>
    </div>
    <div class="rtc-assistant-wrap">
      <div class="rtc-assistant-name">${assistantName}</div>
      <div class="rtc-assistant-title">${assistantTitle}</div>
      <div class="rtc-dry-seal">NOT VALID WITHOUT DRY SEAL</div>
    </div>
  </div>

  <div class="rtc-bottom-main-row">
    <div class="rtc-or-block">
      <div class="rtc-or-row"><span class="rtc-or-label">O.R. Nos.</span><span class="rtc-or-colon">:</span><span class="rtc-or-value">${orNo}</span></div>
      <div class="rtc-or-row"><span class="rtc-or-label">Date Issued</span><span class="rtc-or-colon">:</span><span class="rtc-or-value">${orDate}</span></div>
      <div class="rtc-or-row"><span class="rtc-or-label">CTC NO.</span><span class="rtc-or-colon">:</span><span class="rtc-or-value">${ctc}</span></div>
      <div class="rtc-or-row"><span class="rtc-or-label">Issued at</span><span class="rtc-or-colon">:</span><span class="rtc-or-value">${issuedAt}</span></div>
      <div class="rtc-or-row"><span class="rtc-or-label">Issued on</span><span class="rtc-or-colon">:</span><span class="rtc-or-value">${issuedOn}</span></div>
      <div class="rtc-applicant-signature-line" aria-hidden="true"></div>
      <div class="rtc-applicant-signature-label">Applicant's Signature</div>
    </div>

    <div class="rtc-photo-box">${photoTag}</div>

    <div class="rtc-thumb-box">
      <span>Right Hand</span>
      <span>thumb</span>
      <span>mark</span>
    </div>
  </div>
</div>`;
}

function replaceBottomBlock(content, formData, photoSrc) {
  const bottomBlockRegex =
    /<p class="c21 c17"><span style="overflow:[\s\S]*?image3\.png[\s\S]*?<\/p>[\s\S]*?<p class="c18"><span class="c0">[\s\S]*?Applicant(?:&rsquo;|')s Signature[\s\S]*?<\/span><\/p>/;

  if (!bottomBlockRegex.test(content)) return content;
  return content.replace(bottomBlockRegex, buildBottomBlock(formData || {}, photoSrc));
}

export default function PreviewPanel({ formData, photoSrc }) {
  const [templateHtml, setTemplateHtml] = useState("");

  useEffect(() => {
    let active = true;
    fetch(TEMPLATE_URL)
      .then((response) => response.text())
      .then((rawTemplate) => {
        if (!active) return;
        const withAbsoluteImagePaths = rawTemplate.replaceAll(
          'src="images/',
          'src="/assets/rtc-clearance-with-logo/images/'
        );

        const headerFixCss = `
<style id="rtc-header-fix">
  @font-face {
    font-family: "RTCClearanceBookman";
    src: url('/fonts/bookmanoldstyle.ttf') format('truetype');
    font-weight: 400;
    font-style: normal;
    font-display: block;
  }

  @font-face {
    font-family: "RTCClearanceBookman";
    src: url('/fonts/bookmanoldstyle_bold.ttf') format('truetype');
    font-weight: 700;
    font-style: normal;
    font-display: block;
  }

  @font-face {
    font-family: "RTCClearanceBookman";
    src: url('/fonts/bookmanoldstyle_italic.ttf') format('truetype');
    font-weight: 400;
    font-style: italic;
    font-display: block;
  }

  @font-face {
    font-family: "RTCClearanceBookman";
    src: url('/fonts/bookmanoldstyle_bolditalic.ttf') format('truetype');
    font-weight: 700;
    font-style: italic;
    font-display: block;
  }

  :root {
    --rtc-doc-font: "RTCClearanceBookman", "Bookman Old Style", Bookman, "Times New Roman", serif;
  }

  @page {
    size: 8.5in 13in;
    margin: 0;
  }

  html,
  body {
    margin: 0;
    padding: 0;
  }

  body.doc-content {
    position: relative;
    padding-top: 20pt !important;
    padding-bottom: 18pt !important;
    font-family: var(--rtc-doc-font) !important;
  }

  body.doc-content *,
  body.doc-content p,
  body.doc-content span,
  body.doc-content div,
  body.doc-content td {
    font-family: var(--rtc-doc-font) !important;
  }

  body.doc-content > p {
    margin-bottom: 1.8pt;
  }

  body.doc-content::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 430pt;
    height: 430pt;
    transform: translate(-50%, -50%);
    background: url('/assets/supreme-court-seal.png') center / contain no-repeat;
    opacity: 0.14;
    pointer-events: none;
    z-index: 0;
  }

  body.doc-content > * {
    position: relative;
    z-index: 1;
  }

  .rtc-header {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 12pt;
    margin: 0;
    min-height: 72pt;
  }

  .rtc-header-logo {
    width: 64pt;
    height: 64pt;
    object-fit: contain;
    margin-top: 2pt;
    flex: 0 0 auto;
  }

  .rtc-header-center {
    text-align: center;
    line-height: 1;
    margin-top: 8pt;
  }

  .rtc-h-republic,
  .rtc-h-sub {
    font-family: var(--rtc-doc-font);
    font-size: 12pt;
    font-weight: 400;
    margin: 0;
  }

  .rtc-h-court {
    font-family: var(--rtc-doc-font);
    font-size: 12pt;
    font-weight: 700;
    margin: 0;
  }

  .rtc-h-meta {
    font-family: var(--rtc-doc-font);
    font-size: 10pt;
    font-weight: 400;
    margin: 0;
  }

  .rtc-ordinal-suffix {
    font-family: var(--rtc-doc-font);
    font-size: 7pt;
    font-weight: 700;
    vertical-align: super;
    position: relative;
    top: -2pt;
    line-height: 0;
  }

  .rtc-ordinal-unit {
    display: inline-block;
    text-decoration: underline;
    text-decoration-thickness: 1.1px;
    text-underline-offset: 1px;
    white-space: nowrap;
  }

  .rtc-ordinal-number {
    font-family: var(--rtc-doc-font);
    font-size: 12pt;
    font-weight: 700;
    line-height: 1;
  }

  /* Slightly separate main paragraph block from FINDING/PURPOSE lines */
  .doc-content > p.c18:not(.c19):has(> span:first-child:not(.c22)) {
    margin-top: 8pt;
  }

  .doc-content > p.c8.c27 {
    margin-top: 3pt;
  }

  .rtc-fp-block {
    margin: 8pt 0 0 50pt;
    font-size: 12pt;
    line-height: 1;
  }

  .rtc-fp-line {
    display: block;
  }

  .rtc-fp-finding {
    margin-top: 0;
  }

  .rtc-fp-purpose {
    margin-top: 3pt;
  }

  .rtc-fp-label {
    font-weight: 400;
  }

  .rtc-fp-value {
    margin-left: 6pt;
    font-weight: 700;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 1px;
  }

  .rtc-verified-block {
    margin: 4pt 0 0 180pt;
    width: 245pt;
    font-family: var(--rtc-doc-font);
    font-size: 12pt;
    line-height: 1;
  }

  .rtc-verified-title {
    width: auto;
    text-align: left;
    margin: 0 0 2pt 0;
  }

  .rtc-verified-row {
    display: flex;
    align-items: flex-end;
    gap: 4pt;
    margin: 0;
  }

  .rtc-verified-label {
    min-width: 106pt;
    text-align: left;
  }

  .rtc-verified-line {
    display: inline-block;
    width: 118pt;
    height: 0;
    border-bottom: 1px solid #111;
    transform: translateY(-1pt);
  }

  .rtc-signatory-block {
    margin: 7pt 0 0 auto;
    width: 290pt;
    text-align: center;
    font-family: var(--rtc-doc-font);
    line-height: 1.1;
    transform: translateX(34pt);
  }

  .rtc-signatory-name {
    margin: 0;
    font-size: 12pt;
    font-weight: 700;
    letter-spacing: 0.15px;
    line-height: 1.02;
  }

  .rtc-signatory-title {
    margin: 1pt 0 0;
    font-style: italic;
    font-weight: 400;
    line-height: 1.04;
  }

  .rtc-signatory-title-main {
    font-size: 10.7pt;
  }

  .rtc-signatory-title-secondary {
    font-size: 10.3pt;
  }

  .rtc-bottom-wrap {
    margin-top: 12pt;
    margin-bottom: 24pt;
    font-family: var(--rtc-doc-font);
  }

  .rtc-stamp-assistant-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12pt;
  }

  .rtc-stamp-box {
    width: 180pt;
    border: 2px solid #000;
    background: #fff;
    padding: 6pt 8pt;
    text-align: center;
    line-height: 1.14;
  }

  .rtc-stamp-title {
    font-size: 11pt;
    font-weight: 700;
    margin: 0;
  }

  .rtc-stamp-line {
    font-size: 11pt;
    margin-top: 2.5pt;
  }

  .rtc-assistant-wrap {
    width: 165pt;
    text-align: center;
    line-height: 1.05;
    padding-top: 10pt;
    transform: translateX(-32pt);
  }

  .rtc-assistant-name {
    margin: 0;
    font-size: 12pt;
    font-weight: 700;
    letter-spacing: 0.1px;
  }

  .rtc-assistant-title {
    margin: 0;
    font-size: 11pt;
    font-style: italic;
  }

  .rtc-dry-seal {
    margin-top: 18pt;
    font-size: 11pt;
    font-weight: 700;
    letter-spacing: 0;
    line-height: 1;
    white-space: nowrap;
  }

  .rtc-bottom-main-row {
    --rtc-box-shift-x: 34pt;
    display: flex;
    align-items: flex-end;
    justify-content: flex-start;
    gap: 12pt;
    margin-top: 1pt;
  }

  .rtc-or-block {
    width: 190pt;
    font-size: 11pt;
    line-height: 1.08;
  }

  .rtc-or-row {
    display: flex;
    align-items: baseline;
    margin: 1.5pt 0;
  }

  .rtc-or-label {
    width: 66pt;
  }

  .rtc-or-colon {
    width: 8pt;
    text-align: center;
  }

  .rtc-or-value {
    flex: 1;
    text-decoration: underline;
    text-underline-offset: 1px;
    text-decoration-thickness: 1px;
    min-height: 12pt;
  }

  .rtc-applicant-signature-line {
    border-bottom: 1px solid #111;
    margin-top: 18pt;
    width: 170pt;
  }

  .rtc-applicant-signature-label {
    margin-top: 2pt;
    font-size: 11pt;
    text-align: center;
    width: 170pt;
  }

  .rtc-photo-box {
    width: 112pt;
    height: 95pt;
    border: 1px solid #444;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    transform: translateX(var(--rtc-box-shift-x));
  }

  .rtc-photo-placeholder {
    font-size: 13pt;
  }

  .rtc-photo-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .rtc-thumb-box {
    width: 90pt;
    height: 86pt;
    margin-bottom: 0;
    border: 1px solid #444;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 13pt;
    line-height: 1.06;
    transform: translateX(var(--rtc-box-shift-x));
  }

  .rtc-bottom-wrap + p.c18 {
    display: none;
  }

  .doc-content > div:last-of-type {
    margin-top: 6pt;
  }
</style>`;

        const withHeaderFixCss = withAbsoluteImagePaths.replace(
          "</head>",
          `${headerFixCss}</head>`
        );

        setTemplateHtml(withHeaderFixCss);
      });

    return () => {
      active = false;
    };
  }, []);

  const renderedTemplate = useMemo(() => {
    if (!templateHtml) return "";
    const withData = applyMinimalData(templateHtml, formData || {});
    const withHeader = replaceHeaderBlock(withData, formData || {});
    const withGivenLine = replaceGivenLine(withHeader, formData || {});
    const withFindingPurpose = replaceFindingPurposeBlock(withGivenLine, formData || {});
    const withVerified = replaceVerifiedBlock(withFindingPurpose);
    const withSignatory = replaceSignatoryBlock(withVerified, formData || {});
    return replaceBottomBlock(withSignatory, formData || {}, photoSrc || "");
  }, [templateHtml, formData, photoSrc]);

  return (
    <section className={styles.previewPanel}>
      <iframe
        title="RTC clearance preview"
        className={styles.templateFrame}
        srcDoc={renderedTemplate}
      />
    </section>
  );
}
