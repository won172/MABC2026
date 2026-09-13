'use client';

import { useEffect } from "react";

export default function RootPage() {
  useEffect(() => {
    window.location.href = "/onboarding";
  }, []);
  return null;
}
