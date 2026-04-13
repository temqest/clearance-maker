"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "lib/supabase/client";
import styles from "./page.module.css";

export default function HomeDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [query, setQuery] = useState("");
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  const fetchDocuments = async () => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("documents")
      .select("id, full_name, purpose, cert_no, form_data, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      setLoadingError(error.message);
      return;
    }

    setLoadingError("");
    setDocuments(data ?? []);
  };

  useEffect(() => {
    if (!supabase) return;

    const bootstrap = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setCurrentUserId(user.id);
      await fetchDocuments();
      setLoading(false);
    };

    bootstrap();
  }, [router, supabase]);

  useEffect(() => {
    if (!currentUserId) return;

    const timeoutId = window.setTimeout(() => {
      fetchDocuments();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [query, currentUserId]);

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const handleOpenDocument = (id) => {
    router.push(`/editor?id=${id}`);
  };

  const extractDocumentValues = (document) => {
    const formData = document.form_data || {};
    const certNo = document.cert_no || formData.certNo || "-";
    const fullName = document.full_name || formData.fullName || "-";
    const purpose = document.purpose || formData.purpose || "-";

    return { certNo, fullName, purpose };
  };

  const filteredDocuments = useMemo(() => {
    const mapped = documents.map((document) => {
      const values = extractDocumentValues(document);

      return {
        id: document.id,
        certNo: values.certNo,
        fullName: values.fullName,
        purpose: values.purpose,
        updatedAt: document.updated_at
          ? new Date(document.updated_at).toLocaleString()
          : "No update timestamp"
      };
    });

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return mapped;

    return mapped.filter((document) => {
      return (
        document.certNo.toLowerCase().includes(normalizedQuery) ||
        document.fullName.toLowerCase().includes(normalizedQuery) ||
        document.purpose.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [documents, query]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Clearance Document Registry</h1>
        </div>
        <div className={styles.headerActions}>
          <p className={styles.headerMeta}>Official Records Workspace</p>
          <button type="button" className={styles.logoutButton} onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </header>

      <section className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <label htmlFor="search" className={styles.searchLabel}>
            Search Existing Files
          </label>
          <input
            id="search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={styles.searchInput}
            placeholder="Search by document ID, full name, or purpose"
          />
        </div>

        <div className={styles.toolbarActions}>
          <button type="button" className={styles.createButton} onClick={() => router.push("/editor")}>
            <svg className={styles.buttonIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M10 4.25a.75.75 0 0 1 .75.75v4.25H15a.75.75 0 0 1 0 1.5h-4.25V15a.75.75 0 0 1-1.5 0v-4.25H5a.75.75 0 0 1 0-1.5h4.25V5a.75.75 0 0 1 .75-.75Z" />
            </svg>
            Create Document
          </button>
        </div>
      </section>

      <section className={styles.library}>
        <div className={styles.tableHead}>
          <span>Document ID</span>
          <span>Full Name</span>
          <span>Purpose</span>
          <span>Last Updated</span>
        </div>

        <ul className={styles.list}>
          {loading ? (
            <li className={styles.empty}>Loading files...</li>
          ) : loadingError ? (
            <li className={styles.empty}>Failed to load files: {loadingError}</li>
          ) : filteredDocuments.length ? (
            filteredDocuments.map((document) => (
              <li key={document.id} className={styles.row}>
                <button
                  type="button"
                  className={styles.rowButton}
                  onClick={() => handleOpenDocument(document.id)}
                >
                  <span className={styles.cell}>{document.certNo}</span>
                  <span className={styles.cell}>{document.fullName}</span>
                  <span className={styles.cell}>{document.purpose}</span>
                  <span className={`${styles.cell} ${styles.dateCell}`}>{document.updatedAt}</span>
                </button>
              </li>
            ))
          ) : (
            <li className={styles.empty}>No files exist in the table.</li>
          )}
        </ul>
      </section>
    </main>
  );
}
