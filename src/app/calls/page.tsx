"use client";

import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import type { Call, CallLog } from "@/types/database";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type OutboundTab = "ai" | "manual";

type ReasonKey = "reschedule" | "cancel" | "reminder" | "promo" | "custom";

interface QuickReason {
  label: string;
  value: ReasonKey;
}

interface Toast {
  type: "success" | "error";
  message: string;
}

const QUICK_REASONS: QuickReason[] = [
  { label: "Reschedule Appointment", value: "reschedule" },
  { label: "Cancel Appointment", value: "cancel" },
  { label: "Appointment Reminder", value: "reminder" },
  { label: "Promo Notification", value: "promo" },
  { label: "Custom", value: "custom" },
];

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
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "\u2014";
  }
}

function truncate(text: string | null, max = 60): string {
  if (!text) return "\u2014";
  return text.length > max ? text.slice(0, max) + "\u2026" : text;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "\u2014";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

/* ------------------------------------------------------------------ */
/*  Skeleton loader                                                    */
/* ------------------------------------------------------------------ */

function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-pulse">
      <div className="flex gap-4 mb-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-4 w-1/6 bg-border rounded" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 mb-4">
          {Array.from({ length: 7 }).map((_, j) => (
            <div key={j} className="h-4 w-1/6 bg-border rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toast                                                              */
/* ------------------------------------------------------------------ */

function ToastBanner({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-lg text-sm font-medium shadow-lg transition-all ${
        toast.type === "success"
          ? "bg-success/20 text-success"
          : "bg-error/20 text-error"
      }`}
    >
      {toast.message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Call Detail Modal (inbound)                                        */
/* ------------------------------------------------------------------ */

function CallModal({
  call,
  onClose,
}: {
  call: Call;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-lg font-bold font-serif text-text">
              Call Details
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
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Date
                </p>
                <p className="text-sm text-text mt-0.5">
                  {formatDate(call.call_datetime)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Caller Phone
                </p>
                <p className="text-sm text-text mt-0.5">
                  {call.caller_phone || "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Direction
                </p>
                <p className="text-sm text-text mt-0.5">
                  {call.call_direction || "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Duration
                </p>
                <p className="text-sm text-text mt-0.5">
                  {formatDuration(call.duration_seconds)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Outcome
                </p>
                <p className="text-sm text-text mt-0.5">
                  {call.call_outcome || "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Artist Mentioned
                </p>
                <p className="text-sm text-text mt-0.5">
                  {call.artist_mentioned || "\u2014"}
                </p>
              </div>
            </div>

            <hr className="border-border" />

            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                Transcript Summary
              </p>
              <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">
                {call.transcript_summary || "\u2014"}
              </p>
            </div>

            {call.transcript_url && (
              <a
                href={call.transcript_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm text-gold hover:text-gold/80 underline underline-offset-2 transition-colors"
              >
                View Full Transcript
              </a>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold/90 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function CallsPage() {
  /* ---- Inbound call state ---- */
  const [calls, setCalls] = useState<Call[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(true);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  /* ---- Outbound log state ---- */
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  /* ---- Outbound form state ---- */
  const [activeTab, setActiveTab] = useState<OutboundTab>("ai");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState<ReasonKey | "">("");
  const [customReason, setCustomReason] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  /* ---- Fetch inbound calls ---- */
  useEffect(() => {
    async function fetchCalls() {
      try {
        const res = await fetch("/api/calls");
        const data = await res.json();
        setCalls(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch calls:", err);
      } finally {
        setLoadingCalls(false);
      }
    }
    fetchCalls();
  }, []);

  /* ---- Fetch outbound logs ---- */
  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch("/api/calls/outbound");
        const data = await res.json();
        setCallLogs(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch outbound logs:", err);
      } finally {
        setLoadingLogs(false);
      }
    }
    fetchLogs();
  }, []);

  /* ---- Submit outbound call ---- */
  async function handleOutboundSubmit() {
    if (!phone.trim()) return;

    if (activeTab === "ai" && !reason) return;

    setSubmitting(true);
    try {
      const body =
        activeTab === "ai"
          ? {
              phone: phone.trim(),
              reason: reason === "custom" ? customReason.trim() || "custom" : reason,
              mode: "ai" as const,
              note: note.trim() || undefined,
            }
          : {
              phone: phone.trim(),
              reason: "manual",
              mode: "manual" as const,
              note: note.trim() || undefined,
            };

      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to initiate call");
      }

      const newLog = await res.json();
      setCallLogs((prev) => [newLog, ...prev]);
      setPhone("");
      setReason("");
      setCustomReason("");
      setNote("");
      setToast({ type: "success", message: "Call initiated successfully." });
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  /* ---- Render ---- */
  return (
    <PortalLayout>
      <h1 className="text-3xl font-bold font-serif text-text mb-8">
        Call Center
      </h1>

      {/* Toast */}
      {toast && (
        <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
      )}

      {/* ============================================================ */}
      {/*  SECTION 1 : Outbound Call Controls                          */}
      {/* ============================================================ */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold font-serif text-text mb-4">
          Outbound Call
        </h2>

        <div className="bg-card rounded-xl border border-border p-6">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-border pb-3">
            <button
              onClick={() => setActiveTab("ai")}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                activeTab === "ai"
                  ? "bg-gold/10 text-gold border-gold"
                  : "text-text-muted border-transparent hover:text-text"
              }`}
            >
              AI Assistant
            </button>
            <button
              onClick={() => setActiveTab("manual")}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                activeTab === "manual"
                  ? "bg-gold/10 text-gold border-gold"
                  : "text-text-muted border-transparent hover:text-text"
              }`}
            >
              Manual Dial
            </button>
          </div>

          {/* AI Assistant Tab */}
          {activeTab === "ai" && (
            <div className="space-y-5">
              {/* Phone */}
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full rounded-lg bg-bg border border-border text-text placeholder:text-text-muted px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-2">
                  Reason
                </label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_REASONS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setReason(r.value)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        reason === r.value
                          ? "bg-gold/20 text-gold border-gold"
                          : "bg-white/5 text-text-muted border-border hover:bg-white/10"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom reason text */}
              {reason === "custom" && (
                <div>
                  <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-1.5">
                    Custom Reason
                  </label>
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Describe the reason..."
                    className="w-full rounded-lg bg-bg border border-border text-text placeholder:text-text-muted px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                  />
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleOutboundSubmit}
                disabled={submitting || !phone.trim() || !reason}
                className="px-6 py-2.5 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Calling..." : "Start AI Call"}
              </button>
            </div>
          )}

          {/* Manual Dial Tab */}
          {activeTab === "manual" && (
            <div className="space-y-5">
              {/* Phone */}
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full rounded-lg bg-bg border border-border text-text placeholder:text-text-muted px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-1.5">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note..."
                  className="w-full rounded-lg bg-bg border border-border text-text placeholder:text-text-muted px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleOutboundSubmit}
                disabled={submitting || !phone.trim()}
                className="px-6 py-2.5 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Calling..." : "Call Now"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/*  SECTION 2 : Outbound Call Log                               */}
      {/* ============================================================ */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold font-serif text-text mb-4">
          Outbound Call Log
        </h2>

        {loadingLogs ? (
          <SkeletonTable rows={4} />
        ) : callLogs.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-text-muted">No outbound calls yet.</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Mode
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {callLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-border last:border-0 hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-text whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {log.to_number || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap capitalize">
                        {log.reason || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            log.initiated_by === "ai"
                              ? "bg-gold/15 text-gold"
                              : "bg-white/10 text-text-muted"
                          }`}
                        >
                          {log.initiated_by === "ai" ? "AI" : "Manual"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap capitalize">
                        {log.status || "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ============================================================ */}
      {/*  SECTION 3 : Inbound Call History (Vapi)                     */}
      {/* ============================================================ */}
      <section>
        <h2 className="text-xl font-semibold font-serif text-text mb-4">
          Inbound Call History
        </h2>

        {loadingCalls ? (
          <SkeletonTable />
        ) : calls.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-text-muted">No calls found.</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Caller Phone
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Direction
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Outcome
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Artist Mentioned
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Transcript Summary
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr
                      key={call.id}
                      onClick={() => setSelectedCall(call)}
                      className="border-b border-border last:border-0 hover:bg-white/[0.03] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-sm text-text whitespace-nowrap">
                        {formatDate(call.call_datetime)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {call.caller_phone || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {call.call_direction || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {formatDuration(call.duration_seconds)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {call.call_outcome || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {call.artist_mentioned || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted max-w-[300px] truncate">
                        {truncate(call.transcript_summary, 60)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Inbound call detail modal */}
      {selectedCall && (
        <CallModal
          call={selectedCall}
          onClose={() => setSelectedCall(null)}
        />
      )}
    </PortalLayout>
  );
}
