"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { showToast } from "@/components/feedback";

export function SettingsMessageHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const message = searchParams.get("message");

    if (message === "email-changed") {
      showToast.success("Email address updated successfully");
      // Remove the message from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("message");
      router.replace(url.pathname, { scroll: false });
    }
  }, [searchParams, router]);

  return null;
}
