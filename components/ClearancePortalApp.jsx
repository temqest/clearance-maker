"use client";

import React from "react";
import RoleSelector from "./RoleSelector";
import UserPortal from "./user/UserPortal";

export default function ClearancePortalApp() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FAF9F6" }}>
      <RoleSelector />
      <main>
        <UserPortal />
      </main>
    </div>
  );
}
