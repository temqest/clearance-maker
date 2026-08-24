"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "lib/supabase/client";
import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;

    const checkSession = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (user) {
        router.replace("/home");
      }
    };

    checkSession();
  }, [router, supabase]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!supabase) {
      setError("Supabase is not configured. Add your environment variables.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    setIsSubmitting(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.replace("/home");
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FAF9F6", display: "flex", flexDirection: "column" }}>
      {/* Site Header Bar */}
      <header style={{
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #E4E4E7",
        position: "sticky",
        top: 0,
        zIndex: 50,
        width: "100%"
      }}>
        <div style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "12px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <Link href="/" style={{ textDecoration: "none", display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "1.15rem", fontWeight: "800", color: "#09090B", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
              RTC Clearance Express
            </span>
            <span style={{ fontSize: "0.75rem", color: "#71717A", fontWeight: "500", marginTop: "1px" }}>
              Official Municipal & Court Portal
            </span>
          </Link>

          <Link href="/" style={{
            padding: "8px 18px",
            borderRadius: "9999px",
            backgroundColor: "#FFFFFF",
            border: "1px solid #E4E4E7",
            color: "#09090B",
            fontWeight: 700,
            fontSize: "0.85rem",
            textDecoration: "none"
          }}>
            ← Back to Portal
          </Link>
        </div>
      </header>

      <main className={styles.page}>
        <section className={styles.shell}>
          <header className={styles.header}>
            <p>STAFF & COUNTER AUTHORIZATION</p>
            <h1>Court Personnel Access Terminal</h1>
          </header>

          <div className={styles.content}>
            <aside className={styles.infoPanel}>
              <h2>Authorized Personnel Only</h2>
              <p>
                This terminal is reserved for authorized station clerks, counter operators, and court officers issuing official 8.5x13 clearance certificates.
              </p>
              <dl className={styles.metaList}>
                <div>
                  <dt>System Name</dt>
                  <dd>RTC Clearance Records Platform</dd>
                </div>
                <div>
                  <dt>Security Protocol</dt>
                  <dd>256-Bit TLS Encrypted Session</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>Hall of Justice Counter Terminal</dd>
                </div>
              </dl>
            </aside>

            <section className={styles.formPanel} aria-labelledby="signin-heading">
              <h2 id="signin-heading">Court Staff Sign In</h2>
              <p className={styles.subtitle}>Enter your assigned credentials to log in.</p>

              <form className={styles.form} onSubmit={handleSubmit}>
                <label htmlFor="email" className={styles.label}>
                  Staff Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={styles.input}
                  placeholder="name@rtc.gov.ph"
                  autoComplete="email"
                  required
                />

                <label htmlFor="password" className={styles.label}>
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={styles.input}
                  placeholder="Enter staff password"
                  autoComplete="current-password"
                  required
                />

                {error && (
                  <p role="alert" className={styles.errorMessage}>
                    {error}
                  </p>
                )}

                <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
                  {isSubmitting ? "Signing In..." : "Log In to Counter Desk →"}
                </button>
              </form>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
