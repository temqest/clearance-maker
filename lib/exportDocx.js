import { saveAs } from "file-saver";
import JSZip from "jszip";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  TableLayoutType,
  UnderlineType,
  VerticalAlign,
  WidthType,
  convertInchesToTwip
} from "docx";

const PARA_SPACING = { before: 0, after: 160, line: 276 };
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const SOLID_BORDER = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
const DOCX_TEMPLATE_CANDIDATES = [
  "/assets/rtc-clearance-template-1-page.docx",
  "/assets/rtc-clearance-template-with-logo.docx",
  "/assets/RTC Clearance - 1 page.docx",
  "/assets/RTC Clearance - With Logo.docx"
];

/**
 * @typedef {Object} RTCClearanceData
 * @property {string} name
 * @property {string} status
 * @property {string} dob
 * @property {string} address
 * @property {string} finding
 * @property {string} purpose
 * @property {string} orNo
 * @property {string} orDate
 * @property {string} ctc
 * @property {string} issuedAt
 * @property {string} issuedOn
 * @property {string} certNo
 * @property {string} sigImageUrl
 * @property {string} photoImageUrl
 * @property {string} logoLeftUrl
 * @property {string} logoRightUrl
 * @property {string} signerName
 * @property {string} signerTitle1
 * @property {string} signerTitle2
 * @property {string} issueDate
 * @property {string} [courtName]
 * @property {string} [judicialRegion]
 * @property {string} [courtCity]
 * @property {string} [courtEmail]
 * @property {string} [courtTel]
 * @property {string} [fileName]
 */

function paragraph(children, options = {}) {
  return new Paragraph({
    spacing: PARA_SPACING,
    children,
    ...options
  });
}

function parseIssueDate(issueDate) {
  const value = issueDate || "";
  const dayMatch = value.match(/\b(\d{1,2})(st|nd|rd|th)?\b/i);
  const yearMatch = value.match(/\b(19|20)\d{2}\b/);
  const monthMatch = value.match(
    /January|February|March|April|May|June|July|August|September|October|November|December/i
  );

  return {
    dayNum: dayMatch?.[1] || "10",
    daySuffix: (dayMatch?.[2] || "th").toLowerCase(),
    month: monthMatch?.[0] || "April",
    year: yearMatch?.[0] || "2026"
  };
}

function escapeXmlText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function replaceAllLiteral(content, from, to) {
  return content.split(from).join(to);
}

async function fetchTemplateArrayBuffer() {
  for (const templateUrl of DOCX_TEMPLATE_CANDIDATES) {
    const response = await fetch(templateUrl);
    if (response.ok) {
      return response.arrayBuffer();
    }
  }

  throw new Error("Could not load DOCX template from assets folder.");
}

