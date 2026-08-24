"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MockProvider } from "../../lib/mockStore";
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
      {/* TOP HEADER BAR - Original Site Palette (Cream/White/Black/Gold) */}
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
          padding: "12px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px"
        }}>
          {/* Brand & Workspace Title */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Link href="/home" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "1.2rem", fontWeight: "800", color: "#09090B", letterSpacing: "-0.02em" }}>
                RTC Clearance Express
              </span>
            </Link>
            <span style={{ color: "#D4D4D8", fontSize: "1.1rem", fontWeight: "300" }}>/</span>
            <span style={{
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
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* User Profile Info Card */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}>
              <div style={{
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                backgroundColor: "#FEF3C7",
                color: "#D97706",
                border: "1px solid #FDE68A",
                fontWeight: 800,
                fontSize: "0.9rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                I
              </div>
              <div style={{ display: "flex", flexDirection: "column", textAlign: "left", lineHeight: "1.2" }}>
                <span style={{ fontSize: "0.825rem", fontWeight: "700", color: "#09090B" }}>Iriga Staff</span>
                <span style={{ fontSize: "0.725rem", color: "#71717A" }}>staff@rtc.gov.ph</span>
              </div>
            </div>
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
  return (
    <MockProvider>
      <StaffDashboardContent />
    </MockProvider>
  );
}
