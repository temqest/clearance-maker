import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "./supabase/client";

const MockContext = createContext();

const INITIAL_DOCUMENTS = [
  {
    id: "DOC-8921",
    paymentNo: "PAY-2026-8921",
    fullName: "DELA CRUZ, JUAN PEDRO",
    address: "Brgy. San Jose, Zone 3, Iriga City",
    purpose: "Local Employment Requirement",
    civilStatus: "Single",
    dateRequested: "2026-08-24",
    status: "Paid & Pending Print",
    orNumber: "OR-981245",
    amountPaid: "₱150.00",
    remarks: "Payment verified via Treasury E-Wallet",
    documentType: "Barangay / Court Clearance Pass",
  },
  {
    id: "DOC-3105",
    paymentNo: "PAY-2026-3105",
    fullName: "MERCADO, ANTONIO LUNA",
    address: "Zone 5, San Francisco, Iriga City",
    purpose: "Court Record & Verification Clearance",
    civilStatus: "Married",
    dateRequested: "2026-08-24",
    status: "Paid & Pending Print",
    orNumber: "OR-981290",
    amountPaid: "₱150.00",
    remarks: "Verified by Clerk Counter 3",
    documentType: "Official Court Clearance",
  },
  {
    id: "DOC-4409",
    paymentNo: "PAY-2026-4409",
    fullName: "SANTOS, MARIA CLARA",
    address: "Poblacion District 1, Main St., Iriga City",
    purpose: "Business Permit Clearance",
    civilStatus: "Married",
    dateRequested: "2026-08-24",
    status: "Printed & Released",
    orNumber: "OR-981210",
    amountPaid: "₱250.00",
    remarks: "Completed and released to constituent",
    documentType: "Business Clearance Pass",
  },
  {
    id: "DOC-5219",
    paymentNo: "PAY-2026-5219",
    fullName: "AQUINO, CORAZON COJUANGCO",
    address: "Santa Cruz Sur, Iriga City",
    purpose: "OFW Travel & Visa Requirement",
    civilStatus: "Single",
    dateRequested: "2026-08-24",
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

  // Restore state from localStorage & Supabase after mount
  useEffect(() => {
    setRole(getStoredValue("clearance_app_role", "user"));
    const localDocs = getStoredValue("clearance_app_documents", INITIAL_DOCUMENTS);
    setDocuments(localDocs);
    setUserPayment(getStoredValue("clearance_app_user_payment", null));
    setUserDocument(getStoredValue("clearance_app_user_document", null));
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
                dateRequested: row.created_at ? new Date(row.created_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
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

  /**
   * Universal document lookup by Ref ID, OR Number, Payment No, or Name
   */
  const lookupDocument = useCallback((query) => {
    if (!query || typeof query !== "string") return null;
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return null;

    return documents.find((doc) => {
      const matchId = doc.id && doc.id.toLowerCase() === cleanQuery;
      const matchPayment = doc.paymentNo && doc.paymentNo.toLowerCase() === cleanQuery;
      const matchOr = doc.orNumber && doc.orNumber.toLowerCase() === cleanQuery;
      const matchName = doc.fullName && doc.fullName.toLowerCase().includes(cleanQuery);
      return matchId || matchPayment || matchOr || matchName;
    }) || null;
  }, [documents]);

  const submitUserDocument = (docData) => {
    const constructedName = docData.lastName
      ? `${docData.lastName.trim().toUpperCase()}, ${docData.firstName.trim().toUpperCase()}${docData.middleName ? " " + docData.middleName.trim().toUpperCase() : ""}`
      : docData.fullName || "DELA CRUZ, JUAN PEDRO";

    const newDoc = {
      id: docData.id || `DOC-${Math.floor(1000 + Math.random() * 9000)}`,
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
      dateRequested: new Date().toISOString().split("T")[0],
      status: "Paid & Pending Print",
      orNumber: docData.orNumber || `OR-${Math.floor(100000 + Math.random() * 900000)}`,
      amountPaid: userPayment?.amount || "₱150.00",
      remarks: docData.remarks || "Submitted online by constituent",
      documentType: docData.documentType || "Standard Clearance Pass",
    };

    setUserDocument(newDoc);
    setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);

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
    const newDoc = {
      id: docData.id || `DOC-${Math.floor(1000 + Math.random() * 9000)}`,
      paymentNo: `STAFF-DIRECT-${Math.floor(1000 + Math.random() * 9000)}`,
      fullName: docData.fullName,
      address: docData.address || "",
      purpose: docData.purpose || "Local Employment",
      civilStatus: docData.civilStatus || "Single",
      dateRequested: new Date().toISOString().split("T")[0],
      status: "Printed & Released",
      orNumber: docData.orNumber || `OR-${Math.floor(100000 + Math.random() * 900000)}`,
      amountPaid: docData.amountPaid || "₱150.00",
      remarks: "Directly issued by Staff",
      documentType: docData.documentType || "Official Clearance Document",
    };

    setDocuments((prev) => [newDoc, ...prev]);

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
        markAsPrinted,
        deleteDocument,
        lookupDocument,
        resetAllStore,
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

