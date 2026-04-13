import Link from "next/link";
import styles from "./HeaderBar.module.css";

export default function HeaderBar({ onPrint, onSave, isSaving }) {
  const handlePrint = () => {
    if (typeof onPrint === "function") {
      onPrint();
      return;
    }
    window.print();
  };

  return (
    <header className={`${styles.header} noPrint`}>
      <div className={styles.titleGroup}>
        <Link href="/home" className={styles.homeButton} aria-label="Back to home">
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M10 2.5a.75.75 0 0 1 .53.22l6.5 6.5a.75.75 0 1 1-1.06 1.06L15 9.31V16a1 1 0 0 1-1 1h-2.5a.75.75 0 0 1-.75-.75V12h-1.5v4.25a.75.75 0 0 1-.75.75H6a1 1 0 0 1-1-1V9.31l-.97.97a.75.75 0 0 1-1.06-1.06l6.5-6.5A.75.75 0 0 1 10 2.5Z" />
          </svg>
        </Link>
        <Link href="/home" className={styles.titleLink}>
          RTC CLEARANCE EDITOR
        </Link>
      </div>
      <span>Live Document Preview</span>
      <div className={styles.actionGroup}>
        {typeof onSave === "function" && (
          <button type="button" className={styles.docxButton} onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Document"}
          </button>
        )}
        <button type="button" className={styles.printButton} onClick={handlePrint}>
          Print / Save PDF
        </button>
      </div>
    </header>
  );
}
