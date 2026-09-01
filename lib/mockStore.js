"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "./supabase/client";
import { formatEnglishDate } from "./formatters";

const MockContext = createContext();

const INITIAL_DOCUMENTS = [
  {
    id: "DOC-012",
    certNo: "012",
    paymentNo: "PAY-2026-0012",
    fullName: "RAMOS, ROSARIO BENITEZ",
    address: "Zone 2, San Miguel, Iriga City",
    purpose: "Local Employment Requirement",
    civilStatus: "Single",
    dateRequested: "August 25, 2026",
    status: "Paid & Pending Print",
    orNumber: "OR-981255",
    amountPaid: "₱150.00",
    remarks: "Verified Constituent Request",
    documentType: "Official Court Clearance",
  },
  {
    id: "DOC-8921",
    certNo: "8921",
    paymentNo: "PAY-2026-8921",
    fullName: "DELA CRUZ, JUAN PEDRO",
    address: "Brgy. San Jose, Zone 3, Iriga City",
    purpose: "Local Employment Requirement",
    civilStatus: "Single",
    dateRequested: "August 24, 2026",
    status: "Paid & Pending Print",
    orNumber: "OR-981245",
    amountPaid: "₱150.00",
    remarks: "Payment verified via Treasury E-Wallet",
    documentType: "Barangay / Court Clearance Pass",
  },
  {
    id: "DOC-3105",
    certNo: "3105",
    paymentNo: "PAY-2026-3105",
    fullName: "MERCADO, ANTONIO LUNA",
    address: "Zone 5, San Francisco, Iriga City",
    purpose: "Court Record & Verification Clearance",
    civilStatus: "Married",
    dateRequested: "August 24, 2026",
    status: "Paid & Pending Print",
    orNumber: "OR-981290",
    amountPaid: "₱150.00",
    remarks: "Verified by Clerk Counter 3",
    documentType: "Official Court Clearance",
  },
  {
    id: "DOC-4409",
    certNo: "4409",
    paymentNo: "PAY-2026-4409",
    fullName: "SANTOS, MARIA CLARA",
    address: "Poblacion District 1, Main St., Iriga City",
    purpose: "Business Permit Clearance",
    civilStatus: "Married",
    dateRequested: "August 24, 2026",
    status: "Printed & Released",
    orNumber: "OR-981210",
    amountPaid: "₱250.00",
    remarks: "Completed and released to constituent",
    documentType: "Business Clearance Pass",
  },
  {
    id: "DOC-5219",
    certNo: "5219",
    paymentNo: "PAY-2026-5219",
    fullName: "AQUINO, CORAZON COJUANGCO",
    address: "Santa Cruz Sur, Iriga City",
    purpose: "OFW Travel & Visa Requirement",
    civilStatus: "Single",
    dateRequested: "August 24, 2026",
    status: "Printed & Released",
    orNumber: "OR-981302",
    amountPaid: "₱150.00",
    remarks: "Official seal affixed and dispatched",
    documentType: "Official Court Clearance",
  }
];

function getStoredValue(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const item = window.localStorage.getItem(key);
    return item !== null ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function setStoredValue(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn("Storage save error", err);
  }
}

