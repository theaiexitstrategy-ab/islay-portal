"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import PortalLayout from "@/components/PortalLayout";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BlastRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface LeadRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface ArtistRecord {
  id: string;
  fields: Record<string, unknown>;
}

type Segment = "all" | "first_timers" | "returning" | "no_shows" | "by_artist";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: unknown): string {
  if (!dateStr || typeof dateStr !== "string") return "\u2014";
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

const statusColors: Record<string, string> = {
  Sent: "bg-success/20 text-success",
  Pending: "bg-gold/20 text-gold",
  Failed: "bg-error/20 text-error",
  Draft: "bg-border text-text-muted",
};

/* ------------------------------------------------------------------ */
/*  Skeleton loaders                                                   */
/* ------------------------------------------------------------------ */

function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-pulse">
      <div className="flex gap-4 mb-6">
        <div className="h-4 w-1/5 bg-border rounded" />
        <div className="h-4 w-1/6 bg-border rounded" />
        <div className="h-4 w-1/8 bg-border rounded" />
        <div className="h-4 w-1/8 bg-border rounded" />
        <div className="h-4 w-1/8 bg-border rounded" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 mb-4">
          <div className="h-4 w-1/5 bg-border rounded" />
          <div className="h-4 w-1/6 bg-border rounded" />
          <div className="h-4 w-1/8 bg-border rounded" />
          <div className="h-4 w-1/8 bg-border rounded" />
          <div className="h-4 w-1/8 bg-border rounded" />
        </div>
      ))}
    </div>
  );
}

