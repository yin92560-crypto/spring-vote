"use client";

import { useSyncExternalStore } from "react";
import {
  clearAdminSession,
  isAdminSessionValid,
  subscribeAdminAuth,
} from "@/lib/admin-auth";
import { AdminLogin } from "@/components/admin-login";
import { AdminPageClient } from "@/components/admin-page-client";

export function AdminGuard() {
  const loggedIn = useSyncExternalStore(
    subscribeAdminAuth,
    () => isAdminSessionValid(),
    () => false
  );

  const handleLogout = () => {
    clearAdminSession();
  };

  if (!loggedIn) {
    return <AdminLogin />;
  }

  return <AdminPageClient onLogout={handleLogout} />;
}