export function MockProvider({ children }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [role, setRole] = useState("user");
  const [documents, setDocuments] = useState(INITIAL_DOCUMENTS);
  const [userPayment, setUserPayment] = useState(null);
  const [userDocument, setUserDocument] = useState(null);

  const [nextCertNo, setNextCertNoState] = useState(1);

  // Restore state from localStorage & Supabase after mount
  useEffect(() => {
    setRole(getStoredValue("clearance_app_role", "user"));
    const localDocs = getStoredValue("clearance_app_documents", INITIAL_DOCUMENTS);
    
    // Ensure INITIAL_DOCUMENTS (like DOC-012) are merged with any existing local storage items
    const docMap = new Map();
    INITIAL_DOCUMENTS.forEach((d) => docMap.set(d.id, d));
    if (Array.isArray(localDocs)) {
      localDocs.forEach((d) => {
        if (d && d.id) docMap.set(d.id, d);
      });
    }
    setDocuments(Array.from(docMap.values()));
    setUserPayment(getStoredValue("clearance_app_user_payment", null));
    setUserDocument(getStoredValue("clearance_app_user_document", null));
    const savedCertNo = getStoredValue("clearance_next_cert_no", 1);
    const parsedCertNo = parseInt(savedCertNo, 10);
    if (!isNaN(parsedCertNo) && parsedCertNo > 0) {
      setNextCertNoState(parsedCertNo);
    }
    setIsHydrated(true);

    // Try fetching live documents from Supabase if configured
    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        supabase
          .from("documents")
          .select("*")
          .then(({ data, error }) => {
            if (!error && data && data.length > 0) {
              const mappedDbDocs = data.map((row) => ({
                id: row.cert_no || row.id,
                paymentNo: row.form_data?.paymentNo || `PAY-${row.id.slice(0, 6)}`,
                fullName: row.full_name || row.title || "ANONYMOUS",
                address: row.form_data?.address || "",
                purpose: row.purpose || row.form_data?.purpose || "General Purpose",
                civilStatus: row.form_data?.civilStatus || "Single",
                dateRequested: formatEnglishDate(row.created_at || new Date()),
                status: row.form_data?.status || "Paid & Pending Print",
                orNumber: row.form_data?.orNumber || "OR-ONLINE",
                amountPaid: row.form_data?.amountPaid || "₱150.00",
                remarks: row.form_data?.remarks || "Synced from database",
                documentType: row.form_data?.documentType || "Official Clearance Document",
              }));

              // Merge database docs with local docs (avoid duplicates by ID)
              setDocuments((prev) => {
                const map = new Map();
                mappedDbDocs.forEach((d) => map.set(d.id, d));
                prev.forEach((d) => {
                  if (!map.has(d.id)) map.set(d.id, d);
                });
                return Array.from(map.values());
              });
            }
          })
          .catch(() => {});
      }
    } catch (err) {}
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    if (isHydrated) setStoredValue("clearance_app_role", role);
  }, [role, isHydrated]);

  useEffect(() => {
    if (isHydrated) setStoredValue("clearance_app_documents", documents);
  }, [documents, isHydrated]);

  useEffect(() => {
    if (isHydrated) setStoredValue("clearance_app_user_payment", userPayment);
  }, [userPayment, isHydrated]);

  useEffect(() => {
    if (isHydrated) setStoredValue("clearance_app_user_document", userDocument);
  }, [userDocument, isHydrated]);

  // Listen for localStorage changes across browser tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "clearance_app_documents" && e.newValue) {
        try {
          setDocuments(JSON.parse(e.newValue));
        } catch (err) {}
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorageChange);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorageChange);
      }
    };
  }, []);

  /**
   * Universal document lookup by Ref ID, OR Number, Payment No, or Name with numeric normalization
   */
  const lookupDocument = useCallback((query) => {
    if (!query || typeof query !== "string") return null;
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return null;

    // Extract sequence of digits for numeric equivalence (e.g. DOC-012, DOC-12, 012, 12)
    const queryDigits = cleanQuery.replace(/\D/g, "");
    const queryNum = queryDigits ? parseInt(queryDigits, 10) : null;

    return documents.find((doc) => {
      if (!doc) return false;

      const matchId = doc.id && doc.id.toLowerCase().includes(cleanQuery);
      const matchCertNo = doc.certNo && String(doc.certNo).toLowerCase().includes(cleanQuery);
      const matchPayment = doc.paymentNo && doc.paymentNo.toLowerCase().includes(cleanQuery);
      const matchOr = (doc.orNumber || doc.orNo) && String(doc.orNumber || doc.orNo).toLowerCase().includes(cleanQuery);
      const matchName = doc.fullName && doc.fullName.toLowerCase().includes(cleanQuery);

      if (matchId || matchCertNo || matchPayment || matchOr || matchName) return true;

      if (queryNum !== null && !isNaN(queryNum)) {
        const idDigits = (doc.id || "").replace(/\D/g, "");
        const certDigits = String(doc.certNo || "").replace(/\D/g, "");
        const paymentDigits = (doc.paymentNo || "").replace(/\D/g, "");
        const orDigits = String(doc.orNumber || doc.orNo || "").replace(/\D/g, "");

        if (idDigits && parseInt(idDigits, 10) === queryNum) return true;
        if (certDigits && parseInt(certDigits, 10) === queryNum) return true;
        if (paymentDigits && parseInt(paymentDigits, 10) === queryNum) return true;
        if (orDigits && parseInt(orDigits, 10) === queryNum) return true;
      }

      return false;
    }) || null;
  }, [documents]);

  const updateNextCertNo = useCallback((val) => {
    const num = parseInt(val, 10);
    const validNum = !isNaN(num) && num > 0 ? num : 1;
    setNextCertNoState(validNum);
    setStoredValue("clearance_next_cert_no", validNum);
  }, []);

  const incrementCertNo = useCallback(() => {
    setNextCertNoState((prev) => {
      const next = prev + 1;
      setStoredValue("clearance_next_cert_no", next);
      return next;
    });
  }, []);

  const submitUserDocument = (docData) => {
    const constructedName = docData.lastName
      ? `${docData.lastName.trim().toUpperCase()}, ${docData.firstName.trim().toUpperCase()}${docData.middleName ? " " + docData.middleName.trim().toUpperCase() : ""}`
      : docData.fullName || "DELA CRUZ, JUAN PEDRO";

    const assignedCertNo = docData.certNo || String(nextCertNo);

    const newDoc = {
      id: docData.id || `DOC-${assignedCertNo}`,
      certNo: assignedCertNo,
      paymentNo: userPayment?.paymentNo || docData.paymentNo || `PAY-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      fullName: constructedName,
      birthDate: docData.birthDate || "",
      birthPlace: docData.birthPlace || "",
      gender: docData.gender || "Male",
      citizenship: docData.citizenship || "Filipino",
      contactNo: docData.contactNo || "",
      address: docData.address || "",
      purpose: docData.purpose || "Official Purpose",
      civilStatus: docData.civilStatus || "Single",
      dateRequested: formatEnglishDate(new Date()),
      status: "Paid & Pending Print",
      orNumber: docData.orNumber || `OR-${Math.floor(100000 + Math.random() * 900000)}`,
      ctcNumber: docData.ctcNumber || docData.ctc || "",
      ctc: docData.ctcNumber || docData.ctc || "",
      amountPaid: userPayment?.amount || "₱150.00",
      remarks: docData.remarks || "Submitted online by constituent",
      finding: "NO DEROGATORY RECORD FOUND",
      documentType: docData.documentType || "Standard Clearance Pass",
      photoSrc: docData.photoSrc || "",
      source: "Online Applicant Self-Request",
      isSelfRequest: true,
    };

    setUserDocument(newDoc);
    setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
    incrementCertNo();

    // Asynchronously insert to Supabase if connected
    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        supabase
          .from("documents")
          .insert({
            title: newDoc.fullName,
            full_name: newDoc.fullName,
            purpose: newDoc.purpose,
            cert_no: newDoc.id,
            form_data: newDoc,
          })
          .catch(() => {});
      }
    } catch (err) {}

    return newDoc;
  };

  const createStaffDocument = (docData) => {
    const assignedCertNo = docData.certNo || String(nextCertNo);

    const newDoc = {
      id: docData.id || `DOC-${assignedCertNo}`,
      certNo: assignedCertNo,
      paymentNo: `STAFF-DIRECT-${Math.floor(1000 + Math.random() * 9000)}`,
      fullName: docData.fullName,
      address: docData.address || "",
      purpose: docData.purpose || "Local Employment",
      civilStatus: docData.civilStatus || "Single",
      dateRequested: formatEnglishDate(new Date()),
      status: "Printed & Released",
      orNumber: docData.orNumber || `OR-${Math.floor(100000 + Math.random() * 900000)}`,
      ctcNumber: docData.ctcNumber || docData.ctc || "",
      ctc: docData.ctcNumber || docData.ctc || "",
      amountPaid: docData.amountPaid || "₱150.00",
      remarks: "Directly issued by Staff",
      finding: docData.finding || "NO DEROGATORY RECORD FOUND",
      documentType: docData.documentType || "Official Clearance Document",
      photoSrc: docData.photoSrc || "",
    };

    setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
    incrementCertNo();

    // Asynchronously insert to Supabase if connected
    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        supabase
          .from("documents")
          .insert({
            title: newDoc.fullName,
            full_name: newDoc.fullName,
            purpose: newDoc.purpose,
            cert_no: newDoc.id,
            form_data: newDoc,
          })
          .catch(() => {});
      }
    } catch (err) {}

    return newDoc;
  };

  const updateDocument = (docId, updatedFields) => {
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === docId) {
          const updated = {
            ...doc,
            ...updatedFields,
            photoSrc: updatedFields.photoSrc !== undefined ? updatedFields.photoSrc : (doc.photoSrc || ""),
            status: updatedFields.status || "Printed & Released"
          };
          if (userDocument && userDocument.id === docId) {
            setUserDocument(updated);
          }
          return updated;
        }
        return doc;
      })
    );
  };

  const markAsPrinted = (docId) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === docId ? { ...doc, status: "Printed & Released" } : doc))
    );
    if (userDocument && userDocument.id === docId) {
      setUserDocument((prev) => ({ ...prev, status: "Printed & Released" }));
    }

    // Asynchronously update Supabase if connected
    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        supabase
          .from("documents")
          .update({ form_data: { status: "Printed & Released" } })
          .eq("cert_no", docId)
          .catch(() => {});
      }
    } catch (err) {}
  };

  const deleteDocument = (docId) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
    if (userDocument && userDocument.id === docId) {
      setUserDocument(null);
    }

    // Asynchronously delete from Supabase if connected
    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        supabase
          .from("documents")
          .delete()
          .eq("cert_no", docId)
          .catch(() => {});
      }
    } catch (err) {}
  };

  const resetAllStore = () => {
    setUserPayment(null);
    setUserDocument(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("clearance_app_user_payment");
      window.localStorage.removeItem("clearance_app_user_document");
    }
  };

  return (
    <MockContext.Provider
      value={{
        role,
        setRole,
        documents,
        userPayment,
        setUserPayment,
        userDocument,
        setUserDocument,
        submitUserDocument,
        createStaffDocument,
        updateDocument,
        markAsPrinted,
        deleteDocument,
        lookupDocument,
        resetAllStore,
        nextCertNo,
        updateNextCertNo,
        incrementCertNo,
      }}
    >
      {children}
    </MockContext.Provider>
  );
}

export function useMock() {
  const context = useContext(MockContext);
  if (!context) {
    throw new Error("useMock must be used within a MockProvider");
  }
  return context;
}

