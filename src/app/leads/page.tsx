"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import PortalLayout from "@/components/PortalLayout";
import type { Lead, Artist } from "@/types/database";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUSES = ["New", "Contacted", "Booked", "No Show", "Lost"] as const;
type Status = (typeof STATUSES)[number];

const statusColors: Record<string, string> = {
  New: "bg-gold/20 text-gold",
  Contacted: "bg-blue-500/20 text-blue-400",
  Booked: "bg-success/20 text-success",
  "No Show": "bg-error/20 text-error",
  Lost: "bg-red-400/20 text-red-400",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
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

function truncate(text: string | null, max = 40): string {
  if (!text) return "\u2014";
  return text.length > max ? text.slice(0, max) + "\u2026" : text;
}

/* ------------------------------------------------------------------ */
/*  Skeleton loaders                                                   */
/* ------------------------------------------------------------------ */

function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-pulse">
      <div className="flex gap-4 mb-6">
        <div className="h-4 w-1/6 bg-border rounded" />
        <div className="h-4 w-1/6 bg-border rounded" />
        <div className="h-4 w-1/6 bg-border rounded" />
        <div className="h-4 w-1/6 bg-border rounded" />
        <div className="h-4 w-1/12 bg-border rounded" />
        <div className="h-4 w-1/12 bg-border rounded" />
        <div className="h-4 w-1/12 bg-border rounded" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 mb-4">
          <div className="h-4 w-1/6 bg-border rounded" />
          <div className="h-4 w-1/6 bg-border rounded" />
          <div className="h-4 w-1/6 bg-border rounded" />
          <div className="h-4 w-1/6 bg-border rounded" />
          <div className="h-4 w-1/12 bg-border rounded" />
          <div className="h-4 w-1/12 bg-border rounded" />
          <div className="h-4 w-1/12 bg-border rounded" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Slide-over panel                                                   */
/* ------------------------------------------------------------------ */

function SlideOver({
  lead,
  onClose,
  onSaved,
}: {
  lead: Lead;
  onClose: () => void;
  onSaved: (updated: Lead) => void;
}) {
  const [status, setStatus] = useState<string>(lead.lead_status || "New");
  const [bookingConfirmed, setBookingConfirmed] = useState(lead.booking_confirmed);
  const [promoClaimed, setPromoClaimed] = useState(lead.promo_claimed);
  const [notes, setNotes] = useState(lead.notes || "");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            lead_status: status,
            booking_confirmed: bookingConfirmed,
            promo_claimed: promoClaimed,
            notes,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated = await res.json();
      setToast({ type: "success", message: "Lead updated successfully." });
      onSaved(updated);
    } catch {
      setToast({ type: "error", message: "Failed to update lead." });
    } finally {
      setSaving(false);
    }
  }, [lead.id, status, bookingConfirmed, promoClaimed, notes, onSaved]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[400px] bg-card border-l border-border shadow-2xl transform transition-transform duration-300 ease-in-out translate-x-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold font-serif text-text">
            Lead Details
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Read-only details */}
          <div className="space-y-3">
            <Detail label="Name" value={lead.full_name || "\u2014"} />
            <Detail label="Phone" value={lead.phone || "\u2014"} />
            <Detail label="Artist" value={lead.artist_selected || "\u2014"} />
            <Detail label="Source" value={lead.lead_source || "\u2014"} />
            <Detail label="Date Entered" value={formatDate(lead.date_entered)} />
          </div>

          <hr className="border-border" />

          {/* Editable fields */}
          <div className="space-y-4">
            {/* Status */}
            <label className="block">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Status
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            {/* Booking Confirmed */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={bookingConfirmed}
                onChange={(e) => setBookingConfirmed(e.target.checked)}
                className="h-4 w-4 rounded border-border text-gold focus:ring-gold bg-bg"
              />
              <span className="text-sm text-text">Booking Confirmed</span>
            </label>

            {/* Promo Redeemed */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={promoClaimed}
                onChange={(e) => setPromoClaimed(e.target.checked)}
                className="h-4 w-4 rounded border-border text-gold focus:ring-gold bg-bg"
              />
              <span className="text-sm text-text">Promo Redeemed</span>
            </label>

            {/* Notes */}
            <label className="block">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Notes
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold resize-y"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border space-y-3">
          {toast && (
            <div
              className={`text-sm px-3 py-2 rounded-lg ${
                toast.type === "success"
                  ? "bg-success/20 text-success"
                  : "bg-error/20 text-error"
              }`}
            >
              {toast.message}
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving\u2026" : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm text-text mt-0.5">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [artistFilter, setArtistFilter] = useState("All");

  // Slide-over
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  /* Fetch data on mount */
  useEffect(() => {
    async function fetchData() {
      try {
        const [leadsRes, artistsRes] = await Promise.all([
          fetch("/api/leads"),
          fetch("/api/artists"),
        ]);
        const leadsData = await leadsRes.json();
        const artistsData = await artistsRes.json();
        setLeads(Array.isArray(leadsData) ? leadsData : []);
        setArtists(Array.isArray(artistsData) ? artistsData : []);
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  /* Filtered leads */
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const name = (lead.full_name || "").toLowerCase();
      const phone = (lead.phone || "").toLowerCase();
      const status = lead.lead_status || "New";
      const artist = (lead.artist_selected || "").toLowerCase();

      // Search filter
      const q = search.toLowerCase();
      if (q && !name.includes(q) && !phone.includes(q)) return false;

      // Status filter
      if (statusFilter !== "All" && status !== statusFilter) return false;

      // Artist filter
      if (artistFilter !== "All" && !artist.includes(artistFilter.toLowerCase()))
        return false;

      return true;
    });
  }, [leads, search, statusFilter, artistFilter]);

  /* Handle slide-over save */
  const handleLeadSaved = useCallback(
    (updated: Lead) => {
      setLeads((prev) =>
        prev.map((l) => (l.id === updated.id ? updated : l)),
      );
      setSelectedLead(updated);
    },
    [],
  );

  /* Artist names for filter dropdown */
  const artistNames = useMemo(() => {
    const names: string[] = [];
    for (const a of artists) {
      if (a.name) names.push(a.name);
    }
    return names.sort();
  }, [artists]);

  return (
    <PortalLayout>
      {/* Title */}
      <h1 className="text-3xl font-bold font-serif text-text mb-8">Leads</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name or phone\u2026"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-0 rounded-lg bg-card border border-border text-text placeholder:text-text-muted px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg bg-card border border-border text-text px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
        >
          <option value="All">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={artistFilter}
          onChange={(e) => setArtistFilter(e.target.value)}
          className="rounded-lg bg-card border border-border text-text px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
        >
          <option value="All">All Artists</option>
          {artistNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable />
      ) : filteredLeads.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <p className="text-text-muted">No leads found.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Artist
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Date Entered
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Promo
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Booked
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const status = lead.lead_status || "New";
                  const badgeClass =
                    statusColors[status] || "bg-border text-text-muted";

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className="border-b border-border last:border-0 hover:bg-white/[0.03] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-sm text-text whitespace-nowrap">
                        {lead.full_name || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {lead.phone || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {lead.artist_selected || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {lead.lead_source || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {formatDate(lead.date_entered)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center whitespace-nowrap">
                        {lead.promo_claimed ? (
                          <span className="text-success">&#10003;</span>
                        ) : (
                          <span className="text-text-muted">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-center whitespace-nowrap">
                        {lead.booking_confirmed ? (
                          <span className="text-success">&#10003;</span>
                        ) : (
                          <span className="text-text-muted">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${badgeClass}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted max-w-[200px] truncate">
                        {truncate(lead.notes)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-over */}
      {selectedLead && (
        <SlideOver
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onSaved={handleLeadSaved}
        />
      )}
    </PortalLayout>
  );
}