function getNextRelationshipId(relationshipsXml) {
  const idMatches = [...relationshipsXml.matchAll(/Id="rId(\d+)"/g)];
  const maxId = idMatches.reduce((max, match) => {
    const value = Number(match[1]);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);

  return `rId${maxId + 1}`;
}

function buildApplicantPhotoDrawingXml(relId) {
  return [
    "<w:drawing>",
    '<wp:anchor distT="0" distB="0" distL="114935" distR="114935" simplePos="0" relativeHeight="6" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1">',
    '<wp:simplePos x="0" y="0"/>',
    '<wp:positionH relativeFrom="column"><wp:posOffset>3062605</wp:posOffset></wp:positionH>',
    '<wp:positionV relativeFrom="paragraph"><wp:posOffset>144145</wp:posOffset></wp:positionV>',
    '<wp:extent cx="1497965" cy="1269365"/>',
    '<wp:effectExtent l="0" t="0" r="0" b="0"/>',
    "<wp:wrapNone/>",
    '<wp:docPr id="40" name="ApplicantPhoto"/>',
    '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>',
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">',
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">',
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">',
    '<pic:nvPicPr><pic:cNvPr id="40" name="ApplicantPhoto"/><pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr></pic:nvPicPr>',
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`,
    '<pic:spPr bwMode="auto"><a:xfrm><a:off x="0" y="0"/><a:ext cx="1497965" cy="1269365"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>',
    "</pic:pic>",
    "</a:graphicData>",
    "</a:graphic>",
    "</wp:anchor>",
    "</w:drawing>"
  ].join("");
}

async function injectApplicantPhotoIntoTemplate(zip, photoUrl) {
  if (!photoUrl) return;

  const payload = await toImagePayload(photoUrl);
  const extension = payload.type === "jpg" ? "jpg" : "png";
  const mediaFileName = `applicant-photo.${extension}`;
  const mediaPath = `word/media/${mediaFileName}`;

  zip.file(mediaPath, payload.data);

  const relsPath = "word/_rels/document.xml.rels";
  const relsFile = zip.file(relsPath);
  if (!relsFile) return;

  let relsXml = await relsFile.async("string");
  const photoRelId = getNextRelationshipId(relsXml);
  const photoRel = `<Relationship Id="${photoRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaFileName}"/>`;
  relsXml = relsXml.replace("</Relationships>", `${photoRel}</Relationships>`);
  zip.file(relsPath, relsXml);

  const documentPath = "word/document.xml";
  const documentFile = zip.file(documentPath);
  if (!documentFile) return;

  let documentXml = await documentFile.async("string");
  const frame2Marker = '<wp:docPr id="4" name="Frame2"></wp:docPr>';
  const markerIndex = documentXml.indexOf(frame2Marker);
  if (markerIndex === -1) return;

  const runStartTag = "<w:r><mc:AlternateContent>";
  const runEndTag = "</mc:AlternateContent></w:r>";
  const runStartIndex = documentXml.lastIndexOf(runStartTag, markerIndex);
  const runEndIndex = documentXml.indexOf(runEndTag, markerIndex);
  if (runStartIndex === -1 || runEndIndex === -1) return;

  const drawingXml = buildApplicantPhotoDrawingXml(photoRelId);
  const runEndExclusive = runEndIndex + runEndTag.length;
  documentXml = `${documentXml.slice(0, runStartIndex)}<w:r>${drawingXml}</w:r>${documentXml.slice(runEndExclusive)}`;
  zip.file(documentPath, documentXml);
}

async function exportClearanceDocxFromTemplate(formData, fileName, assets = {}) {
  const templateBuffer = await fetchTemplateArrayBuffer();
  const zip = await JSZip.loadAsync(templateBuffer);

  const issueDateParts = [formData.givenMonth, formData.givenDay, formData.givenYear].filter(Boolean);
  const unifiedDate =
    formData.issuedOn ||
    formData.stampDate ||
    formData.orDate ||
    (issueDateParts.length ? issueDateParts.join(" ") : "");

  const replacements = [
    ["RICA BORILLA ABINAL ,", formData.fullName || ""],
    ["RICA BORILLA ABINAL", formData.fullName || ""],
    ["Single", formData.civilStatus || ""],
    ["Filipino", formData.nationality || ""],
    ["December 2, 1999", formData.dob || ""],
    ["569 Luluasan, Balatan,, Camarines Sur", formData.address || ""],
    ["NO CRIMINAL OR CIVIL CASE FILED OR PENDING", formData.finding || ""],
    ["LOCAL EMPLOYMENT", formData.purpose || ""],
    ["JEP-26-002967500", formData.orNo || formData.stampOR || ""],
    ["23310708", formData.ctc || ""],
    ["Naga City, Cam. Sur", formData.issuedAt || ""],
    ["April 16, 2026", unifiedDate || ""],
    ["103", formData.certNo || ""],
    ["HARLETTE R. ARROYO-POTENCIO", formData.clerkName || "HARLETTE R. ARROYO-POTENCIO"],
    ["Clerk of Court VI", formData.clerkTitle1 || "Clerk of Court VI"],
    [
      "Ex-Officio Provincial Sheriff & Notary Public",
      formData.clerkTitle2 || "Ex-Officio Provincial Sheriff & Notary Public"
    ],
    ["MARIBEL B. LLAGAS", formData.assistantClerkName || ""],
    ["Clerk of Court V", formData.assistantClerkTitle || ""],
    ["Valid for 6 months from the date of issue.", formData.noteText || ""],
    ["MBL/jnr", formData.noteInitials || "MBL/jnr"],
    ["REGIONAL TRIAL COURT", formData.courtName || "REGIONAL TRIAL COURT"],
    ["5th Judicial Region", formData.judicialRegion || "5th Judicial Region"],
    ["Iriga City", formData.courtCity || "Iriga City"],
    ["rtc1iriocc@judiciary.gov.ph", formData.courtEmail || ""],
    ["rtc1iriocca@judiciary.gov.ph", formData.courtEmail || ""],
    ["(054) 299-5922", formData.courtTel || ""],
    ["(054)299-5922", formData.courtTel || ""]
  ];

  const xmlPaths = Object.keys(zip.files).filter(
    (path) => path.startsWith("word/") && path.endsWith(".xml")
  );

  for (const xmlPath of xmlPaths) {
    const file = zip.file(xmlPath);
    if (!file) continue;

    let xml = await file.async("string");
    for (const [fromRaw, toRaw] of replacements) {
      const fromEscaped = escapeXmlText(fromRaw);
      const toEscaped = escapeXmlText(toRaw);

      xml = replaceAllLiteral(xml, fromEscaped, toEscaped);
      xml = replaceAllLiteral(xml, fromRaw, toEscaped);
    }

    zip.file(xmlPath, xml);
  }

  await injectApplicantPhotoIntoTemplate(zip, assets.photoSrc || assets.photoImageUrl || "");

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${fileName || "RTC_CLEARANCE"}.docx`);
}

function mimeToDocxType(mime) {
  const value = String(mime || "").toLowerCase();
  if (value.includes("png")) return "png";
  if (value.includes("jpeg") || value.includes("jpg")) return "jpg";
  if (value.includes("gif")) return "gif";
  if (value.includes("bmp")) return "bmp";
  return "png";
}

function parseDataUrl(url) {
  const match = String(url || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  const mime = match[1];
  const base64 = match[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return { data: bytes, type: mimeToDocxType(mime) };
}

async function toImagePayload(url) {
  const inlineData = parseDataUrl(url);
  if (inlineData) {
    return inlineData;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load image: ${url}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const mime = response.headers.get("content-type") || "";
  return {
    data: bytes,
    type: mimeToDocxType(mime)
  };
}

async function imageRunFromUrl(url, width, height) {
  if (!url) return null;
  const payload = await toImagePayload(url);
  return new ImageRun({
    data: payload.data,
    type: payload.type,
    transformation: { width, height }
  });
}

function metadataLine(label, value) {
  return paragraph(
    [
      new TextRun({ text: `${label} `, size: 20 }),
      new TextRun({
        text: value || "-",
        size: 20,
        underline: { type: UnderlineType.SINGLE }
      })
    ],
    { spacing: { before: 0, after: 120, line: 240 } }
  );
}

/**
 * Builds and downloads the RTC clearance DOCX document.
 * @param {RTCClearanceData} data
 */
export async function generateRTCClearance(data) {
  const dateParts = parseIssueDate(data.issueDate);

  const [leftLogo, rightLogo, signatureImage, photoImage] = await Promise.all([
    imageRunFromUrl(data.logoLeftUrl, 60, 60),
    imageRunFromUrl(data.logoRightUrl, 60, 60),
    imageRunFromUrl(data.sigImageUrl, 100, 40),
    imageRunFromUrl(data.photoImageUrl, 100, 120)
  ]);

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: NO_BORDER,
      bottom: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
      insideH: NO_BORDER,
      insideV: NO_BORDER
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 80, bottom: 80, left: 40, right: 40 },
            borders: {
              top: NO_BORDER,
              bottom: NO_BORDER,
              left: NO_BORDER,
              right: NO_BORDER
            },
            children: [
              paragraph(leftLogo ? [leftLogo] : [new TextRun({ text: "" })], {
                alignment: AlignmentType.CENTER
              })
            ]
          }),
          new TableCell({
            width: { size: 64, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 40, bottom: 40, left: 80, right: 80 },
            borders: {
              top: NO_BORDER,
              bottom: NO_BORDER,
              left: NO_BORDER,
              right: NO_BORDER
            },
            children: [
              paragraph([new TextRun({ text: "Republic of the Philippines", size: 20 })], {
                alignment: AlignmentType.CENTER
              }),
              paragraph(
                [new TextRun({ text: data.courtName || "REGIONAL TRIAL COURT", bold: true, size: 28 })],
                { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 140, line: 260 } }
              ),
              paragraph([new TextRun({ text: data.judicialRegion || "5th Judicial Region", size: 20 })], {
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 140, line: 260 }
              }),
              paragraph([new TextRun({ text: data.courtCity || "Iriga City", size: 20 })], {
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 140, line: 260 }
              }),
              paragraph([new TextRun({ text: data.courtEmail || "rtc1iriocca@judiciary.gov.ph", italics: true, size: 20 })], {
                alignment: AlignmentType.CENTER
              }),
              paragraph([new TextRun({ text: `Tel.no. ${data.courtTel || "(054)299-5922"}`, italics: true, size: 20 })], {
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 220, line: 276 }
              })
            ]
          }),
          new TableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 80, bottom: 80, left: 40, right: 40 },
            borders: {
              top: NO_BORDER,
              bottom: NO_BORDER,
              left: NO_BORDER,
              right: NO_BORDER
            },
            children: [
              paragraph(rightLogo ? [rightLogo] : [new TextRun({ text: "" })], {
                alignment: AlignmentType.CENTER
              })
            ]
          })
        ]
      })
    ]
  });

  const titleBlock = [
    paragraph([new TextRun({ text: "OFFICE OF THE CLERK OF COURT", bold: true, size: 24 })], {
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 160, line: 260 }
    }),
    paragraph(
      [
        new TextRun({
          text: "C  L  E  A  R  A  N  C  E",
          bold: true,
          size: 32,
          spacing: 20
        })
      ],
      {
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 260, line: 276 }
      }
    )
  ];

  const bodyParagraph = paragraph(
    [
      new TextRun({ text: "In connection with the application for a Regional Trial Court Clearance of " }),
      new TextRun({
        text: data.name,
        bold: true,
        underline: { type: UnderlineType.SINGLE }
      }),
      new TextRun({ text: ", Filipino, " }),
      new TextRun({
        text: data.status,
        bold: true,
        underline: { type: UnderlineType.SINGLE }
      }),
      new TextRun({ text: ", born on " }),
      new TextRun({
        text: data.dob,
        bold: true,
        underline: { type: UnderlineType.SINGLE }
      }),
      new TextRun({ text: " and presently residing at " }),
      new TextRun({
        text: data.address,
        bold: true,
        underline: { type: UnderlineType.SINGLE }
      }),
      new TextRun({
        text: ", whose signature, right thumb mark, recent picture and Community Certificate Number are shown below, this office certifies to the following:"
      })
    ],
    {
      alignment: AlignmentType.JUSTIFIED,
      indent: { firstLine: convertInchesToTwip(0.5) }
    }
  );

  const findingPurpose = [
    paragraph([
      new TextRun({ text: "FINDING: " }),
      new TextRun({
        text: data.finding,
        bold: true,
        underline: { type: UnderlineType.SINGLE }
      })
    ]),
    paragraph([
      new TextRun({ text: "PURPOSE: " }),
      new TextRun({
        text: data.purpose,
        bold: true,
        underline: { type: UnderlineType.SINGLE }
      })
    ])
  ];

  const casesAndIssuance = [
    paragraph([new TextRun({ text: "Criminal Cases: ___________" })], { alignment: AlignmentType.RIGHT }),
    paragraph([new TextRun({ text: "Civil Cases: ___________" })], { alignment: AlignmentType.RIGHT }),
    paragraph(
      [
        new TextRun({
          text: "Issued on the basis of the records/dockets obtained in this office since September 16, 1971 up to the present."
        })
      ],
      { alignment: AlignmentType.JUSTIFIED }
    )
  ];

  const dateLine = paragraph(
    [
      new TextRun({ text: "Given this " }),
      new TextRun({ text: dateParts.dayNum, underline: { type: UnderlineType.SINGLE } }),
      new TextRun({
        text: dateParts.daySuffix,
        superScript: true,
        size: 18,
        underline: { type: UnderlineType.SINGLE }
      }),
      new TextRun({ text: " day of " }),
      new TextRun({ text: dateParts.month, underline: { type: UnderlineType.SINGLE } }),
      new TextRun({ text: ", " }),
      new TextRun({ text: data.issueDate ? dateParts.year : "2026", underline: { type: UnderlineType.SINGLE } }),
      new TextRun({ text: " at Iriga City, Philippines." })
    ],
    { alignment: AlignmentType.CENTER }
  );

  const signatureBlock = [
    paragraph(signatureImage ? [signatureImage] : [new TextRun({ text: "" })], {
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80, line: 276 }
    }),
    paragraph([new TextRun({ text: data.signerName, bold: true, size: 24 })], { alignment: AlignmentType.CENTER }),
    paragraph([new TextRun({ text: data.signerTitle1, italics: true, size: 20 })], {
      alignment: AlignmentType.CENTER
    }),
    paragraph([new TextRun({ text: data.signerTitle2, italics: true, size: 20 })], {
      alignment: AlignmentType.CENTER
    })
  ];

  const stampSealRow = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: NO_BORDER,
      bottom: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
      insideH: NO_BORDER,
      insideV: NO_BORDER
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            borders: {
              top: SOLID_BORDER,
              bottom: SOLID_BORDER,
              left: SOLID_BORDER,
              right: SOLID_BORDER
            },
            children: [
              paragraph([new TextRun({ text: '"Documentary Stamp Tax Paid"', italics: true, size: 20 })], {
                alignment: AlignmentType.CENTER
              }),
              paragraph([new TextRun({ text: `OR. No. ${data.orNo} ${data.orDate}`, size: 20 })], {
                alignment: AlignmentType.CENTER
              })
            ]
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.BOTTOM,
            margins: { top: 60, bottom: 60, left: 40, right: 40 },
            borders: {
              top: NO_BORDER,
              bottom: NO_BORDER,
              left: NO_BORDER,
              right: NO_BORDER
            },
            children: [
              paragraph([new TextRun({ text: "NOT VALID WITHOUT DRY SEAL", bold: true, size: 20 })], {
                alignment: AlignmentType.RIGHT
              })
            ]
          })
        ]
      })
    ]
  });

  const footerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: NO_BORDER,
      bottom: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
      insideH: NO_BORDER,
      insideV: NO_BORDER
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            margins: { top: 60, bottom: 60, left: 40, right: 40 },
            borders: {
              top: NO_BORDER,
              bottom: NO_BORDER,
              left: NO_BORDER,
              right: NO_BORDER
            },
            children: [
              metadataLine("O.R. No.", data.orNo),
              metadataLine("Date:", data.orDate),
              metadataLine("CTC:", data.ctc),
              metadataLine("Issued at:", data.issuedAt),
              metadataLine("Issued on:", data.issuedOn)
            ]
          }),
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 80, bottom: 80, left: 40, right: 40 },
            borders: {
              top: NO_BORDER,
              bottom: NO_BORDER,
              left: NO_BORDER,
              right: NO_BORDER
            },
            children: [
              paragraph(photoImage ? [photoImage] : [new TextRun({ text: "" })], {
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 80, line: 240 }
              })
            ]
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 80, bottom: 80, left: 40, right: 40 },
            borders: {
              top: SOLID_BORDER,
              bottom: SOLID_BORDER,
              left: SOLID_BORDER,
              right: SOLID_BORDER
            },
            children: [
              paragraph([new TextRun({ text: "Right Hand thumb mark", size: 20 })], {
                alignment: AlignmentType.CENTER,
                spacing: { before: 120, after: 120, line: 240 }
              })
            ]
          })
        ]
      })
    ]
  });

  const closingLines = [
    new Paragraph({
      spacing: PARA_SPACING,
      border: { bottom: SOLID_BORDER },
      children: [new TextRun({ text: "Applicant's Signature", size: 20 })]
    }),
    paragraph([new TextRun({ text: "Note: Valid for 6 months from the date of issue.", italics: true, size: 20 })]),
    paragraph([new TextRun({ text: `Clearance/Certification No. ${data.certNo}`, bold: true, size: 20 })], {
      alignment: AlignmentType.CENTER
    })
  ];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: {
              top: convertInchesToTwip(0.5),
              right: convertInchesToTwip(0.5),
              bottom: convertInchesToTwip(0.5),
              left: convertInchesToTwip(0.5)
            }
          }
        },
        children: [
          headerTable,
          ...titleBlock,
          bodyParagraph,
          ...findingPurpose,
          ...casesAndIssuance,
          dateLine,
          ...signatureBlock,
          paragraph([new TextRun({ text: "" })], { spacing: { before: 0, after: 120, line: 240 } }),
          stampSealRow,
          paragraph([new TextRun({ text: "" })], { spacing: { before: 0, after: 120, line: 240 } }),
          footerTable,
          ...closingLines
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${data.fileName || "RTC_CLEARANCE"}.docx`);
}

export async function exportClearanceDocx(formData, fileName, assets = {}) {
  const normalizedAssets = {
    ...assets,
    photoSrc: assets.photoSrc || assets.photoImageUrl || "",
    signatureSrc: assets.signatureSrc || assets.sigImageUrl || ""
  };

  try {
    await exportClearanceDocxFromTemplate(formData, fileName, normalizedAssets);
    return;
  } catch {
    // Fall back to generated DOCX if template-based export fails.
  }

  const issueDate = `${formData.givenDay || ""} ${formData.givenMonth || ""}, ${formData.givenYear || ""}`.trim();

  return generateRTCClearance({
    name: formData.fullName || "",
    status: formData.civilStatus || "",
    dob: formData.dob || "",
    address: formData.address || "",
    finding: formData.finding || "NO CRIMINAL OR CIVIL CASE FILED OR PENDING.",
    purpose: formData.purpose || "MARRIAGE",
    orNo: formData.orNo || formData.stampOR || "",
    orDate: formData.orDate || formData.stampDate || "",
    ctc: formData.ctc || "",
    issuedAt: formData.issuedAt || "",
    issuedOn: formData.issuedOn || "",
    certNo: formData.certNo || "",
    sigImageUrl: normalizedAssets.signatureSrc,
    photoImageUrl: normalizedAssets.photoSrc,
    logoLeftUrl: normalizedAssets.logoLeftUrl || "/assets/supreme-court-seal.png",
    logoRightUrl: normalizedAssets.logoRightUrl || "/assets/supreme-court-seal.png",
    signerName: formData.clerkName || "",
    signerTitle1: formData.clerkTitle1 || "",
    signerTitle2: formData.clerkTitle2 || "",
    issueDate,
    courtName: formData.courtName || "REGIONAL TRIAL COURT",
    judicialRegion: formData.judicialRegion || "5th Judicial Region",
    courtCity: formData.courtCity || "Iriga City",
    courtEmail: formData.courtEmail || "rtc1iriocca@judiciary.gov.ph",
    courtTel: formData.courtTel || "(054)299-5922",
    fileName
  });
}