function SkeletonForm() {
  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-pulse space-y-4">
      <div className="h-6 w-1/4 bg-border rounded" />
      <div className="h-10 w-full bg-border rounded" />
      <div className="h-24 w-full bg-border rounded" />
      <div className="h-10 w-full bg-border rounded" />
      <div className="h-10 w-full bg-border rounded" />
      <div className="h-10 w-1/3 bg-border rounded" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function BlastsPage() {
  const [blasts, setBlasts] = useState<BlastRecord[]>([]);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [artists, setArtists] = useState<ArtistRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [blastName, setBlastName] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [artistFilter, setArtistFilter] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  /* Fetch data on mount */
  const fetchAll = useCallback(async () => {
    try {
      const [blastsRes, leadsRes, artistsRes] = await Promise.all([
        fetch("/api/blasts"),
        fetch("/api/leads"),
        fetch("/api/artists"),
      ]);
      const blastsData = await blastsRes.json();
      const leadsData = await leadsRes.json();
      const artistsData = await artistsRes.json();
      setBlasts(Array.isArray(blastsData) ? blastsData : []);
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setArtists(Array.isArray(artistsData) ? artistsData : []);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* Artist names for dropdown */
  const artistNames = useMemo(() => {
    const names: string[] = [];
    for (const a of artists) {
      const name = a.fields["Name"] as string;
      if (name) names.push(name);
    }
    return names.sort();
  }, [artists]);

  /* Calculate recipient count */
  const recipientCount = useMemo(() => {
    const withPhone = leads.filter((l) => !!(l.fields["Phone"] as string));

    switch (segment) {
      case "all":
        return withPhone.length;
      case "first_timers":
        return withPhone.filter(
          (l) => !(l.fields["Booking Confirmed"] as boolean),
        ).length;
      case "returning":
        return withPhone.filter(
          (l) => !!(l.fields["Booking Confirmed"] as boolean),
        ).length;
      case "no_shows":
        return withPhone.filter(
          (l) => (l.fields["Status"] as string) === "No Show",
        ).length;
      case "by_artist": {
        if (!artistFilter) return 0;
        return withPhone.filter((l) => {
          const raw = l.fields["Artist Name"] ?? l.fields["Artist"];
          if (typeof raw === "string") return raw === artistFilter;
          if (Array.isArray(raw)) return raw.includes(artistFilter);
          return false;
        }).length;
      }
      default:
        return 0;
    }
  }, [leads, segment, artistFilter]);

  /* Send blast */
  const handleSend = useCallback(async () => {
    if (!blastName.trim() || !messageBody.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/blasts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: blastName,
          message: messageBody,
          promoCode: promoCode || undefined,
          segment,
          artistFilter: segment === "by_artist" ? artistFilter : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to send blast");
      const data = await res.json();
      setResult({
        type: "success",
        message: `${data.sent} sent, ${data.failed} failed`,
      });
      // Reset form
      setBlastName("");
      setMessageBody("");
      setPromoCode("");
      setSegment("all");
      setArtistFilter("");
      // Refresh blasts table
      const blastsRes = await fetch("/api/blasts");
      const blastsData = await blastsRes.json();
      setBlasts(Array.isArray(blastsData) ? blastsData : []);
    } catch {
      setResult({ type: "error", message: "Failed to send blast." });
    } finally {
      setSending(false);
    }
  }, [blastName, messageBody, promoCode, segment, artistFilter]);

  /* Auto-dismiss result banner */
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 5000);
    return () => clearTimeout(t);
  }, [result]);

  const charCount = messageBody.length;

  return (
    <PortalLayout>
      {/* Title */}
      <h1 className="text-3xl font-bold font-serif text-text mb-8">
        SMS Blasts
      </h1>

      {/* ------------------------------------------------------------ */}
      {/*  Section A — Past Blasts                                      */}
      {/* ------------------------------------------------------------ */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold font-serif text-text mb-4">
          Past Blasts
        </h2>

        {loading ? (
          <SkeletonTable />
        ) : blasts.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-text-muted">No blasts sent yet.</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Blast Name
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Date Sent
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Recipients
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Delivered
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {blasts.map((blast) => {
                    const f = blast.fields;
                    const status = (f["Status"] as string) || "Pending";
                    const badgeClass =
                      statusColors[status] || "bg-border text-text-muted";

                    return (
                      <tr
                        key={blast.id}
                        className="border-b border-border last:border-0 hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-text whitespace-nowrap">
                          {(f["Blast Name"] as string) || "\u2014"}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                          {formatDate(f["Date Sent"])}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                          {(f["Recipients"] as number) ?? "\u2014"}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                          {(f["Delivered"] as number) ?? "\u2014"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${badgeClass}`}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ */}
      {/*  Section B — New Blast Composer                                */}
      {/* ------------------------------------------------------------ */}
      <section>
        {loading ? (
          <SkeletonForm />
        ) : (
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-xl font-semibold font-serif text-text mb-6">
              New Blast
            </h2>

            {/* Result banner */}
            {result && (
              <div
                className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
                  result.type === "success"
                    ? "bg-success/20 text-success"
                    : "bg-error/20 text-error"
                }`}
              >
                {result.message}
              </div>
            )}

            <div className="space-y-5">
              {/* Blast Name */}
              <label className="block">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Blast Name
                </span>
                <input
                  type="text"
                  value={blastName}
                  onChange={(e) => setBlastName(e.target.value)}
                  placeholder="e.g. Spring Promo"
                  className="mt-1 block w-full rounded-lg bg-bg border border-border text-text placeholder:text-text-muted px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </label>

              {/* Message Body */}
              <label className="block">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Message Body
                </span>
                <textarea
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  rows={4}
                  placeholder="Type your message..."
                  className="mt-1 block w-full rounded-lg bg-bg border border-border text-text placeholder:text-text-muted px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold resize-y"
                />
                <p
                  className={`mt-1 text-xs ${
                    charCount >= 320
                      ? "text-error"
                      : charCount >= 160
                        ? "text-gold"
                        : "text-text-muted"
                  }`}
                >
                  {charCount} character{charCount !== 1 ? "s" : ""}
                  {charCount >= 160 && " — may be split into multiple SMS"}
                </p>
              </label>

              {/* Promo Code */}
              <label className="block">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Promo Code{" "}
                  <span className="normal-case text-text-muted">(optional)</span>
                </span>
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="e.g. SLAY10"
                  className="mt-1 block w-full rounded-lg bg-bg border border-border text-text placeholder:text-text-muted px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </label>

              {/* Target Segment */}
              <label className="block">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Target Segment
                </span>
                <select
                  value={segment}
                  onChange={(e) => {
                    setSegment(e.target.value as Segment);
                    if (e.target.value !== "by_artist") setArtistFilter("");
                  }}
                  className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                >
                  <option value="all">All Contacts</option>
                  <option value="first_timers">First Timers Only</option>
                  <option value="returning">Returning Only</option>
                  <option value="no_shows">No Shows</option>
                  <option value="by_artist">By Artist</option>
                </select>
              </label>

              {/* Artist Filter (conditional) */}
              {segment === "by_artist" && (
                <label className="block">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                    Artist
                  </span>
                  <select
                    value={artistFilter}
                    onChange={(e) => setArtistFilter(e.target.value)}
                    className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                  >
                    <option value="">Select an artist</option>
                    {artistNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* Preview line */}
              <p className="text-sm text-text-muted">
                <span className="font-semibold text-text">{recipientCount}</span>{" "}
                contact{recipientCount !== 1 ? "s" : ""} will receive this
                message
              </p>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={sending || !blastName.trim() || !messageBody.trim()}
                className="px-6 py-2.5 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? "Sending\u2026" : "Send Blast"}
              </button>
            </div>
          </div>
        )}
      </section>
    </PortalLayout>
  );
}
