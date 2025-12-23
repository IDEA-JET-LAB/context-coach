"use client";

import { useEffect } from "react";
import { showToast } from "@/components/feedback";

export function AuthErrorToast({ error }: { error?: string }) {
  useEffect(() => {
    if (error) {
      showToast.error(error);
    }
  }, [error]);

  return null;
}
