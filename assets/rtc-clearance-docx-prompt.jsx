import { useState } from "react";

const PROMPT = `# TASK: Reproduce a Philippine Government Clearance Document as a Pixel-Perfect DOCX File

## CONTEXT & PROBLEM
You are building a DOCX export feature in a Next.js/React app using the \`docx\` npm library. The goal is to reproduce a Philippine Regional Trial Court (RTC) Clearance document that currently has these critical issues when exported:
- Missing images (logos, applicant photo, signature)
- Wrong font sizes (because docx uses half-points, not points)
- Missing or broken spacing between paragraphs and sections
- Borders on table cells not rendering
- Underlined/bold inline text not applied correctly
- Right-alignment and centering not working on certain paragraphs
- Superscript (e.g. "10th") not rendering
- Thumb mark box and stamp box borders missing

---

## THE DOCUMENT STRUCTURE (11 Sections)

The document has these sections in order — reproduce ALL of them:

### §1 — HEADER (3-Column Table, No Borders)
- Left cell: Supreme Court seal logo image (~60×60px)
- Center cell: 6 stacked centered paragraphs:
  - "Republic of the Philippines" (small, normal)
  - "REGIONAL TRIAL COURT" (large, bold)
  - "5th Judicial Region" (small)
  - "Iriga City" (small)
  - email (small, italic)
  - telephone number (small, italic)
- Right cell: Supreme Court seal logo image (~60×60px, mirrored/same)
- Table has NO visible borders on any side

### §2 — TITLE BLOCK (2 Centered Paragraphs)
- "OFFICE OF THE CLERK OF COURT" — bold, centered, ~12pt
- "C  L  E  A  R  A  N  C  E" — bold, centered, ~16pt, with extra character spacing between each letter

### §3 — BODY PARAGRAPH (Justified, First-Line Indented)
- Starts with: "In connection with the application…"
- These inline parts are BOLD + UNDERLINED within the same paragraph:
  - Person's full name
  - Civil status (e.g. "Single")
  - Date of birth (e.g. "December 6, 1997")
  - Address
- All other text is normal weight
- Alignment: JUSTIFIED
- First line indent: 0.5 inches

### §4 — FINDING & PURPOSE (2 Paragraphs)
- "FINDING: " (normal) + "NO CRIMINAL OR CIVIL CASE FILED OR PENDING." (bold + underlined)
- "PURPOSE: " (normal) + "MARRIAGE" (bold + underlined)

### §5 — CASE LINES (Right-Aligned)
- "Criminal Cases: ___________" — right aligned
- "Civil Cases: ___________" — right aligned

### §6 — ISSUANCE NOTE (Justified Paragraph)
- "Issued on the basis of the records/dockets obtained in this office since September 16, 1971 up to the present."

### §7 — DATE LINE (Centered, with underlines and superscript)
- "Given this " + underlined("10") + superscript underlined("th") + " day of " + underlined("April") + ",  " + underlined("2026") + " at Iriga City, Philippines."

### §8 — SIGNATURE BLOCK (3 Centered Paragraphs + 1 Image)
- ImageRun: signature image (PNG with transparent background, ~100×40px)
- "HARLETTE R. ARROYO-POTENCIO" — bold, centered, slightly larger
- "Clerk of Court VI" — italic, centered
- "Ex-Officio Provincial Sheriff & Notary Public" — italic, centered

### §9 — STAMP + SEAL ROW (2-Column Table)
- Left cell (has solid border on all 4 sides):
  - Line 1: '"Documentary Stamp Tax Paid"' — italic
  - Line 2: "OR. No. JEP-26-002930392 April 10, 2026" — normal
- Right cell (no border):
  - "NOT VALID WITHOUT DRY SEAL" — bold, right-aligned, bottom-aligned

### §10 — FOOTER TABLE (3-Column Table, No Outer Borders)
- Left column (~35% width): metadata block
  - Each row: label + underlined value on one line
  - "O.R. No.   JEP-26-002930392"
  - "Date:       April 10, 2026"
  - "CTC:        07542696"
  - "Issued at:  Iriga City"
  - "Issued on:  April 7, 2026"
- Center column (~35% width): ImageRun of applicant's photo (~100×120px), centered
- Right column (~30% width): bordered box (solid border all 4 sides) with centered text "Right Hand thumb mark"

### §11 — CLOSING LINES (3 Paragraphs)
- "Applicant's Signature" with a bottom-border underline beneath the paragraph (simulates a signature line)
- "Note: Valid for 6 months from the date of issue." — italic
- "Clearance/Certification No. 056" — bold, centered

---

## CRITICAL DOCX RULES (Fix all common mistakes)

### Font sizes — ALWAYS use half-points
| Visual size | docx size value |
|---|---|
| 10pt | 20 |
| 11pt | 22 |
| 12pt | 24 |
| 14pt | 28 |
| 16pt | 32 |

### Images — ALWAYS load as Buffer, never pass a URL string
\`\`\`ts
async function toBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}
// Then:
new ImageRun({ data: await toBuffer("/images/logo.png"), transformation: { width: 60, height: 60 } })
\`\`\`

### Borders — Use BorderStyle enum, never string literals
\`\`\`ts
import { BorderStyle } from "docx";
const solidBorder = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
const noBorder    = { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" };
\`\`\`

### Tables with no visible borders
\`\`\`ts
new Table({
  borders: {
    top: noBorder, bottom: noBorder,
    left: noBorder, right: noBorder,
    insideH: noBorder, insideV: noBorder,
  },
  ...
})
\`\`\`

### Underline inline text
\`\`\`ts
import { UnderlineType } from "docx";
new TextRun({ text: "JULLEANE SALAZAR", bold: true, underline: { type: UnderlineType.SINGLE } })
\`\`\`

### Superscript
\`\`\`ts
new TextRun({ text: "th", superScript: true, underline: { type: UnderlineType.SINGLE }, size: 18 })
\`\`\`

### Paragraph spacing — add to EVERY paragraph
\`\`\`ts
new Paragraph({ spacing: { before: 0, after: 160, line: 276 }, ... })
\`\`\`

### Signature line (bottom border on paragraph)
\`\`\`ts
new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" } },
  children: [new TextRun({ text: "Applicant's Signature", size: 20 })]
})
\`\`\`

---

## PAGE SETUP
\`\`\`ts
sections: [{
  properties: {
    page: {
      size: { width: 12240, height: 15840 }, // Letter size (8.5 x 11 in)
      margin: { top: 720, right: 720, bottom: 720, left: 720 }, // 0.5in all sides
    }
  },
  children: [ /* all sections in order */ ]
}]
\`\`\`

---

## STEP-BY-STEP INSTRUCTIONS

Follow these steps IN ORDER. Do not skip any:

1. Import all required named exports from \`docx\`: Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, UnderlineType, VerticalAlign, convertInchesToTwip

2. Create a \`toBuffer(url)\` async helper that fetches an image URL and returns a Buffer

3. Build §1 (header table) with 3 columns and image cells

4. Build §2 (title block) with spaced character text

5. Build §3 (body paragraph) with mixed inline TextRuns — some normal, some bold+underlined — all in one Paragraph, justified, first-line indented

6. Build §4 (finding/purpose) as 2 separate Paragraphs with inline bold+underline runs

7. Build §5 (case lines) as right-aligned Paragraphs

8. Build §6 (issuance note) as a justified Paragraph

9. Build §7 (date line) as a centered Paragraph with underlined segments and a superscript "th"

10. Build §8 (signature block) — first load the signature PNG as a Buffer, then ImageRun + 3 centered text Paragraphs

11. Build §9 (stamp row) as a 2-column Table where the left cell has solid borders

12. Build §10 (footer table) as a 3-column Table: metadata lines left, photo center, thumb box right with border

13. Build §11 (closing lines) including the signature underline paragraph, the italic note, and the centered certification number

14. Assemble all sections into a single Document with letter-size page and 0.5in margins

15. Use \`Packer.toBlob(doc)\` and \`saveAs(blob, "RTC_CLEARANCE.docx")\` to trigger the download

---

## WHAT TO PRODUCE
- A single TypeScript/React function called \`generateRTCClearance(data)\` that accepts a data object
- The data object should have fields: name, status, dob, address, finding, purpose, orNo, orDate, ctc, issuedAt, issuedOn, certNo, sigImageUrl, photoImageUrl, logoLeftUrl, logoRightUrl, signerName, signerTitle1, signerTitle2, issueDate
- The function should build and download the DOCX when called
- Add proper TypeScript types for the data parameter
- Export the function as a named export

Do not use placeholder comments. Write all 11 sections fully.`;

