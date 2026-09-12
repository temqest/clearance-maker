"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "./supabase/client";
import { formatEnglishDate } from "./formatters";

const MockContext = createContext();

const INITIAL_DOCUMENTS = [];

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
  const [documents, setDocuments] = useState([]);
  const [userPayment, setUserPayment] = useState(null);
  const [userDocument, setUserDocument] = useState(null);

  const [nextCertNo, setNextCertNoState] = useState(1);

  // Restore state from localStorage & Supabase after mount
  useEffect(() => {
    setRole(getStoredValue("clearance_app_role", "user"));
    
    // Purge legacy browser localStorage documents to prevent stale cached data
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("clearance_app_documents");
    }
    setDocuments([]);

    setUserPayment(getStoredValue("clearance_app_user_payment", null));
    setUserDocument(getStoredValue("clearance_app_user_document", null));
    const savedCertNo = getStoredValue("clearance_next_cert_no", 1);
    const parsedCertNo = parseInt(savedCertNo, 10);
    if (!isNaN(parsedCertNo) && parsedCertNo > 0) {
      setNextCertNoState(parsedCertNo);
    }
    setIsHydrated(true);

    // Try fetching live documents from Supabase & subscribe to Realtime updates
    let channel = null;
    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        supabase
          .from("documents")
          .select("*")
          .then(({ data, error }) => {
            if (!error && data && data.length > 0) {
              const mappedDbDocs = data.map((row) => {
                const formData = row.form_data || {};
                const ctcVal = row.ctc_number || formData.ctcNumber || formData.ctc || "";
                return {
                  ...formData,
                  id: row.cert_no || row.id,
                  certNo: row.cert_no ? String(row.cert_no).replace(/^DOC-/, "") : (formData.certNo || String(row.id)),
                  paymentNo: formData.paymentNo || `PAY-${String(row.id).slice(0, 6)}`,
                  fullName: formData.fullName || row.full_name || row.title || "ANONYMOUS",
                  address: formData.address || "",
                  purpose: row.purpose || formData.purpose || "General Purpose",
                  civilStatus: formData.civilStatus || "Single",
                  dateRequested: formatEnglishDate(row.created_at || new Date()),
                  status: formData.status || "Paid & Pending Print",
                  orNumber: row.or_number || formData.orNumber || "OR-ONLINE",
                  ctcNumber: ctcVal,
                  ctc: ctcVal,
                  amountPaid: formData.amountPaid || "₱150.00",
                  remarks: formData.remarks || "Synced from database",
                  documentType: formData.documentType || "Official Clearance Document",
                  photoSrc: formData.photoSrc || "",
                };
              });

              setDocuments(mappedDbDocs);

              let maxCertNum = 0;
              data.forEach((row) => {
                const digits = String(row.cert_no || row.id).replace(/\D/g, "");
                const parsed = parseInt(digits, 10);
                if (!isNaN(parsed) && parsed > maxCertNum && parsed < 1000000) {
                  maxCertNum = parsed;
                }
              });
              if (maxCertNum > 0) {
                setNextCertNoState(maxCertNum + 1);
              }
            }
          })
          .catch(() => {});

        // Setup Realtime subscription for instant multi-user counter synchronization
        channel = supabase
          .channel("realtime_documents")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "documents" },
            (payload) => {
              if (payload.new) {
                const row = payload.new;
                const formData = row.form_data || {};
                const ctcVal = row.ctc_number || formData.ctcNumber || formData.ctc || "";
                const syncedDoc = {
                  ...formData,
                  id: row.cert_no || row.id,
                  certNo: row.cert_no ? String(row.cert_no).replace(/^DOC-/, "") : (formData.certNo || String(row.id)),
                  paymentNo: formData.paymentNo || `PAY-${String(row.id).slice(0, 6)}`,
                  fullName: formData.fullName || row.full_name || row.title || "ANONYMOUS",
                  address: formData.address || "",
                  purpose: row.purpose || formData.purpose || "General Purpose",
                  civilStatus: formData.civilStatus || "Single",
                  dateRequested: formatEnglishDate(row.created_at || new Date()),
                  status: formData.status || "Paid & Pending Print",
                  orNumber: row.or_number || formData.orNumber || "OR-ONLINE",
                  ctcNumber: ctcVal,
                  ctc: ctcVal,
                  amountPaid: formData.amountPaid || "₱150.00",
                  remarks: formData.remarks || "Realtime update",
                  documentType: formData.documentType || "Official Clearance Document",
                  photoSrc: formData.photoSrc || "",
                };

                setDocuments((prev) => {
                  const map = new Map();
                  map.set(syncedDoc.id, syncedDoc);
                  prev.forEach((d) => {
                    if (!map.has(d.id)) map.set(d.id, d);
                  });
                  return Array.from(map.values());
                });
              }
            }
          )
          .subscribe();
      }
    } catch (err) {}

    return () => {
      if (channel) {
        try {
          const supabase = createSupabaseBrowserClient();
          if (supabase) supabase.removeChannel(channel);
        } catch (e) {}
      }
    };
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    if (isHydrated) setStoredValue("clearance_app_role", role);
  }, [role, isHydrated]);

  useEffect(() => {
    if (isHydrated) setStoredValue("clearance_app_user_payment", userPayment);
  }, [userPayment, isHydrated]);

  useEffect(() => {
    if (isHydrated) setStoredValue("clearance_app_user_document", userDocument);
  }, [userDocument, isHydrated]);

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

  /**
   * Async document lookup that queries in-memory state AND live Supabase DB
   */
  const lookupDocumentAsync = useCallback(async (query) => {
    if (!query || typeof query !== "string") return null;
    const cleanQuery = query.trim();
    if (!cleanQuery) return null;

    // 1. Try local memory state first
    const syncMatch = lookupDocument(cleanQuery);
    if (syncMatch) return syncMatch;

    // 2. Query live Supabase database
    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        const { data, error } = await supabase
          .from("documents")
          .select("*")
          .or(`cert_no.ilike.%${cleanQuery}%,full_name.ilike.%${cleanQuery}%,or_number.ilike.%${cleanQuery}%`)
          .limit(5);

        if (!error && data && data.length > 0) {
          const row = data[0];
          const formData = row.form_data || {};
          const ctcVal = row.ctc_number || formData.ctcNumber || formData.ctc || "";
          const fetchedDoc = {
            ...formData,
            id: row.cert_no || row.id,
            certNo: row.cert_no ? String(row.cert_no).replace(/^DOC-/, "") : (formData.certNo || String(row.id)),
            paymentNo: formData.paymentNo || `PAY-${String(row.id).slice(0, 6)}`,
            fullName: formData.fullName || row.full_name || row.title || "ANONYMOUS",
            address: formData.address || "",
            purpose: row.purpose || formData.purpose || "General Purpose",
            civilStatus: formData.civilStatus || "Single",
            dateRequested: formatEnglishDate(row.created_at || new Date()),
            status: formData.status || "Paid & Pending Print",
            orNumber: row.or_number || formData.orNumber || "OR-ONLINE",
            ctcNumber: ctcVal,
            ctc: ctcVal,
            amountPaid: formData.amountPaid || "₱150.00",
            remarks: formData.remarks || "Fetched from database",
            documentType: formData.documentType || "Official Clearance Document",
            photoSrc: formData.photoSrc || "",
          };

          setDocuments((prev) => [fetchedDoc, ...prev.filter((d) => d.id !== fetchedDoc.id)]);
          return fetchedDoc;
        }
      }
    } catch (err) {}

    return null;
  }, [lookupDocument]);

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

  const submitUserDocument = async (docData) => {
    const constructedName = docData.lastName
      ? `${docData.lastName.trim().toUpperCase()}, ${docData.firstName.trim().toUpperCase()}${docData.middleName ? " " + docData.middleName.trim().toUpperCase() : ""}`
      : docData.fullName || "DELA CRUZ, JUAN PEDRO";

    let assignedCertNo = docData.certNo || String(nextCertNo);
    let assignedId = docData.id || `DOC-${assignedCertNo}`;

    // Guarantee uniqueness against existing loaded documents
    let attempts = 0;
    while (documents.some((d) => d.id === assignedId || d.certNo === assignedCertNo) && attempts < 100) {
      const num = parseInt(assignedCertNo, 10);
      const nextVal = !isNaN(num) ? num + 1 : Math.floor(1000 + Math.random() * 9000);
      assignedCertNo = String(nextVal);
      assignedId = `DOC-${assignedCertNo}`;
      attempts++;
    }

    const idempotencyKey = docData.idempotencyKey || `${userPayment?.paymentNo || docData.paymentNo || 'PAY'}_${constructedName.replace(/\W/g, '')}`;

    let newDoc = {
      id: assignedId,
      certNo: assignedCertNo,
      createdAtTimestamp: docData.createdAtTimestamp || Date.now(),
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
      idempotencyKey: idempotencyKey,
    };

    setUserDocument(newDoc);
    setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
    incrementCertNo();

    let dbError = null;

    // Asynchronously insert to Supabase database with atomic sequence & idempotency protection
    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        let { data, error } = await supabase
          .from("documents")
          .insert({
            title: newDoc.fullName,
            full_name: newDoc.fullName,
            purpose: newDoc.purpose,
            cert_no: newDoc.id,
            or_number: newDoc.orNumber,
            ctc_number: newDoc.ctcNumber || newDoc.ctc || "",
            idempotency_key: idempotencyKey,
            form_data: newDoc,
          })
          .select();

        // If idempotency collision (duplicate click), return existing saved document
        if (error && (error.message?.includes("idempotency_key") || error.details?.includes("idempotency_key"))) {
          const { data: existingDocs } = await supabase
            .from("documents")
            .select("*")
            .eq("idempotency_key", idempotencyKey)
            .limit(1);

          if (existingDocs && existingDocs.length > 0) {
            const row = existingDocs[0];
            const existingDoc = {
              ...newDoc,
              id: row.cert_no || row.id,
              certNo: String(row.cert_no || row.id).replace(/^DOC-/, ""),
              orNumber: row.or_number || newDoc.orNumber,
            };
            setUserDocument(existingDoc);
            setDocuments((prev) => [existingDoc, ...prev.filter((d) => d.id !== existingDoc.id)]);
            return { ...existingDoc, dbError: null };
          }
        }

        // If cert_no collision, retry letting database trigger assign cert_number_seq
        if (error && (error.code === "23505" || error.message?.includes("unique constraint"))) {
          const fallbackCertNo = `DOC-${Date.now().toString().slice(-6)}`;
          newDoc.id = fallbackCertNo;
          newDoc.certNo = fallbackCertNo.replace(/^DOC-/, "");
          newDoc.form_data = newDoc;

          const retry = await supabase
            .from("documents")
            .insert({
              title: newDoc.fullName,
              full_name: newDoc.fullName,
              purpose: newDoc.purpose,
              cert_no: fallbackCertNo,
              or_number: newDoc.orNumber,
              idempotency_key: idempotencyKey + "_retry",
              form_data: newDoc,
            })
            .select();

          data = retry.data;
          error = retry.error;
        }

        if (error) {
          console.warn("Supabase document insert warning:", error.message || error);
          dbError = error.message;
        } else if (data && data.length > 0) {
          const canonicalCertNo = data[0].cert_no || data[0].id;
          if (canonicalCertNo && canonicalCertNo !== newDoc.id) {
            newDoc.id = canonicalCertNo;
            newDoc.certNo = String(canonicalCertNo).replace(/^DOC-/, "");
            newDoc.form_data = newDoc;

            setUserDocument(newDoc);
            setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);

            // Update form_data in DB to reflect canonical cert_no
            await supabase
              .from("documents")
              .update({ form_data: newDoc })
              .eq("id", data[0].id);
          }
          console.log("Supabase document inserted successfully:", canonicalCertNo);
        }
      }
    } catch (err) {
      console.warn("Supabase insert error:", err);
      dbError = err?.message || String(err);
    }

    return { ...newDoc, dbError };
  };

  const createStaffDocument = async (docData) => {
    let assignedCertNo = docData.certNo || String(nextCertNo);
    let assignedId = docData.id || `DOC-${assignedCertNo}`;

    let attempts = 0;
    while (documents.some((d) => d.id === assignedId || d.certNo === assignedCertNo) && attempts < 100) {
      const num = parseInt(assignedCertNo, 10);
      const nextVal = !isNaN(num) ? num + 1 : Math.floor(1000 + Math.random() * 9000);
      assignedCertNo = String(nextVal);
      assignedId = `DOC-${assignedCertNo}`;
      attempts++;
    }

    const idempotencyKey = docData.idempotencyKey || `STAFF_${docData.fullName?.replace(/\W/g, '')}_${Date.now()}`;

    let newDoc = {
      id: assignedId,
      certNo: assignedCertNo,
      createdAtTimestamp: docData.createdAtTimestamp || Date.now(),
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
      idempotencyKey: idempotencyKey,
    };

    setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
    incrementCertNo();

    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        let { data, error } = await supabase
          .from("documents")
          .insert({
            title: newDoc.fullName,
            full_name: newDoc.fullName,
            purpose: newDoc.purpose,
            cert_no: newDoc.id,
            or_number: newDoc.orNumber,
            ctc_number: newDoc.ctcNumber || newDoc.ctc || "",
            idempotency_key: idempotencyKey,
            form_data: newDoc,
          })
          .select();

        // Handle duplicate submission key
        if (error && (error.message?.includes("idempotency_key") || error.details?.includes("idempotency_key"))) {
          const { data: existingDocs } = await supabase
            .from("documents")
            .select("*")
            .eq("idempotency_key", idempotencyKey)
            .limit(1);

          if (existingDocs && existingDocs.length > 0) {
            const row = existingDocs[0];
            const existingDoc = {
              ...newDoc,
              id: row.cert_no || row.id,
              certNo: String(row.cert_no || row.id).replace(/^DOC-/, ""),
              orNumber: row.or_number || newDoc.orNumber,
            };
            setDocuments((prev) => [existingDoc, ...prev.filter((d) => d.id !== existingDoc.id)]);
            return existingDoc;
          }
        }

        if (error && (error.code === "23505" || error.message?.includes("unique constraint"))) {
          const fallbackCertNo = `DOC-${Date.now().toString().slice(-6)}`;
          newDoc.id = fallbackCertNo;
          newDoc.certNo = fallbackCertNo.replace(/^DOC-/, "");
          newDoc.form_data = newDoc;

          const retry = await supabase
            .from("documents")
            .insert({
              title: newDoc.fullName,
              full_name: newDoc.fullName,
              purpose: newDoc.purpose,
              cert_no: fallbackCertNo,
              or_number: newDoc.orNumber,
              idempotency_key: idempotencyKey + "_retry",
              form_data: newDoc,
            })
            .select();

          data = retry.data;
        }

        if (data && data.length > 0) {
          const canonicalCertNo = data[0].cert_no || data[0].id;
          if (canonicalCertNo && canonicalCertNo !== newDoc.id) {
            newDoc.id = canonicalCertNo;
            newDoc.certNo = String(canonicalCertNo).replace(/^DOC-/, "");
            newDoc.form_data = newDoc;

            setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);

            await supabase
              .from("documents")
              .update({ form_data: newDoc })
              .eq("id", data[0].id);
          }
        }
      }
    } catch (err) {}

    return newDoc;
  };

  const updateDocument = async (docId, updatedFields) => {
    let targetUpdatedDoc = null;
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === docId || doc.certNo === docId) {
          const updated = {
            ...doc,
            ...updatedFields,
            photoSrc: updatedFields.photoSrc !== undefined ? updatedFields.photoSrc : (doc.photoSrc || ""),
            status: updatedFields.status || "Printed & Released"
          };
          targetUpdatedDoc = updated;
          if (userDocument && (userDocument.id === docId || userDocument.certNo === docId)) {
            setUserDocument(updated);
          }
          return updated;
        }
        return doc;
      })
    );

    if (!targetUpdatedDoc) return;

    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        const cleanId = String(docId).replace(/^DOC-/, "");
        await supabase
          .from("documents")
          .update({
            full_name: targetUpdatedDoc.fullName,
            purpose: targetUpdatedDoc.purpose,
            or_number: targetUpdatedDoc.orNumber,
            ctc_number: targetUpdatedDoc.ctcNumber || targetUpdatedDoc.ctc || "",
            form_data: targetUpdatedDoc
          })
          .or(`cert_no.eq.${docId},cert_no.eq.DOC-${cleanId},cert_no.eq.${cleanId}`);
      }
    } catch (err) {
      console.warn("Supabase updateDocument error:", err);
    }
  };

  const markAsPrinted = async (docId) => {
    let targetUpdatedDoc = null;
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === docId || doc.certNo === docId) {
          const updated = { ...doc, status: "Printed & Released" };
          targetUpdatedDoc = updated;
          return updated;
        }
        return doc;
      })
    );

    if (userDocument && (userDocument.id === docId || userDocument.certNo === docId)) {
      setUserDocument((prev) => (prev ? { ...prev, status: "Printed & Released" } : prev));
    }

    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        const cleanId = String(docId).replace(/^DOC-/, "");
        const existingDoc = documents.find((d) => d.id === docId || d.certNo === docId) || targetUpdatedDoc;
        const mergedDoc = existingDoc
          ? { ...existingDoc, status: "Printed & Released" }
          : { status: "Printed & Released" };

        await supabase
          .from("documents")
          .update({
            form_data: mergedDoc
          })
          .or(`cert_no.eq.${docId},cert_no.eq.DOC-${cleanId},cert_no.eq.${cleanId}`);
      }
    } catch (err) {
      console.warn("Supabase markAsPrinted error:", err);
    }
  };

  const deleteDocument = async (docId) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== docId && doc.certNo !== docId));
    if (userDocument && (userDocument.id === docId || userDocument.certNo === docId)) {
      setUserDocument(null);
    }

    // Asynchronously delete from Supabase if connected
    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        // Try deleting by cert_no OR by id
        await supabase
          .from("documents")
          .delete()
          .or(`cert_no.eq.${docId},id.eq.${docId}`);
      }
    } catch (err) {}
  };

  const clearAllDocuments = async () => {
    setDocuments([]);
    setUserDocument(null);
    setUserPayment(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("clearance_app_documents");
      window.localStorage.removeItem("clearance_app_user_document");
      window.localStorage.removeItem("clearance_app_user_payment");
    }
    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        await supabase.from("documents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }
    } catch (err) {}
  };

  const resetAllStore = () => {
    setUserPayment(null);
    setUserDocument(null);
    setDocuments([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("clearance_app_user_payment");
      window.localStorage.removeItem("clearance_app_user_document");
      window.localStorage.removeItem("clearance_app_documents");
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
        clearAllDocuments,
        lookupDocument,
        lookupDocumentAsync,
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

