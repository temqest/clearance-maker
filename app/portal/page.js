"use client";

import React from "react";
import { MockProvider } from "../../lib/mockStore";
import ClearancePortalApp from "../../components/ClearancePortalApp";

export default function PortalPage() {
  return (
    <MockProvider>
      <ClearancePortalApp />
    </MockProvider>
  );
}
