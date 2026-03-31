"use client";

import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CallRecord {
  id: string;
  fields: Record<string, unknown>;
}

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
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "\u2014";
  }
}

function truncate(text: unknown, max = 60): string {
  if (!text || typeof text !== "string") return "\u2014";
  return text.length > max ? text.slice(0, max) + "\u2026" : text;
}

function str(val: unknown): string {
  if (!val) return "\u2014";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return "\u2014";
}

function formatDuration(val: unknown): string {
  if (val === null || val === undefined) return "\u2014";
  const n = typeof val === "number" ? val : Number(val);
  if (isNaN(n)) return str(val);
  const mins = Math.floor(n / 60);
  const secs = n % 60;
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
/*  Modal                                                              */
/* ------------------------------------------------------------------ */

function CallModal({
  call,
  onClose,
}: {
  call: CallRecord;
  onClose: () => void;
}) {
  const f = call.fields;
  const summary = str(f["Transcript Summary"]);
  const transcriptUrl = f["Transcript URL"] as string | undefined;

  // Close on Escape
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
                  {formatDate(f["Date"])}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Caller Phone
                </p>
                <p className="text-sm text-text mt-0.5">
                  {str(f["Caller Phone"])}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Direction
                </p>
                <p className="text-sm text-text mt-0.5">
                  {str(f["Direction"])}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Duration
                </p>
                <p className="text-sm text-text mt-0.5">
                  {formatDuration(f["Duration"])}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Outcome
                </p>
                <p className="text-sm text-text mt-0.5">
                  {str(f["Outcome"])}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Artist Mentioned
                </p>
                <p className="text-sm text-text mt-0.5">
                  {str(f["Artist Mentioned"])}
                </p>
              </div>
            </div>

            <hr className="border-border" />

            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                Transcript Summary
              </p>
              <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">
                {summary}
              </p>
            </div>

            {transcriptUrl && (
              <a
                href={transcriptUrl}
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
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);

  useEffect(() => {
    async function fetchCalls() {
      try {
        const res = await fetch("/api/calls");
        const data = await res.json();
        setCalls(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch calls:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCalls();
  }, []);

  return (
    <PortalLayout>
      <h1 className="text-3xl font-bold font-serif text-text mb-8">
        Call Logs
      </h1>

      {loading ? (
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
                {calls.map((call) => {
                  const f = call.fields;
                  return (
                    <tr
                      key={call.id}
                      onClick={() => setSelectedCall(call)}
                      className="border-b border-border last:border-0 hover:bg-white/[0.03] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-sm text-text whitespace-nowrap">
                        {formatDate(f["Date"])}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {str(f["Caller Phone"])}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {str(f["Direction"])}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {formatDuration(f["Duration"])}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {str(f["Outcome"])}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {str(f["Artist Mentioned"])}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted max-w-[300px] truncate">
                        {truncate(f["Transcript Summary"], 60)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedCall && (
        <CallModal
          call={selectedCall}
          onClose={() => setSelectedCall(null)}
        />
      )}
    </PortalLayout>
  );
}