const SECTIONS = [
  { id: "§1", label: "Header (logo table)", color: "#3B82F6", bg: "#EFF6FF" },
  { id: "§2", label: "Title block", color: "#7C3AED", bg: "#F5F3FF" },
  { id: "§3", label: "Body paragraph", color: "#0D9488", bg: "#F0FDFA" },
  { id: "§4", label: "Finding & Purpose", color: "#D97706", bg: "#FFFBEB" },
  { id: "§5", label: "Case lines", color: "#6B7280", bg: "#F9FAFB" },
  { id: "§6", label: "Issuance note", color: "#0D9488", bg: "#F0FDFA" },
  { id: "§7", label: "Date line", color: "#6B7280", bg: "#F9FAFB" },
  { id: "§8", label: "Signature block", color: "#7C3AED", bg: "#F5F3FF" },
  { id: "§9", label: "Stamp + Seal row", color: "#DC2626", bg: "#FEF2F2" },
  { id: "§10", label: "Footer table (photo)", color: "#3B82F6", bg: "#EFF6FF" },
  { id: "§11", label: "Closing lines", color: "#6B7280", bg: "#F9FAFB" },
];

const ISSUES = [
  { icon: "🖼", title: "Images missing", fix: "Pass Buffer (not URL string) to ImageRun" },
  { icon: "📏", title: "Wrong font sizes", fix: "docx uses half-points — multiply pt × 2" },
  { icon: "↕", title: "No spacing", fix: "Add spacing: { after, before, line } to every Paragraph" },
  { icon: "▭", title: "Borders not showing", fix: "Use BorderStyle.SINGLE enum, not string \"single\"" },
  { icon: "U̲", title: "Underlines missing", fix: "Use UnderlineType.SINGLE inside each TextRun" },
  { icon: "ᵗʰ", title: "Superscript broken", fix: "Add superScript: true on the TextRun" },
  { icon: "⬜", title: "Table borders gone", fix: "Set all 6 border keys on Table and TableCell" },
  { icon: "✍", title: "Signature missing", fix: "Fetch PNG → Buffer → ImageRun with transformation" },
];

