import { useRef } from "react";
import { fileToWordSafeDataUrl } from "lib/imageDataUrl";
import styles from "./PhotoUpload.module.css";

export default function PhotoUpload({ photoSrc, onPhotoChange, onPhotoRemove }) {
  const photoInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handlePhotoLoad = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const safeDataUrl = await fileToWordSafeDataUrl(file, {
      outputType: "image/jpeg",
      quality: 0.9,
      maxWidth: 1200,
      maxHeight: 1200
    });
    onPhotoChange(safeDataUrl);
  };

  const handlePhotoRemove = () => {
    onPhotoRemove();
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  };

  const openFilePicker = () => {
    photoInputRef.current?.click();
  };

  const openCameraPicker = () => {
    cameraInputRef.current?.click();
  };

  return (
    <>
      <div className={styles.photoUploadArea}>
        {photoSrc ? (
          <img src={photoSrc} alt="Applicant preview" className={styles.photoThumb} />
        ) : (
          <div className={styles.placeholder}>
            <div className={styles.camera}>PHOTO</div>
            <p>Select source (1x1 or 2x2)</p>
          </div>
        )}

        <div className={styles.actionButtons}>
          <button type="button" className={styles.actionButton} onClick={openFilePicker}>
            Upload Photo
          </button>
          <button type="button" className={styles.actionButton} onClick={openCameraPicker}>
            Take Photo
          </button>
        </div>
      </div>
      <input
        id="photoInput"
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={handlePhotoLoad}
        ref={photoInputRef}
      />
      <input
        id="cameraInput"
        type="file"
        accept="image/*"
        capture="environment"
        className={styles.hiddenInput}
        onChange={handlePhotoLoad}
        ref={cameraInputRef}
      />
      {photoSrc && (
        <button type="button" onClick={handlePhotoRemove} className={styles.removePhotoButton}>
          Remove photo
        </button>
      )}
    </>
  );
}
