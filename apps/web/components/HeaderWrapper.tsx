"use client";

import Header from "./header";

export default function HeaderWrapper() {
  const user = {
    firstName: "Andy",
    lastName: "Büch",
  };

  return <Header user={user} />;
}
