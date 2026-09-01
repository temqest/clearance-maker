"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StaffPortal from "../../components/staff/StaffPortal";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

function StaffDashboardContent() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [headerSearch, setHeaderSearch] = useState("");

  const handleLogout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {}
    }
    router.replace("/login");
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FAF9F6" }}>
      {/* TOP HEADER BAR - Ultra-Compact 52px Header */}
      <header className="site-header" style={{
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
          padding: "8px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          width: "100%",
          height: "52px",
          boxSizing: "border-box"
        }}>
          {/* Brand & Workspace Title */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Link href="/home" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="staff-desktop-only" style={{ fontSize: "1.1rem", fontWeight: "800", color: "#09090B", letterSpacing: "-0.02em" }}>
                RTC Clearance Express
              </span>
              <span className="staff-mobile-only" style={{ fontSize: "1rem", fontWeight: "800", color: "#09090B", letterSpacing: "-0.02em" }}>
                RTC Express
              </span>
            </Link>
            <span className="staff-desktop-only" style={{ color: "#D4D4D8", fontSize: "1.1rem", fontWeight: "300" }}>/</span>
            <span className="staff-desktop-only" style={{
              fontSize: "0.75rem",
              fontWeight: "600",
              color: "#71717A",
              textTransform: "uppercase",
              letterSpacing: "0.08em"
            }}>
              Official Staff Workspace
            </span>
          </div>

          {/* Topbar Right Tools & User Profile */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: "#FEF3C7",
                color: "#D97706",
                border: "1px solid #FDE68A",
                fontWeight: 800,
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}>
                I
              </div>
              <div style={{ display: "flex", flexDirection: "column", textAlign: "left", lineHeight: "1.1" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "#09090B" }}>Iriga Staff</span>
                <span className="staff-desktop-only" style={{ fontSize: "0.7rem", color: "#71717A" }}>staff@rtc.gov.ph</span>
              </div>
            </div>

            <button
              type="button"
              title="Log out of Staff Terminal"
              onClick={handleLogout}
              style={{
                background: "none",
                border: "none",
                padding: "6px",
                borderRadius: "8px",
                cursor: "pointer",
                color: "#71717A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "36px",
                minHeight: "36px"
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Staff Portal Workspace */}
      <main>
        <StaffPortal headerSearchQuery={headerSearch} onLogout={handleLogout} />
      </main>
    </div>
  );
}

export default function HomeDashboardPage() {
  return <StaffDashboardContent />;
}