export default function PromptViewer() {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState("overview");

  const copy = () => {
    navigator.clipboard.writeText(PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 860, margin: "0 auto", padding: "24px 16px", color: "#111" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ background: "#1E3A5F", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4, letterSpacing: 1 }}>DOCX EXPORT</div>
          <div style={{ background: "#FEF3C7", color: "#92400E", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4 }}>RTC Clearance · 11 Sections</div>
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111" }}>AI Prompt — Philippine RTC Clearance</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6B7280" }}>Paste this into your AI to generate a pixel-perfect DOCX export function</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #E5E7EB" }}>
        {[["overview", "Overview"], ["issues", "8 Issues & Fixes"], ["sections", "11 Sections"], ["prompt", "Full Prompt"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: "8px 14px", fontSize: 13, fontWeight: tab === id ? 600 : 400, border: "none", background: "none", borderBottom: tab === id ? "2px solid #1E3A5F" : "2px solid transparent", color: tab === id ? "#1E3A5F" : "#6B7280", cursor: "pointer", marginBottom: -1 }}>{label}</button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div>
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "16px 18px", marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#166534", marginBottom: 6 }}>✅ What this prompt will make your AI produce</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#166534", lineHeight: 2 }}>
              <li>A TypeScript function <code style={{ background: "#DCFCE7", padding: "1px 5px", borderRadius: 3 }}>generateRTCClearance(data)</code> with full types</li>
              <li>All 11 document sections built with the <code style={{ background: "#DCFCE7", padding: "1px 5px", borderRadius: 3 }}>docx</code> library — no placeholders</li>
              <li>Images fetched as Buffers and embedded with <code style={{ background: "#DCFCE7", padding: "1px 5px", borderRadius: 3 }}>ImageRun</code></li>
              <li>Correct font sizes, spacing, borders, underlines, and superscripts</li>
              <li>DOCX downloads via <code style={{ background: "#DCFCE7", padding: "1px 5px", borderRadius: 3 }}>Packer.toBlob</code> + <code style={{ background: "#DCFCE7", padding: "1px 5px", borderRadius: 3 }}>saveAs</code></li>
            </ul>
          </div>
          <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "16px 18px", marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#9A3412", marginBottom: 6 }}>⚠️ What to prepare before running</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#9A3412", lineHeight: 2 }}>
              <li>Left & right seal logo images (PNG) hosted in your <code style={{ background: "#FEE2E2", padding: "1px 5px", borderRadius: 3 }}>/public</code> folder</li>
              <li>Signature image (PNG, transparent background preferred)</li>
              <li>Applicant photo (JPG or PNG)</li>
              <li><code style={{ background: "#FEE2E2", padding: "1px 5px", borderRadius: 3 }}>npm install docx file-saver</code> in your project</li>
            </ul>
          </div>
          <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1E40AF", marginBottom: 8 }}>🚀 How to use this prompt</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#1E40AF", lineHeight: 2.2 }}>
              <li>Click <strong>"Full Prompt"</strong> tab → copy the prompt</li>
              <li>Paste it into your AI (Claude, GPT-4, etc.)</li>
              <li>Replace image URLs and data values with your actual paths</li>
              <li>The AI will output a complete <code style={{ background: "#DBEAFE", padding: "1px 5px", borderRadius: 3 }}>generateRTCClearance.ts</code> file</li>
              <li>Import and call it from your export button</li>
            </ol>
          </div>
        </div>
      )}

      {/* Issues Tab */}
      {tab === "issues" && (
        <div>
          <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 16px" }}>These are the exact reasons your current DOCX export is broken — and how to fix each one.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {ISSUES.map((issue, i) => (
              <div key={i} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "14px 16px", background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{issue.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#DC2626" }}>{issue.title}</span>
                </div>
                <div style={{ fontSize: 12, color: "#374151", background: "#F9FAFB", borderRadius: 6, padding: "8px 10px", lineHeight: 1.6 }}>
                  <span style={{ color: "#059669", fontWeight: 600 }}>Fix: </span>{issue.fix}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ background: "#F9FAFB", padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "#374151", borderBottom: "1px solid #E5E7EB" }}>FONT SIZE REFERENCE — docx uses half-points</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#F3F4F6" }}>
                  {["Visual PT", "docx size", "Use for"].map(h => <th key={h} style={{ padding: "8px 14px", textAlign: "left", color: "#374151", fontWeight: 600 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {[["10pt","20","Fine print, notes"],["11pt","22","Body text"],["12pt","24","Section headers"],["14pt","28","Bold titles"],["16pt","32","C L E A R A N C E"]].map(([pt, val, use], i) => (
                  <tr key={i} style={{ borderTop: "1px solid #E5E7EB" }}>
                    <td style={{ padding: "8px 14px", fontFamily: "monospace", color: "#DC2626" }}>{pt}</td>
                    <td style={{ padding: "8px 14px", fontFamily: "monospace", color: "#059669", fontWeight: 700 }}>{val}</td>
                    <td style={{ padding: "8px 14px", color: "#374151" }}>{use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sections Tab */}
      {tab === "sections" && (
        <div>
          <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 16px" }}>Every section the AI must generate, in document order.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {SECTIONS.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 16px", background: "#fff" }}>
                <div style={{ background: s.bg, color: s.color, fontWeight: 800, fontSize: 13, padding: "4px 10px", borderRadius: 6, minWidth: 36, textAlign: "center", border: `1px solid ${s.color}22` }}>{s.id}</div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#111" }}>{s.label}</div>
                <div style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: s.color }} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#374151" }}>
            <strong>Document order:</strong> §1 → §2 → §3 → §4 → §5 → §6 → §7 → §8 → §9 → §10 → §11 — all inside a single <code>sections[0].children</code> array.
          </div>
        </div>
      )}

      {/* Full Prompt Tab */}
      {tab === "prompt" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Copy and paste this entire prompt into your AI.</p>
            <button onClick={copy} style={{ background: copied ? "#059669" : "#1E3A5F", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.2s" }}>
              {copied ? "✓ Copied!" : "Copy Prompt"}
            </button>
          </div>
          <pre style={{ background: "#0F172A", color: "#E2E8F0", borderRadius: 10, padding: "20px", fontSize: 11.5, lineHeight: 1.7, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 520, overflowY: "auto" }}>
            {PROMPT}
          </pre>
          <div style={{ marginTop: 12, background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#9A3412" }}>
            <strong>Tip:</strong> After pasting, add this at the end: <em>"Use these image paths: logoLeft='/images/seal-left.png', logoRight='/images/seal-right.png', signature='/images/signature.png', photo='/images/applicant.jpg'"</em> — or whatever your actual paths are.
          </div>
        </div>
      )}
    </div>
  );
}
