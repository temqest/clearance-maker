import { formatMonth, splitDayOrdinal } from "lib/formatters";
import styles from "./PreviewPanel.module.css";

export default function PreviewPanel({ formData, photoSrc, signatureSrc }) {
  const day = splitDayOrdinal(formData.givenDay);
  const sealSrc = "/assets/supreme-court-seal.png";

  return (
    <section className={styles.previewPanel}>
      <div className={styles.doc}>
        <img src={sealSrc} alt="Judiciary watermark" className={styles.watermarkSeal} />

        <div className={styles.docHeader}>
          <img src={sealSrc} alt="Supreme Court seal" className={styles.docSeal} />
          <div className={styles.docTitleBlock}>
            <div className={styles.republic}>Republic of the Philippines</div>
            <div className={styles.courtName}>{formData.courtName}</div>
            <div className={styles.sub}>{formData.judicialRegion}</div>
            <div className={styles.sub}>{formData.courtCity}</div>
            <div className={styles.email}>{formData.courtEmail}</div>
            <div className={styles.email}>Tel.no. {formData.courtTel}</div>
          </div>
          <img src={sealSrc} alt="Regional Trial Court seal" className={styles.docSeal} />
        </div>

        <div className={styles.docSectionTitle}>OFFICE OF THE CLERK OF COURT</div>
        <div className={styles.docMainTitle}>C L E A R A N C E</div>

        <div className={styles.docBody}>
          <p className={styles.concernLine}>TO WHOM IT MAY CONCERN:</p>
          <br />
          <p className={styles.mainParagraph}>
            In connection with the application for a Regional Trial Court Clearance of:
            <span className={styles.field}> {formData.fullName}</span>, {formData.nationality},
            <span className={styles.field}> {formData.civilStatus}</span>, born on
            <span className={styles.field}> {formData.dob}</span> and presently residing at
            <span className={styles.field}> {formData.address}</span> whose signature, right thumb mark,
            recent picture and Community Certificate Number are shown below, this office certifies to the
            following:
          </p>

          <div className={styles.findingLine}>
            FINDING: <strong>{formData.finding}</strong>
          </div>
          <div className={styles.purposeLine}>
            PURPOSE: <strong>{formData.purpose}</strong>
          </div>

          <div className={styles.casesBlock}>
            Criminal Cases: ___________<br />
            Civil Cases: ___________
          </div>

          <div className={styles.issuedLine}>
            Issued on the basis of the records/dockets obtained in this office since September 16, 1971 up
            to the present.
          </div>

          <div className={styles.givenLine}>
            Given this
            <span className={styles.dayField}>
              {day.num}
              {day.suffix && <sup>{day.suffix}</sup>}
            </span>
            day of <span className={styles.monthField}>{formatMonth(formData.givenMonth)}</span>
            <span className={styles.yearField}>{formData.givenYear}</span> at {formData.givenPlace}.
          </div>

          <div className={styles.sigBlock}>
            <div className={styles.signatureLayer}>
              {signatureSrc && (
                <img src={signatureSrc} alt="Digital signature" className={styles.digitalSignature} />
              )}
            </div>
            <div className={styles.sigName}>{formData.clerkName}</div>
            <div className={styles.sigRole}>{formData.clerkTitle1}</div>
            <div className={styles.sigRole}>{formData.clerkTitle2}</div>
          </div>

          <div className={styles.stampBox}>
            <div className={styles.stampTitle}>"Documentary Stamp Tax Paid"</div>
            <div>
              OR. No. {formData.stampOR} {formData.stampDate}
            </div>
          </div>

          <div className={styles.notValid}>NOT VALID WITHOUT DRY SEAL</div>
        </div>

        <div className={styles.bottomSection}>
          <div>
            <div className={styles.orBlock}>
              <table>
                <tbody>
                  <tr>
                    <td>O.R. No.</td>
                    <td>{formData.orNo}</td>
                  </tr>
                  <tr>
                    <td>Date:</td>
                    <td>{formData.orDate}</td>
                  </tr>
                  <tr>
                    <td>CTC:</td>
                    <td>{formData.ctc}</td>
                  </tr>
                  <tr>
                    <td>Issued at:</td>
                    <td>{formData.issuedAt}</td>
                  </tr>
                  <tr>
                    <td>Issued on:</td>
                    <td>{formData.issuedOn}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className={styles.signatureLineWrap}>
              <div className={styles.sigLineBlock} />
              <div className={styles.sigLineLabel}>Applicant&apos;s Signature</div>
            </div>
          </div>

          <div className={styles.photoBlock}>
            {photoSrc ? (
              <img src={photoSrc} alt="Applicant" className={styles.docPhoto} />
            ) : (
              <div className={styles.noPhoto}>Recent Photo</div>
            )}
          </div>

          <div className={styles.thumbmarkBox}>Right Hand thumb mark</div>
        </div>

        <div className={styles.docNote}>
          Note: <strong>Valid for 6 months from the date of issue.</strong>
        </div>
        <div className={styles.certNo}>
          Clearance/Certification No. <span className={styles.certNoValue}>{formData.certNo}</span>
        </div>
      </div>
    </section>
  );
}
