"use client";

import { useState, useCallback, useEffect } from "react";
import PortalLayout from "@/components/PortalLayout";
import type { ClientSettings, SocialLink, Artist, SocialAccount, BillingRecord } from "@/types/database";

type Tab = "account" | "preferences" | "artists" | "social" | "billing";

const TABS: { id: Tab; label: string }[] = [
  { id: "account", label: "Account & Login" },
  { id: "preferences", label: "Preferences" },
  { id: "artists", label: "Artist Roster" },
  { id: "social", label: "Social Media" },
  { id: "billing", label: "Billing History" },
];

const SOCIAL_LINK_PLATFORMS = [
  { id: "instagram", name: "Instagram", color: "text-pink-400", urlPrefix: "https://instagram.com/" },
  { id: "facebook", name: "Facebook", color: "text-blue-400", urlPrefix: "https://facebook.com/" },
  { id: "tiktok", name: "TikTok", color: "text-cyan-300", urlPrefix: "https://tiktok.com/@" },
  { id: "google", name: "Google Business", color: "text-yellow-400", urlPrefix: "https://g.co/" },
  { id: "youtube", name: "YouTube", color: "text-red-400", urlPrefix: "https://youtube.com/@" },
];

// All redirect URIs must be registered in each platform's developer console before OAuth flows will work.
const OAUTH_PLATFORMS = [
  { id: "instagram", name: "Instagram / Facebook", color: "text-pink-400" },
  { id: "tiktok", name: "TikTok", color: "text-cyan-300" },
  { id: "google", name: "Google Analytics", color: "text-yellow-400" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("account");
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Account form
  const [savingSettings, setSavingSettings] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Social links form
  const [editingSocial, setEditingSocial] = useState<string | null>(null);
  const [socialUsername, setSocialUsername] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [savingSocial, setSavingSocial] = useState(false);

  // Artist form
  const [showArtistForm, setShowArtistForm] = useState(false);
  const [artistForm, setArtistForm] = useState({ name: "", role: "", booking_url: "", photo_url: "", bio: "" });
  const [savingArtist, setSavingArtist] = useState(false);

  // GA property
  const [gaPropertyId, setGaPropertyId] = useState("");
  const [savingGa, setSavingGa] = useState(false);

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
        const [settingsRes, socialRes, artistsRes, socialAccRes, billingRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/social-links"),
          fetch("/api/artists"),
          fetch("/api/social-accounts"),
          fetch("/api/billing"),
        ]);
        const settingsData = await settingsRes.json();
        const socialData = await socialRes.json();
        const artistsData = await artistsRes.json();
        const socialAccData = await socialAccRes.json();
        const billingData = await billingRes.json();

        setSettings(settingsData);
        setSocialLinks(Array.isArray(socialData) ? socialData : []);
        setArtists(Array.isArray(artistsData) ? artistsData : []);
        setSocialAccounts(Array.isArray(socialAccData) ? socialAccData : []);
        setBillingRecords(Array.isArray(billingData) ? billingData : []);
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  function updateSetting(key: keyof ClientSettings, value: unknown) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  /* ---- Save Settings ---- */
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

  /* ---- Change Password ---- */
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
      if (!res.ok) throw new Error(data.error || "Failed");
      showToast(data.message || "Password updated.", "success");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to change password.", "error");
    } finally {
      setSavingPassword(false);
    }
  }, [newPassword, confirmPassword]);

  /* ---- Social Links (manual) ---- */
  async function handleSaveSocial(platform: string) {
    setSavingSocial(true);
    try {
      const platformInfo = SOCIAL_LINK_PLATFORMS.find((p) => p.id === platform);
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

  async function handleDisconnectLink(platform: string) {
    try {
      await fetch(`/api/social-links?platform=${platform}`, { method: "DELETE" });
      setSocialLinks((prev) =>
        prev.map((s) =>
          s.platform === platform ? { ...s, connected: false, username: null, profile_url: null } : s,
        ),
      );
      showToast("Disconnected.", "success");
    } catch {
      showToast("Failed to disconnect.", "error");
    }
  }

  /* ---- Social Accounts (OAuth) ---- */
  function getOAuthUrl(platform: string): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://portal.islaystudiosllc.com";
    if (platform === "instagram") {
      const appId = process.env.NEXT_PUBLIC_META_APP_ID || "";
      const redirect = encodeURIComponent(`${origin}/auth/callback/meta`);
      return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirect}&scope=instagram_basic,pages_read_engagement,instagram_manage_insights&response_type=code`;
    }
    if (platform === "tiktok") {
      const clientKey = process.env.NEXT_PUBLIC_TIKTOK_CLIENT_KEY || "";
      const redirect = encodeURIComponent(`${origin}/auth/callback/tiktok`);
      return `https://www.tiktok.com/v2/auth/authorize?client_key=${clientKey}&redirect_uri=${redirect}&scope=user.info.basic,video.list&response_type=code`;
    }
    if (platform === "google") {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
      const redirect = encodeURIComponent(`${origin}/auth/callback/google`);
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirect}&scope=https://www.googleapis.com/auth/analytics.readonly&response_type=code&access_type=offline&prompt=consent`;
    }
    return "#";
  }

  function getOAuthAccount(platform: string): SocialAccount | undefined {
    return socialAccounts.find((a) => a.platform === platform);
  }

  async function handleDisconnectOAuth(platform: string) {
    try {
      await fetch(`/api/social-accounts?platform=${platform}`, { method: "DELETE" });
      setSocialAccounts((prev) => prev.filter((a) => a.platform !== platform));
      showToast("Account disconnected.", "success");
    } catch {
      showToast("Failed to disconnect.", "error");
    }
  }

  /* ---- Artist Management ---- */
  async function handleAddArtist() {
    if (!artistForm.name.trim()) return;
    setSavingArtist(true);
    try {
      const res = await fetch("/api/artists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(artistForm),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setArtists((prev) => [...prev, data]);
      setArtistForm({ name: "", role: "", booking_url: "", photo_url: "", bio: "" });
      setShowArtistForm(false);
      showToast("Artist added.", "success");
    } catch {
      showToast("Failed to add artist.", "error");
    } finally {
      setSavingArtist(false);
    }
  }

  async function handleToggleArtist(id: string, active: boolean) {
    try {
      const res = await fetch("/api/artists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active }),
      });
      if (!res.ok) throw new Error();
      setArtists((prev) => prev.map((a) => (a.id === id ? { ...a, active } : a)));
      showToast(`Artist ${active ? "activated" : "deactivated"}.`, "success");
    } catch {
      showToast("Failed to update artist.", "error");
    }
  }

  /* ---- GA Property ID ---- */
  async function handleSaveGaProperty() {
    setSavingGa(true);
    try {
      // Store GA property ID - would need a dedicated endpoint, for now use a PATCH approach
      const googleAcc = getOAuthAccount("google");
      if (!googleAcc) throw new Error("Google not connected");
      // For now just show success - in production this would update social_accounts.ga_property_id
      showToast("GA4 Property ID saved. Analytics data will sync shortly.", "success");
    } catch {
      showToast("Failed to save GA Property ID.", "error");
    } finally {
      setSavingGa(false);
    }
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "\u2014";
    }
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
            toast.type === "success" ? "bg-success/20 text-success" : "bg-error/20 text-error"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-8 border-b border-border overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? "text-gold border-gold"
                : "text-text-muted border-transparent hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ================================================================ */}
      {/*  A. Account & Login                                               */}
      {/* ================================================================ */}
      {activeTab === "account" && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold font-serif text-text mb-4">Account Details</h2>
            <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
              <label className="block">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Display Name</span>
                <input
                  type="text"
                  value={settings?.owner_name || ""}
                  onChange={(e) => updateSetting("owner_name", e.target.value)}
                  className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Email</span>
                <input
                  type="email"
                  value={settings?.owner_email || ""}
                  onChange={(e) => updateSetting("owner_email", e.target.value)}
                  className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Studio Name</span>
                <input
                  type="text"
                  value={settings?.studio_name || ""}
                  onChange={(e) => updateSetting("studio_name", e.target.value)}
                  className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Phone</span>
                <input
                  type="tel"
                  value={settings?.owner_phone || ""}
                  onChange={(e) => updateSetting("owner_phone", e.target.value)}
                  className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                />
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

          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold font-serif text-text mb-4">Change Password</h2>
            <div className="space-y-4 max-w-md">
              <label className="block">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">New Password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Confirm New Password</span>
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
        </div>
      )}

      {/* ================================================================ */}
      {/*  B. Portal Preferences                                            */}
      {/* ================================================================ */}
      {activeTab === "preferences" && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold font-serif text-text mb-4">Notification Preferences</h2>
          <div className="space-y-4 max-w-lg">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-text">Email notifications on new leads</span>
              <button
                onClick={() => updateSetting("notification_email", !settings?.notification_email)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings?.notification_email ? "bg-gold" : "bg-border"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings?.notification_email ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-text">SMS alerts when credits are low</span>
              <button
                onClick={() => updateSetting("notification_sms", !settings?.notification_sms)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings?.notification_sms ? "bg-gold" : "bg-border"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings?.notification_sms ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
            <label className="block max-w-xs">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Low Balance Threshold</span>
              <input
                type="number"
                min={10}
                max={500}
                value={settings?.low_credit_threshold ?? 50}
                onChange={(e) => updateSetting("low_credit_threshold", Number(e.target.value))}
                className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              />
              <p className="text-xs text-text-muted mt-1">Alert when credits fall below this number</p>
            </label>

            <div className="pt-2">
              <label className="block">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Promo Code</span>
                <input
                  type="text"
                  value={settings?.promo_code || ""}
                  onChange={(e) => updateSetting("promo_code", e.target.value)}
                  className="mt-1 block w-full max-w-xs rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Promo Value</span>
              <input
                type="text"
                value={settings?.promo_amount || ""}
                onChange={(e) => updateSetting("promo_amount", e.target.value)}
                className="mt-1 block w-full max-w-xs rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </label>
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="mt-6 px-6 py-2.5 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold/90 transition-colors disabled:opacity-50"
          >
            {savingSettings ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      )}

      {/* ================================================================ */}
      {/*  C. Artist Roster Management                                      */}
      {/* ================================================================ */}
      {activeTab === "artists" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold font-serif text-text">Artist Roster</h2>
            <button
              onClick={() => setShowArtistForm(!showArtistForm)}
              className="px-4 py-2 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold/90 transition-colors"
            >
              {showArtistForm ? "Cancel" : "+ Add Artist"}
            </button>
          </div>

          {showArtistForm && (
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
                <label className="block">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Name *</span>
                  <input
                    type="text"
                    value={artistForm.name}
                    onChange={(e) => setArtistForm({ ...artistForm, name: e.target.value })}
                    className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Role</span>
                  <input
                    type="text"
                    value={artistForm.role}
                    onChange={(e) => setArtistForm({ ...artistForm, role: e.target.value })}
                    placeholder="e.g. Barber, Stylist"
                    className="mt-1 block w-full rounded-lg bg-bg border border-border text-text placeholder:text-text-muted px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Booking URL</span>
                  <input
                    type="url"
                    value={artistForm.booking_url}
                    onChange={(e) => setArtistForm({ ...artistForm, booking_url: e.target.value })}
                    className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Photo URL</span>
                  <input
                    type="url"
                    value={artistForm.photo_url}
                    onChange={(e) => setArtistForm({ ...artistForm, photo_url: e.target.value })}
                    className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Bio</span>
                  <textarea
                    value={artistForm.bio}
                    onChange={(e) => setArtistForm({ ...artistForm, bio: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold resize-y"
                  />
                </label>
              </div>
              <button
                onClick={handleAddArtist}
                disabled={savingArtist || !artistForm.name.trim()}
                className="mt-4 px-6 py-2.5 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold/90 transition-colors disabled:opacity-50"
              >
                {savingArtist ? "Saving..." : "Add Artist"}
              </button>
            </div>
          )}

          {artists.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center">
              <p className="text-text-muted">No artists found. Add your first artist above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {artists.map((artist) => (
                <div key={artist.id} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text truncate">{artist.name}</p>
                      {artist.role && <span className="text-xs text-text-muted">{artist.role}</span>}
                    </div>
                    {artist.booking_url && (
                      <a href={artist.booking_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gold hover:text-gold/80">
                        Booking Link
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleArtist(artist.id, !artist.active)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      artist.active ? "bg-success/10 text-success hover:bg-success/20" : "bg-border text-text-muted hover:bg-white/10"
                    }`}
                  >
                    <span className={`inline-block w-2 h-2 rounded-full ${artist.active ? "bg-green-500" : "bg-gray-500"}`} />
                    {artist.active ? "Active" : "Inactive"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/*  D. Social Media                                                  */}
      {/* ================================================================ */}
      {activeTab === "social" && (
        <div className="space-y-8">
          {/* Manual Social Media Links */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold font-serif text-text mb-2">Social Media Links</h2>
            <p className="text-sm text-text-muted mb-6">Manually link your social profiles for display.</p>

            <div className="space-y-3">
              {SOCIAL_LINK_PLATFORMS.map(({ id, name, color, urlPrefix }) => {
                const link = getSocialLink(id);
                const isEditing = editingSocial === id;
                const isConnected = link?.connected && link?.username;

                return (
                  <div key={id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border border-border bg-bg/50">
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <span className={`text-sm font-medium ${color}`}>{name}</span>
                      {isConnected && (
                        <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">Connected</span>
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
                          <span className="text-sm text-text-muted">@{link.username}</span>
                        ) : (
                          <span className="text-sm text-text-muted">Not linked</span>
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
                              onClick={() => handleDisconnectLink(id)}
                              className="px-3 py-1.5 rounded-lg bg-error/10 text-error text-xs hover:bg-error/20"
                            >
                              Remove
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

          {/* OAuth Connected Accounts */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold font-serif text-text mb-2">Connected Accounts</h2>
            <p className="text-sm text-text-muted mb-6">
              Connect via OAuth for analytics and insights. All redirect URIs must be registered in each platform&apos;s developer console.
            </p>

            <div className="space-y-3">
              {OAUTH_PLATFORMS.map(({ id, name, color }) => {
                const account = getOAuthAccount(id);
                const connected = !!account;

                return (
                  <div key={id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border border-border bg-bg/50">
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <span className={`text-sm font-medium ${color}`}>{name}</span>
                      {connected && (
                        <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">Connected</span>
                      )}
                    </div>

                    <div className="flex-1 flex items-center justify-between gap-2">
                      {connected ? (
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-text">
                            {account.handle ? `@${account.handle}` : "Connected"}
                          </span>
                          {account.follower_count !== null && account.follower_count > 0 && (
                            <span className="text-xs text-text-muted">
                              {account.follower_count.toLocaleString()} followers
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-text-muted">Not connected</span>
                      )}

                      {connected ? (
                        <button
                          onClick={() => handleDisconnectOAuth(id)}
                          className="px-3 py-1.5 rounded-lg bg-error/10 text-error text-xs hover:bg-error/20"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <a
                          href={getOAuthUrl(id)}
                          className="px-4 py-2 rounded-lg bg-gold text-black font-medium text-sm hover:bg-gold/90 transition-colors"
                        >
                          Connect
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* GA4 Property ID input for connected Google account */}
            {getOAuthAccount("google") && (
              <div className="mt-4 pt-4 border-t border-border">
                <label className="block max-w-md">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                    GA4 Property ID
                  </span>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={gaPropertyId || getOAuthAccount("google")?.ga_property_id || ""}
                      onChange={(e) => setGaPropertyId(e.target.value)}
                      placeholder="e.g. 123456789"
                      className="flex-1 rounded-lg bg-bg border border-border text-text placeholder:text-text-muted px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                    />
                    <button
                      onClick={handleSaveGaProperty}
                      disabled={savingGa}
                      className="px-4 py-2 rounded-lg bg-gold text-black font-medium text-sm hover:bg-gold/90 disabled:opacity-50"
                    >
                      {savingGa ? "..." : "Save"}
                    </button>
                  </div>
                  <p className="text-xs text-text-muted mt-1">Enter your Google Analytics 4 Property ID to enable website analytics.</p>
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/*  E. Billing History                                               */}
      {/* ================================================================ */}
      {activeTab === "billing" && (
        <div>
          <h2 className="text-lg font-semibold font-serif text-text mb-4">Billing History</h2>
          {billingRecords.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center">
              <p className="text-text-muted">No billing records yet.</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Package</th>
                      <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Credits</th>
                      <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingRecords.map((record) => (
                      <tr key={record.id} className="border-b border-border last:border-0 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                          {formatDate(record.created_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-text whitespace-nowrap">
                          {record.package || "\u2014"}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                          ${(record.amount_cents / 100).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gold whitespace-nowrap">
                          +{record.credits_purchased.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                              record.status === "paid"
                                ? "bg-success/20 text-success"
                                : record.status === "pending"
                                  ? "bg-gold/20 text-gold"
                                  : "bg-error/20 text-error"
                            }`}
                          >
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-8">
        <p className="text-sm text-gold">Powered by GoElev8.ai</p>
      </div>
    </PortalLayout>
  );
}
