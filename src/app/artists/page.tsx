"use client";

import { useEffect, useState, useCallback } from "react";
import PortalLayout from "@/components/PortalLayout";
import type { Artist } from "@/types/database";

function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-card rounded-xl border border-border p-6 animate-pulse space-y-4"
        >
          <div className="h-6 w-2/3 bg-border rounded" />
          <div className="h-4 w-1/3 bg-border rounded" />
          <div className="h-4 w-1/2 bg-border rounded" />
          <div className="flex gap-4 mt-4">
            <div className="h-10 flex-1 bg-border rounded" />
            <div className="h-10 flex-1 bg-border rounded" />
            <div className="h-10 flex-1 bg-border rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ArtistCard({
  artist,
  onToggle,
}: {
  artist: Artist;
  onToggle: (id: string, active: boolean) => void;
}) {
  const conversionRate =
    artist.total_leads > 0
      ? ((artist.total_bookings / artist.total_leads) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="bg-card rounded-xl border border-border p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {artist.photo_url && (
            <div className="w-12 h-12 rounded-full bg-border mb-2 overflow-hidden">
              <img
                src={artist.photo_url}
                alt={artist.name || ""}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <h3 className="text-lg font-bold text-text">{artist.name || "\u2014"}</h3>
          <p className="text-sm text-text-muted mt-0.5">{artist.role || "\u2014"}</p>
        </div>
        <button
          onClick={() => onToggle(artist.id, !artist.active)}
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            artist.active
              ? "bg-success/10 text-success hover:bg-success/20"
              : "bg-border text-text-muted hover:bg-white/10"
          }`}
        >
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              artist.active ? "bg-green-500" : "bg-gray-500"
            }`}
          />
          {artist.active ? "Active" : "Inactive"}
        </button>
      </div>

      {artist.bio && (
        <p className="text-xs text-text-muted line-clamp-2">{artist.bio}</p>
      )}

      <div>
        {artist.booking_url ? (
          <a
            href={artist.booking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gold hover:text-gold/80 underline underline-offset-2 transition-colors"
          >
            {artist.booking_platform || "Booking Link"}
          </a>
        ) : artist.booking_platform ? (
          <p className="text-sm text-text-muted">{artist.booking_platform}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-3 mt-auto pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-lg font-bold text-text">{artist.total_leads}</p>
          <p className="text-xs text-text-muted">Leads</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-text">{artist.total_bookings}</p>
          <p className="text-xs text-text-muted">Bookings</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gold">{conversionRate}%</p>
          <p className="text-xs text-text-muted">Conversion</p>
        </div>
      </div>
    </div>
  );
}

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    booking_url: "",
    photo_url: "",
    bio: "",
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  function showToast(message: string, type: "success" | "error") {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  const fetchArtists = useCallback(async () => {
    try {
      const res = await fetch("/api/artists");
      const data = await res.json();
      setArtists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch artists:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArtists();
  }, [fetchArtists]);

  async function handleToggleActive(id: string, active: boolean) {
    try {
      const res = await fetch("/api/artists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active }),
      });
      if (!res.ok) throw new Error();
      setArtists((prev) =>
        prev.map((a) => (a.id === id ? { ...a, active } : a)),
      );
      showToast(`Artist ${active ? "activated" : "deactivated"}.`, "success");
    } catch {
      showToast("Failed to update artist.", "error");
    }
  }

  async function handleAddArtist() {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/artists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error();
      showToast("Artist added.", "success");
      setFormData({ name: "", role: "", booking_url: "", photo_url: "", bio: "" });
      setShowForm(false);
      fetchArtists();
    } catch {
      showToast("Failed to add artist.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalLayout>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-serif text-text">Artists</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold/90 transition-colors"
        >
          {showForm ? "Cancel" : "+ Add Artist"}
        </button>
      </div>

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

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-6 mb-8">
          <h2 className="text-lg font-semibold font-serif text-text mb-4">Add New Artist</h2>
          <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
            <label className="block">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Name *
              </span>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Role
              </span>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="e.g. Barber, Stylist"
                className="mt-1 block w-full rounded-lg bg-bg border border-border text-text placeholder:text-text-muted px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Booking URL
              </span>
              <input
                type="url"
                value={formData.booking_url}
                onChange={(e) => setFormData({ ...formData, booking_url: e.target.value })}
                className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Photo URL
              </span>
              <input
                type="url"
                value={formData.photo_url}
                onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Bio
              </span>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold resize-y"
              />
            </label>
          </div>
          <button
            onClick={handleAddArtist}
            disabled={saving || !formData.name.trim()}
            className="mt-4 px-6 py-2.5 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add Artist"}
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonCards />
      ) : artists.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <p className="text-text-muted">No artists found. Add your first artist above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {artists.map((artist) => (
            <ArtistCard
              key={artist.id}
              artist={artist}
              onToggle={handleToggleActive}
            />
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
