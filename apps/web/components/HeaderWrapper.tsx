"use client";

import { useState } from "react";
import Header from "./header";

export default function HeaderWrapper() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const user = {
    firstName: "Andy",
    lastName: "Büch",
  };

  return (
    <Header
      user={user}
      toggleSidebar={() => setSidebarOpen((prev) => !prev)}
      sidebarOpen={sidebarOpen}
    />
  );
}
