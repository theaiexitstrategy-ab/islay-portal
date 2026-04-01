"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import PortalLayout from "@/components/PortalLayout";
import type { CreditTransaction } from "@/types/database";

const BUNDLES = [
  { id: "starter", name: "Starter", price: "$25", credits: 500, highlight: false },
  { id: "growth", name: "Growth", price: "$50", credits: 1100, highlight: true },
  { id: "pro", name: "Pro", price: "$100", credits: 2500, highlight: false },
];

export default function CreditsPage() {
  return (
    <Suspense fallback={
      <PortalLayout>
        <h1 className="text-3xl font-bold font-serif text-text mb-8">SMS Credits</h1>
        <div className="bg-card rounded-xl border border-border p-6 animate-pulse">
          <div className="h-10 w-24 bg-border rounded" />
        </div>
      </PortalLayout>
    }>
      <CreditsContent />
    </Suspense>
  );
}

function CreditsContent() {
  const searchParams = useSearchParams();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setToast("Payment successful! Credits have been added to your account.");
      setTimeout(() => setToast(null), 5000);
    }
    if (searchParams.get("cancelled") === "true") {
      setToast("Payment was cancelled.");
      setTimeout(() => setToast(null), 4000);
    }
  }, [searchParams]);

  useEffect(() => {
    async function fetchCredits() {
      try {
        const res = await fetch("/api/credits");
        const data = await res.json();
        setBalance(data.balance ?? 0);
        setTransactions(data.transactions ?? []);
      } catch (err) {
        console.error("Failed to fetch credits:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCredits();
  }, []);

  async function handleBuyCredits(bundleId: string) {
    setPurchasing(bundleId);
    try {
      const res = await fetch("/api/stripe-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundle_id: bundleId,
          success_url: window.location.origin + "/credits?success=true",
          cancel_url: window.location.origin + "/credits?cancelled=true",
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setToast(data.error || "Failed to start checkout");
        setTimeout(() => setToast(null), 4000);
      }
    } catch {
      setToast("Failed to connect to payment service");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setPurchasing(null);
    }
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  }

  return (
    <PortalLayout>
      <h1 className="text-3xl font-bold font-serif text-text mb-8">
        SMS Credits
      </h1>

      {/* Toast */}
      {toast && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-gold/10 border border-gold/30 text-gold text-sm">
          {toast}
        </div>
      )}

      {/* Balance Card */}
      <div className="bg-card rounded-xl border border-border p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-text-muted mb-1">Current Balance</p>
            {loading ? (
              <div className="h-10 w-24 bg-border rounded animate-pulse" />
            ) : (
              <p className="text-4xl font-bold text-gold">
                {balance?.toLocaleString()}
              </p>
            )}
            <p className="text-sm text-text-muted mt-1">SMS credits remaining</p>
          </div>
          {!loading && balance !== null && balance < 20 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-error/10 border border-error/30">
              <svg
                className="w-5 h-5 text-error flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
              <span className="text-sm text-error font-medium">
                Low balance! Purchase more credits to keep sending SMS.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Buy Credits */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold font-serif text-text mb-4">
          Buy Credits
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {BUNDLES.map((bundle) => (
            <div
              key={bundle.id}
              className={`bg-card rounded-xl border p-6 flex flex-col items-center text-center ${
                bundle.highlight
                  ? "border-gold shadow-lg shadow-gold/5"
                  : "border-border"
              }`}
            >
              {bundle.highlight && (
                <span className="text-xs font-medium text-gold bg-gold/10 px-2 py-0.5 rounded-full mb-3">
                  Most Popular
                </span>
              )}
              <p className="text-lg font-semibold text-text">{bundle.name}</p>
              <p className="text-3xl font-bold text-gold mt-2">{bundle.price}</p>
              <p className="text-sm text-text-muted mt-1">
                {bundle.credits.toLocaleString()} credits
              </p>
              <button
                onClick={() => handleBuyCredits(bundle.id)}
                disabled={purchasing !== null}
                className="mt-4 w-full px-4 py-2.5 bg-gold text-black font-medium rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {purchasing === bundle.id ? "Redirecting..." : "Buy Now"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div>
        <h2 className="text-xl font-semibold font-serif text-text mb-4">
          Transaction History
        </h2>
        {loading ? (
          <div className="bg-card rounded-xl border border-border p-6 animate-pulse">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 w-1/3 bg-border rounded" />
                  <div className="h-4 w-1/6 bg-border rounded" />
                  <div className="h-4 w-1/4 bg-border rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-text-muted">No transactions yet.</p>
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
                      Amount
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => (
                    <tr
                      key={txn.id}
                      className="border-b border-border last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {formatDate(txn.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span
                          className={
                            txn.amount > 0
                              ? "text-success font-medium"
                              : "text-error font-medium"
                          }
                        >
                          {txn.amount > 0 ? "+" : ""}
                          {txn.amount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted">
                        {txn.description || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
