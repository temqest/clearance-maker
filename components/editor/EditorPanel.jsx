import { useRef } from "react";
import { formSections } from "lib/formSections";
import { fileToWordSafeDataUrl } from "lib/imageDataUrl";
import PhotoUpload from "./PhotoUpload";
import styles from "./EditorPanel.module.css";

export default function EditorPanel({
  formData,
  onFieldChange,
  photoSrc,
  onPhotoChange,
  onPhotoRemove,
  signatureSrc,
  onSignatureChange,
  onSignatureRemove
}) {
  const signatureInputRef = useRef(null);

  const handleSignatureLoad = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const safeDataUrl = await fileToWordSafeDataUrl(file, {
      outputType: "image/png",
      maxWidth: 900,
      maxHeight: 400
    });
    onSignatureChange(safeDataUrl);
  };

  const handleSignatureRemoveClick = () => {
    onSignatureRemove();
    if (signatureInputRef.current) {
      signatureInputRef.current.value = "";
    }
  };

  return (
    <aside className={`${styles.panel} noPrint`}>
      {formSections.map((section) => (
        <section key={section.title} className={styles.sectionBlock}>
          <div className={styles.sectionTitle}>{section.title}</div>
          {section.fields.map((field) => {
            const value = formData[field.id] ?? "";

            return (
              <div key={field.id} className={styles.fieldGroup}>
                <label htmlFor={field.id}>{field.label}</label>
                {field.type === "textarea" ? (
                  <textarea
                    id={field.id}
                    value={value}
                    onChange={(e) => onFieldChange(field.id, e.target.value)}
                  />
                ) : field.type === "select" ? (
                  <select
                    id={field.id}
                    value={value}
                    onChange={(e) => onFieldChange(field.id, e.target.value)}
                  >
                    <option value="">Select an option</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={field.id}
                    type="text"
                    value={value}
                    onChange={(e) => onFieldChange(field.id, e.target.value)}
                  />
                )}
              </div>
            );
          })}

          {section.title === "Signatory" && (
            <>
              <label htmlFor="signatureInput">Digital Signature (PNG recommended)</label>
              <input
                id="signatureInput"
                type="file"
                accept="image/*"
                onChange={handleSignatureLoad}
                className={styles.fileUploadInput}
                ref={signatureInputRef}
              />
              {signatureSrc && (
                <div className={styles.actionRow}>
                  <div className={styles.uploadedTag}>Signature added to clerk area.</div>
                  <button
                    type="button"
                    onClick={handleSignatureRemoveClick}
                    className={styles.removeButton}
                  >
                    Remove signature
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      ))}

      <div className={styles.sectionTitle}>Applicant Photo</div>
      <PhotoUpload photoSrc={photoSrc} onPhotoChange={onPhotoChange} onPhotoRemove={onPhotoRemove} />
    </aside>
  );
}
