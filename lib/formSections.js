export const formSections = [
  {
    title: "Court Information",
    fields: [
      { id: "courtName", label: "Court Name", type: "text" },
      { id: "judicialRegion", label: "Judicial Region", type: "text" },
      { id: "courtCity", label: "City", type: "text" },
      { id: "courtEmail", label: "Email", type: "text" },
      { id: "courtTel", label: "Tel. No.", type: "text" }
    ]
  },
  {
    title: "Applicant Details",
    fields: [
      { id: "fullName", label: "Full Name", type: "text" },
      { id: "nationality", label: "Nationality", type: "text" },
      {
        id: "civilStatus",
        label: "Civil Status",
        type: "select",
        options: ["Single", "Married", "Widowed", "Separated"]
      },
      { id: "dob", label: "Date of Birth", type: "text" },
      { id: "address", label: "Address", type: "textarea" }
    ]
  },
  {
    title: "Clearance Details",
    fields: [
      { id: "finding", label: "Finding", type: "textarea" },
      { id: "purpose", label: "Purpose", type: "text" }
    ]
  },
  {
    title: "Issuance",
    fields: [
      { id: "givenDay", label: "Day (ordinal, e.g. 10th)", type: "text" },
      { id: "givenMonth", label: "Month", type: "text" },
      { id: "givenYear", label: "Year", type: "text" },
      { id: "givenPlace", label: "Place", type: "text" }
    ]
  },
  {
    title: "Signatory",
    fields: [
      { id: "clerkName", label: "Clerk Name", type: "text" },
      { id: "clerkTitle1", label: "Title Line 1", type: "text" },
      { id: "clerkTitle2", label: "Title Line 2", type: "text" }
    ]
  },
  {
    title: "Documentary Stamp",
    fields: [
      { id: "stampOR", label: "OR Number", type: "text" },
      { id: "stampDate", label: "Stamp Date", type: "text" }
    ]
  },
  {
    title: "Bottom OR Block",
    fields: [
      { id: "orNo", label: "O.R. No.", type: "text" },
      { id: "orDate", label: "Date", type: "text" },
      { id: "ctc", label: "CTC", type: "text" },
      { id: "issuedAt", label: "Issued At", type: "text" },
      { id: "issuedOn", label: "Issued On", type: "text" },
      { id: "certNo", label: "Clearance / Certification No.", type: "text" }
    ]
  }
];
