import { saveAs } from "file-saver";
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
    sigImageUrl: assets.signatureSrc || "",
    photoImageUrl: assets.photoSrc || "",
    logoLeftUrl: assets.logoLeftUrl || "/assets/supreme-court-seal.png",
    logoRightUrl: assets.logoRightUrl || "/assets/supreme-court-seal.png",
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
