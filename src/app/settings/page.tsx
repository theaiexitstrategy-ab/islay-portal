"use client";

import { useState, useCallback, useEffect } from "react";
import PortalLayout from "@/components/PortalLayout";
import type { ClientSettings, SocialLink } from "@/types/database";

const PLATFORMS = [
  { id: "instagram", name: "Instagram", color: "text-pink-400", icon: InstagramIcon, urlPrefix: "https://instagram.com/" },
  { id: "facebook", name: "Facebook", color: "text-blue-400", icon: FacebookIcon, urlPrefix: "https://facebook.com/" },
  { id: "tiktok", name: "TikTok", color: "text-cyan-300", icon: TikTokIcon, urlPrefix: "https://tiktok.com/@" },
  { id: "google", name: "Google Business", color: "text-yellow-400", icon: GoogleIcon, urlPrefix: "https://g.co/" },
  { id: "youtube", name: "YouTube", color: "text-red-400", icon: YouTubeIcon, urlPrefix: "https://youtube.com/@" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [editingSocial, setEditingSocial] = useState<string | null>(null);
  const [socialUsername, setSocialUsername] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [savingSocial, setSavingSocial] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  function showToast(message: string, type: "success" | "error") {
    setToast({ type, message });
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [settingsRes, socialRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/social-links"),
        ]);
        const settingsData = await settingsRes.json();
        const socialData = await socialRes.json();
        setSettings(settingsData);
        setSocialLinks(Array.isArray(socialData) ? socialData : []);
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const handleSaveSettings = useCallback(async () => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studio_name: settings.studio_name,
          owner_name: settings.owner_name,
          owner_email: settings.owner_email,
          owner_phone: settings.owner_phone,
          promo_code: settings.promo_code,
          promo_amount: settings.promo_amount,
          timezone: settings.timezone,
          notification_email: settings.notification_email,
          notification_sms: settings.notification_sms,
          low_credit_threshold: settings.low_credit_threshold,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setSettings(data);
      showToast("Settings saved.", "success");
    } catch {
      showToast("Failed to save settings.", "error");
    } finally {
      setSavingSettings(false);
    }
  }, [settings]);

  const handleChangePassword = useCallback(async () => {
    if (!newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      showToast("Passwords do not match.", "error");
      return;
    }
    if (newPassword.length < 6) {
      showToast("Password must be at least 6 characters.", "error");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change password");
      showToast(data.message || "Password updated.", "success");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to change password.", "error");
    } finally {
      setSavingPassword(false);
    }
  }, [newPassword, confirmPassword]);

  async function handleSaveSocial(platform: string) {
    setSavingSocial(true);
    try {
      const platformInfo = PLATFORMS.find((p) => p.id === platform);
      const url = socialUrl || (socialUsername ? platformInfo?.urlPrefix + socialUsername : "");
      const res = await fetch("/api/social-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          username: socialUsername || null,
          profile_url: url || null,
          connected: !!(socialUsername || socialUrl),
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setSocialLinks(Array.isArray(data) ? data : []);
      setEditingSocial(null);
      setSocialUsername("");
      setSocialUrl("");
      showToast(`${platformInfo?.name} linked!`, "success");
    } catch {
      showToast("Failed to save social link.", "error");
    } finally {
      setSavingSocial(false);
    }
  }

  async function handleDisconnect(platform: string) {
    try {
      await fetch(`/api/social-links?platform=${platform}`, { method: "DELETE" });
      setSocialLinks((prev) =>
        prev.map((s) =>
          s.platform === platform
            ? { ...s, connected: false, username: null, profile_url: null }
            : s,
        ),
      );
      const platformInfo = PLATFORMS.find((p) => p.id === platform);
      showToast(`${platformInfo?.name} disconnected.`, "success");
    } catch {
      showToast("Failed to disconnect.", "error");
    }
  }

  function updateSetting(key: keyof ClientSettings, value: unknown) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function getSocialLink(platform: string): SocialLink | undefined {
    return socialLinks.find((s) => s.platform === platform);
  }

  if (loading) {
    return (
      <PortalLayout>
        <h1 className="text-3xl font-bold font-serif text-text mb-8">Settings</h1>
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-6 animate-pulse">
              <div className="h-6 w-40 bg-border rounded mb-4" />
              <div className="space-y-3">
                <div className="h-4 w-64 bg-border rounded" />
                <div className="h-10 w-full bg-border rounded" />
              </div>
            </div>
          ))}
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <h1 className="text-3xl font-bold font-serif text-text mb-8">Settings</h1>

      {/* Toast */}
      {toast && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
            toast.type === "success"
              ? "bg-success/20 text-success"
              : "bg-error/20 text-error"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="space-y-6">
        {/* ---------------------------------------------------------- */}
        {/*  Studio / Portal Settings                                   */}
        {/* ---------------------------------------------------------- */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold font-serif text-text mb-4">
            Studio Settings
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
            <label className="block">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Studio Name
              </span>
              <input
                type="text"
                value={settings?.studio_name || ""}
                onChange={(e) => updateSetting("studio_name", e.target.value)}
                className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Owner Name
              </span>
              <input
                type="text"
                value={settings?.owner_name || ""}
                onChange={(e) => updateSetting("owner_name", e.target.value)}
                className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Email
              </span>
              <input
                type="email"
                value={settings?.owner_email || ""}
                onChange={(e) => updateSetting("owner_email", e.target.value)}
                className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Phone
              </span>
              <input
                type="tel"
                value={settings?.owner_phone || ""}
                onChange={(e) => updateSetting("owner_phone", e.target.value)}
                className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Promo Code
              </span>
              <input
                type="text"
                value={settings?.promo_code || ""}
                onChange={(e) => updateSetting("promo_code", e.target.value)}
                className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Promo Value
              </span>
              <input
                type="text"
                value={settings?.promo_amount || ""}
                onChange={(e) => updateSetting("promo_amount", e.target.value)}
                className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </label>
          </div>

          {/* Notification Preferences */}
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider">
              Notifications
            </h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings?.notification_email ?? true}
                onChange={(e) => updateSetting("notification_email", e.target.checked)}
                className="w-4 h-4 rounded border-border bg-bg text-gold focus:ring-gold"
              />
              <span className="text-sm text-text">Email notifications for new leads</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings?.notification_sms ?? true}
                onChange={(e) => updateSetting("notification_sms", e.target.checked)}
                className="w-4 h-4 rounded border-border bg-bg text-gold focus:ring-gold"
              />
              <span className="text-sm text-text">SMS notifications for low credit balance</span>
            </label>
            <label className="block max-w-xs">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Low Credit Alert Threshold
              </span>
              <select
                value={settings?.low_credit_threshold ?? 20}
                onChange={(e) => updateSetting("low_credit_threshold", Number(e.target.value))}
                className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              >
                <option value={10}>10 credits</option>
                <option value={20}>20 credits</option>
                <option value={50}>50 credits</option>
                <option value={100}>100 credits</option>
              </select>
            </label>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="mt-6 px-6 py-2.5 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold/90 transition-colors disabled:opacity-50"
          >
            {savingSettings ? "Saving..." : "Save Settings"}
          </button>
        </div>

        {/* ---------------------------------------------------------- */}
        {/*  Social Media Accounts                                      */}
        {/* ---------------------------------------------------------- */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold font-serif text-text mb-2">
            Social Media Accounts
          </h2>
          <p className="text-sm text-text-muted mb-6">
            Link your social media accounts to track activity and show profile links.
          </p>

          <div className="space-y-3">
            {PLATFORMS.map(({ id, name, color, icon: Icon, urlPrefix }) => {
              const link = getSocialLink(id);
              const isEditing = editingSocial === id;
              const isConnected = link?.connected && link?.username;

              return (
                <div
                  key={id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border border-border bg-bg/50"
                >
                  <div className="flex items-center gap-3 min-w-[180px]">
                    <Icon className={`w-5 h-5 ${color}`} />
                    <span className="text-sm font-medium text-text">{name}</span>
                    {isConnected && (
                      <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">
                        Connected
                      </span>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="flex-1 flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Username"
                        value={socialUsername}
                        onChange={(e) => setSocialUsername(e.target.value)}
                        className="flex-1 rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                      />
                      <input
                        type="url"
                        placeholder={`${urlPrefix}...`}
                        value={socialUrl}
                        onChange={(e) => setSocialUrl(e.target.value)}
                        className="flex-1 rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveSocial(id)}
                          disabled={savingSocial || (!socialUsername && !socialUrl)}
                          className="px-4 py-2 rounded-lg bg-gold text-black font-medium text-sm disabled:opacity-50"
                        >
                          {savingSocial ? "..." : "Save"}
                        </button>
                        <button
                          onClick={() => { setEditingSocial(null); setSocialUsername(""); setSocialUrl(""); }}
                          className="px-4 py-2 rounded-lg bg-white/5 text-text-muted text-sm hover:bg-white/10"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-between gap-2">
                      {isConnected ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-text-muted">@{link.username}</span>
                          {link.profile_url && (
                            <a
                              href={link.profile_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gold hover:text-gold/80"
                            >
                              View
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-text-muted">Not connected</span>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingSocial(id);
                            setSocialUsername(link?.username || "");
                            setSocialUrl(link?.profile_url || "");
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/5 text-text-muted text-xs hover:bg-white/10"
                        >
                          {isConnected ? "Edit" : "Link"}
                        </button>
                        {isConnected && (
                          <button
                            onClick={() => handleDisconnect(id)}
                            className="px-3 py-1.5 rounded-lg bg-error/10 text-error text-xs hover:bg-error/20"
                          >
                            Disconnect
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------------------------------------------------------- */}
        {/*  Change Password                                            */}
        {/* ---------------------------------------------------------- */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold font-serif text-text mb-4">
            Change Password
          </h2>
          <div className="space-y-4 max-w-md">
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
              disabled={savingPassword || !newPassword || !confirmPassword}
              className="px-6 py-2.5 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingPassword ? "Saving..." : "Update Password"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-sm text-gold">Powered by GoElev8.ai</p>
        </div>
      </div>
    </PortalLayout>
  );
}

/* ------------------------------------------------------------------ */
/*  Social Media Icons                                                 */
/* ------------------------------------------------------------------ */

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}
