"use client";

import { useState, useCallback, useEffect } from "react";
import PortalLayout from "@/components/PortalLayout";

export default function SettingsPage() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleChangePassword = useCallback(async () => {
    if (!oldPassword || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      setToast({ type: "error", message: "New passwords do not match." });
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to change password");
      }
      setToast({ type: "success", message: data.message });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setToast({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to change password.",
      });
    } finally {
      setSaving(false);
    }
  }, [oldPassword, newPassword, confirmPassword]);

  /* Auto-dismiss toast */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <PortalLayout>
      {/* Title */}
      <h1 className="text-3xl font-bold font-serif text-text mb-8">Settings</h1>

      <div className="bg-card rounded-xl border border-border p-6 space-y-8">
        {/* ---------------------------------------------------------- */}
        {/*  Studio Info (read-only)                                    */}
        {/* ---------------------------------------------------------- */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold font-serif text-text">
            Studio Info
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Studio Name
              </p>
              <p className="text-sm text-text mt-1">iSlay Studios</p>
            </div>

            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Active Promo Code
              </p>
              <p className="text-sm text-text mt-1">SLAY10</p>
            </div>

            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Twilio Phone Number
              </p>
              <p className="text-sm text-success mt-1">Configured &#10003;</p>
            </div>
          </div>
        </section>

        <hr className="border-border" />

        {/* ---------------------------------------------------------- */}
        {/*  Change Password                                            */}
        {/* ---------------------------------------------------------- */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold font-serif text-text">
            Change Password
          </h2>

          {/* Toast */}
          {toast && (
            <div
              className={`px-4 py-3 rounded-lg text-sm font-medium ${
                toast.type === "success"
                  ? "bg-success/20 text-success"
                  : "bg-error/20 text-error"
              }`}
            >
              {toast.message}
            </div>
          )}

          <div className="space-y-4 max-w-md">
            <label className="block">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Old Password
              </span>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                New Password
              </span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Confirm New Password
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </label>

            <button
              onClick={handleChangePassword}
              disabled={saving || !oldPassword || !newPassword || !confirmPassword}
              className="px-6 py-2.5 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving\u2026" : "Save"}
            </button>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/*  Footer                                                     */}
        {/* ---------------------------------------------------------- */}
        <div className="pt-4 border-t border-border text-center">
          <p className="text-sm text-gold">Powered by GoElev8.ai</p>
        </div>
      </div>
    </PortalLayout>
  );
}
