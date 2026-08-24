"use client";

import React from "react";
import Link from "next/link";

export default function RoleSelector() {
  return (
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
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "12px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px"
      }}>
        {/* Brand Link Block */}
        <Link href="/" style={{ textDecoration: "none", display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "1.15rem", fontWeight: "800", color: "#09090B", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            RTC Clearance Express
          </span>
          <span style={{ fontSize: "0.75rem", color: "#71717A", fontWeight: "500", marginTop: "1px" }}>
            Official Municipal & Court Portal
          </span>
        </Link>

        {/* Staff Login Link for Authorized Personnel */}
        <Link href="/login" style={{
          padding: "8px 18px",
          borderRadius: "9999px",
          backgroundColor: "#09090B",
          color: "#FFFFFF",
          fontWeight: 700,
          fontSize: "0.825rem",
          textDecoration: "none",
          boxShadow: "0 4px 12px rgba(9, 9, 11, 0.15)"
        }}>
          Court Staff Login →
        </Link>
      </div>
    </header>
  );
}
