"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import PortalLayout from "@/components/PortalLayout";
import type { Blast, Lead, Artist } from "@/types/database";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Segment = "all" | "first_timers" | "returning" | "no_shows" | "by_artist";

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
  const [blasts, setBlasts] = useState<Blast[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);

  // Single send state
  const [singlePhone, setSinglePhone] = useState("");
  const [singleName, setSingleName] = useState("");
  const [singleMessage, setSingleMessage] = useState("");
  const [singleSending, setSingleSending] = useState(false);
  const [singleResult, setSingleResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Bulk blast form state
  const [blastName, setBlastName] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [artistFilter, setArtistFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [promoCodeFilter, setPromoCodeFilter] = useState("");
  const [excludeIds, setExcludeIds] = useState<Set<string>>(new Set());
  const [showRecipientList, setShowRecipientList] = useState(false);
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
      if (a.name) names.push(a.name);
    }
    return names.sort();
  }, [artists]);

  /* Filtered recipients list (before exclusions) */
  const filteredRecipients = useMemo(() => {
    let pool = leads.filter((l) => !!l.phone);

    // Segment filter
    switch (segment) {
      case "first_timers":
        pool = pool.filter((l) => !l.booking_confirmed);
        break;
      case "returning":
        pool = pool.filter((l) => l.booking_confirmed);
        break;
      case "no_shows":
        pool = pool.filter((l) => l.lead_status === "No Show");
        break;
      case "by_artist":
        if (artistFilter) {
          pool = pool.filter((l) => l.artist_selected === artistFilter);
        }
        break;
      case "all":
      default:
        break;
    }

    // Artist filter (applies to ALL segments, additional narrowing)
    if (segment !== "by_artist" && artistFilter) {
      pool = pool.filter((l) => l.artist_selected === artistFilter);
    }

    // Date range filter on date_entered
    if (dateFrom) {
      const from = new Date(dateFrom);
      pool = pool.filter((l) => {
        if (!l.date_entered) return false;
        return new Date(l.date_entered) >= from;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      pool = pool.filter((l) => {
        if (!l.date_entered) return false;
        return new Date(l.date_entered) <= to;
      });
    }

    // Promo code filter
    if (promoCodeFilter.trim()) {
      const pf = promoCodeFilter.trim().toLowerCase();
      pool = pool.filter(
        (l) => l.promo_code && l.promo_code.toLowerCase().includes(pf)
      );
    }

    return pool;
  }, [leads, segment, artistFilter, dateFrom, dateTo, promoCodeFilter]);

  /* Final recipients after exclusions */
  const finalRecipients = useMemo(() => {
    if (excludeIds.size === 0) return filteredRecipients;
    return filteredRecipients.filter((l) => !excludeIds.has(l.id));
  }, [filteredRecipients, excludeIds]);

  const recipientCount = finalRecipients.length;

  // Reset exclusions when filters change
  useEffect(() => {
    setExcludeIds(new Set());
  }, [segment, artistFilter, dateFrom, dateTo, promoCodeFilter]);

  /* Send single SMS */
  const handleSingleSend = useCallback(async () => {
    if (!singlePhone.trim() || !singleMessage.trim()) return;
    setSingleSending(true);
    setSingleResult(null);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: singlePhone.trim(),
          message: singleMessage.trim(),
        }),
      });
      if (res.status === 402) {
        setSingleResult({
          type: "error",
          message: "Insufficient credits. Please reload to continue.",
        });
        return;
      }
      if (!res.ok) throw new Error("Failed to send SMS");
      setSingleResult({ type: "success", message: "SMS sent successfully." });
      setSinglePhone("");
      setSingleName("");
      setSingleMessage("");
    } catch {
      setSingleResult({ type: "error", message: "Failed to send SMS." });
    } finally {
      setSingleSending(false);
    }
  }, [singlePhone, singleMessage]);

  /* Send bulk blast */
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
          artistFilter: artistFilter || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          excludeIds: excludeIds.size > 0 ? Array.from(excludeIds) : undefined,
        }),
      });
      if (res.status === 402) {
        setResult({
          type: "error",
          message: "Insufficient credits. Please reload to continue.",
        });
        return;
      }
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
      setDateFrom("");
      setDateTo("");
      setPromoCodeFilter("");
      setExcludeIds(new Set());
      setShowRecipientList(false);
      // Refresh blasts table
      const blastsRes = await fetch("/api/blasts");
      const blastsData = await blastsRes.json();
      setBlasts(Array.isArray(blastsData) ? blastsData : []);
    } catch {
      setResult({ type: "error", message: "Failed to send blast." });
    } finally {
      setSending(false);
    }
  }, [
    blastName,
    messageBody,
    promoCode,
    segment,
    artistFilter,
    dateFrom,
    dateTo,
    excludeIds,
  ]);

  /* Auto-dismiss result banners */
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 5000);
    return () => clearTimeout(t);
  }, [result]);

  useEffect(() => {
    if (!singleResult) return;
    const t = setTimeout(() => setSingleResult(null), 5000);
    return () => clearTimeout(t);
  }, [singleResult]);

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
                    const status = blast.status || "Pending";
                    const badgeClass =
                      statusColors[status] || "bg-border text-text-muted";

                    return (
                      <tr
                        key={blast.id}
                        className="border-b border-border last:border-0 hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-text whitespace-nowrap">
                          {blast.blast_name || "\u2014"}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                          {formatDate(blast.sent_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                          {blast.total_recipients ?? "\u2014"}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                          {blast.delivered_count ?? "\u2014"}
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
      {/*  Section B — Single SMS Send                                   */}
      {/* ------------------------------------------------------------ */}
      <section className="mb-10">
        {loading ? (
          <SkeletonForm />
        ) : (
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-xl font-semibold font-serif text-text mb-6">
              Send Single SMS
            </h2>

            {/* Single send result banner */}
            {singleResult && (
              <div
                className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
                  singleResult.type === "success"
                    ? "bg-success/20 text-success"
                    : "bg-error/20 text-error"
                }`}
              >
                {singleResult.message}
              </div>
            )}

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Phone Number */}
                <label className="block">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                    Phone Number
                  </span>
                  <input
                    type="tel"
                    value={singlePhone}
                    onChange={(e) => setSinglePhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="mt-1 block w-full rounded-lg bg-bg border border-border text-text placeholder:text-text-muted px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Include country code, e.g. +1 for US
                  </p>
                </label>

                {/* Name (optional) */}
                <label className="block">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                    Name{" "}
                    <span className="normal-case text-text-muted">
                      (optional)
                    </span>
                  </span>
                  <input
                    type="text"
                    value={singleName}
                    onChange={(e) => setSingleName(e.target.value)}
                    placeholder="Recipient name"
                    className="mt-1 block w-full rounded-lg bg-bg border border-border text-text placeholder:text-text-muted px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                  />
                </label>
              </div>

              {/* Message */}
              <label className="block">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Message
                </span>
                <textarea
                  value={singleMessage}
                  onChange={(e) => setSingleMessage(e.target.value)}
                  rows={3}
                  placeholder="Type your message..."
                  className="mt-1 block w-full rounded-lg bg-bg border border-border text-text placeholder:text-text-muted px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold resize-y"
                />
              </label>

              {/* Send button */}
              <button
                onClick={handleSingleSend}
                disabled={
                  singleSending ||
                  !singlePhone.trim() ||
                  !singleMessage.trim()
                }
                className="px-6 py-2.5 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {singleSending ? "Sending\u2026" : "Send Single SMS"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ */}
      {/*  Section C — New Blast Composer                                */}
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

              {/* ---- Segment Filtering ---- */}
              <div className="border border-border rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-semibold text-text">
                  Audience Filters
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Target Segment */}
                  <label className="block">
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                      Target Segment
                    </span>
                    <select
                      value={segment}
                      onChange={(e) => {
                        setSegment(e.target.value as Segment);
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

                  {/* Artist Filter (always visible) */}
                  <label className="block">
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                      Artist{" "}
                      {segment !== "by_artist" && (
                        <span className="normal-case text-text-muted">
                          (optional)
                        </span>
                      )}
                    </span>
                    <select
                      value={artistFilter}
                      onChange={(e) => setArtistFilter(e.target.value)}
                      className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                    >
                      <option value="">
                        {segment === "by_artist"
                          ? "Select an artist"
                          : "All artists"}
                      </option>
                      {artistNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Date From */}
                  <label className="block">
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                      Lead Captured From
                    </span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                    />
                  </label>

                  {/* Date To */}
                  <label className="block">
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                      Lead Captured To
                    </span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="mt-1 block w-full rounded-lg bg-bg border border-border text-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                    />
                  </label>

                  {/* Promo Code Filter */}
                  <label className="block">
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                      Promo Code Filter
                    </span>
                    <input
                      type="text"
                      value={promoCodeFilter}
                      onChange={(e) => setPromoCodeFilter(e.target.value)}
                      placeholder="e.g. SLAY10"
                      className="mt-1 block w-full rounded-lg bg-bg border border-border text-text placeholder:text-text-muted px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                    />
                  </label>
                </div>
              </div>

              {/* Preview line + recipient list toggle */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-muted">
                  <span className="font-semibold text-text">
                    {recipientCount}
                  </span>{" "}
                  contact{recipientCount !== 1 ? "s" : ""} will receive this
                  message
                  {excludeIds.size > 0 && (
                    <span className="text-gold ml-1">
                      ({excludeIds.size} excluded)
                    </span>
                  )}
                </p>
                {filteredRecipients.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowRecipientList((v) => !v)}
                    className="text-xs text-gold hover:text-gold/80 transition-colors underline underline-offset-2"
                  >
                    {showRecipientList
                      ? "Hide recipient list"
                      : "Review recipients"}
                  </button>
                )}
              </div>

              {/* Recipient list with checkboxes */}
              {showRecipientList && filteredRecipients.length > 0 && (
                <div className="border border-border rounded-lg max-h-64 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border">
                        <th className="px-3 py-2 w-10">
                          <input
                            type="checkbox"
                            checked={excludeIds.size === 0}
                            onChange={() => {
                              if (excludeIds.size === 0) {
                                setExcludeIds(
                                  new Set(filteredRecipients.map((l) => l.id))
                                );
                              } else {
                                setExcludeIds(new Set());
                              }
                            }}
                            className="accent-gold"
                          />
                        </th>
                        <th className="px-3 py-2 text-xs font-medium text-text-muted uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-3 py-2 text-xs font-medium text-text-muted uppercase tracking-wider">
                          Phone
                        </th>
                        <th className="px-3 py-2 text-xs font-medium text-text-muted uppercase tracking-wider">
                          Artist
                        </th>
                        <th className="px-3 py-2 text-xs font-medium text-text-muted uppercase tracking-wider">
                          Promo
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecipients.map((lead) => {
                        const isExcluded = excludeIds.has(lead.id);
                        return (
                          <tr
                            key={lead.id}
                            className={`border-b border-border last:border-0 transition-colors ${
                              isExcluded
                                ? "opacity-50"
                                : "hover:bg-white/[0.03]"
                            }`}
                          >
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={!isExcluded}
                                onChange={() => {
                                  setExcludeIds((prev) => {
                                    const next = new Set(prev);
                                    if (isExcluded) {
                                      next.delete(lead.id);
                                    } else {
                                      next.add(lead.id);
                                    }
                                    return next;
                                  });
                                }}
                                className="accent-gold"
                              />
                            </td>
                            <td className="px-3 py-2 text-sm text-text whitespace-nowrap">
                              {lead.full_name || "\u2014"}
                            </td>
                            <td className="px-3 py-2 text-sm text-text-muted whitespace-nowrap">
                              {lead.phone}
                            </td>
                            <td className="px-3 py-2 text-sm text-text-muted whitespace-nowrap">
                              {lead.artist_selected || "\u2014"}
                            </td>
                            <td className="px-3 py-2 text-sm text-text-muted whitespace-nowrap">
                              {lead.promo_code || "\u2014"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={
                  sending ||
                  !blastName.trim() ||
                  !messageBody.trim() ||
                  recipientCount === 0
                }
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
