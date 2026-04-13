"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <h1>Clearance Document Management System</h1>
        </header>

        <div className={styles.content}>
          <aside className={styles.infoPanel}>
            <h2>Authorized Access Only</h2>
            <p>
              This portal is intended for authorized court personnel and designated institutional users. All
              access attempts and document actions are monitored and recorded.
            </p>
            <dl className={styles.metaList}>
              <div>
                <dt>System</dt>
                <dd>RTC Clearance Records</dd>
              </div>
              <div>
                <dt>Environment</dt>
                <dd>Production Workspace</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>April 13, 2026</dd>
              </div>
            </dl>
          </aside>

          <section className={styles.formPanel} aria-labelledby="signin-heading">
            <h2 id="signin-heading">Sign In</h2>
            <p className={styles.subtitle}>Enter your issued credentials to continue.</p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <label htmlFor="email" className={styles.label}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={styles.input}
                placeholder="Enter email"
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
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />

              {error && (
                <p role="alert" className={styles.errorMessage}>
                  {error}
                </p>
              )}

              <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
                {isSubmitting ? "Signing In..." : "Log In"}
              </button>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
