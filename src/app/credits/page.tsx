"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import PortalLayout from "@/components/PortalLayout";
import type { CreditTransaction, AutoReload } from "@/types/database";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

interface TransactionWithBalance extends CreditTransaction {
  running_balance: number;
}

const PACKAGES = [
  {
    id: "500",
    name: "500 Credits",
    price: 25,
    credits: 500,
    costPerCredit: "$0.050",
    badge: null,
  },
  {
    id: "1000",
    name: "1,000 Credits",
    price: 45,
    credits: 1000,
    costPerCredit: "$0.045",
    badge: null,
  },
  {
    id: "2500",
    name: "2,500 Credits",
    price: 100,
    credits: 2500,
    costPerCredit: "$0.040",
    badge: "Best Value",
  },
];

const THRESHOLD_OPTIONS = [20, 50, 100];

const CREDITS_PER_SMS = 1;
const LOW_BALANCE_THRESHOLD = 50;

/* ------------------------------------------------------------------ */
/*  Page (Suspense wrapper)                                            */
/* ------------------------------------------------------------------ */

export default function CreditsPage() {
  return (
    <Suspense
      fallback={
        <PortalLayout>
          <h1 className="text-3xl font-bold font-serif text-text mb-8">
            SMS Credits
          </h1>
          <div className="bg-card rounded-xl border border-border p-6 animate-pulse">
            <div className="h-10 w-24 bg-border rounded" />
          </div>
        </PortalLayout>
      }
    >
      <CreditsContent />
    </Suspense>
  );
}

/* ------------------------------------------------------------------ */
/*  Content                                                            */
/* ------------------------------------------------------------------ */

function CreditsContent() {
  const searchParams = useSearchParams();

  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<TransactionWithBalance[]>(
    [],
  );
  const [autoReload, setAutoReload] = useState<AutoReload | null>(null);
  const [avgDailyUsage, setAvgDailyUsage] = useState<number>(0);
  const [projectedDays, setProjectedDays] = useState<number | null>(null);
  const [accountStatus, setAccountStatus] = useState<string>("active");
  const [creditsPerSms, setCreditsPerSms] = useState<number>(CREDITS_PER_SMS);
  const [lowBalanceThreshold, setLowBalanceThreshold] =
    useState<number>(LOW_BALANCE_THRESHOLD);

  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [savingAutoReload, setSavingAutoReload] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const [reloadModalOpen, setReloadModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<string>(
    PACKAGES[0].id,
  );

  /* ---------- search-param toasts (post-checkout redirect) ---------- */

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      showToast(
        "Payment successful! Credits have been added to your account.",
        "success",
      );
    }
    if (searchParams.get("cancelled") === "true") {
      showToast("Payment was cancelled.", "info");
    }
  }, [searchParams]);

  /* ---------- helpers ---------- */

  function showToast(
    message: string,
    type: "success" | "error" | "info" = "info",
  ) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
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
      return "\u2014";
    }
  }

  function getBalanceColor(bal: number): string {
    if (bal > 100) return "text-success";
    if (bal >= 20) return "text-yellow-400";
    return "text-error";
  }

  /* ---------- data fetching ---------- */

  useEffect(() => {
    fetchCredits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchCredits() {
    try {
      const [creditsRes, reloadRes] = await Promise.all([
        fetch("/api/credits"),
        fetch("/api/auto-reload"),
      ]);
      const data = await creditsRes.json();

      setBalance(data.balance ?? 0);
      setTransactions(data.transactions ?? []);
      setAvgDailyUsage(data.avgDailyUsage ?? 0);
      setProjectedDays(data.projectedDaysRemaining ?? null);

      // DB-level fields (fall back to defaults)
      setCreditsPerSms(data.credits_per_sms ?? CREDITS_PER_SMS);
      setLowBalanceThreshold(
        data.low_balance_threshold ?? LOW_BALANCE_THRESHOLD,
      );
      setAccountStatus(data.account_status ?? "active");

      if (reloadRes.ok) {
        const reloadData = await reloadRes.json();
        setAutoReload(reloadData ?? null);
      } else {
        setAutoReload(data.autoReload ?? null);
      }
    } catch (err) {
      console.error("Failed to fetch credits:", err);
    } finally {
      setLoading(false);
    }
  }

  /* ---------- realtime ---------- */

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const channel = supabase
      .channel("credits-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "credits",
          filter: "client_id=eq.islay_studios",
        },
        (payload: { new?: { balance?: number } }) => {
          if (payload.new && typeof payload.new.balance === "number") {
            setBalance(payload.new.balance);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "credit_transactions",
          filter: "client_id=eq.islay_studios",
        },
        () => {
          fetchCredits();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- actions ---------- */

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
        showToast(data.error || "Failed to start checkout", "error");
      }
    } catch {
      showToast("Failed to connect to payment service", "error");
    } finally {
      setPurchasing(null);
    }
  }

  async function handleAutoReloadUpdate(updates: Partial<AutoReload>) {
    setSavingAutoReload(true);
    try {
      const res = await fetch("/api/auto-reload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (res.ok) {
        setAutoReload(data);
        showToast("Auto-reload settings updated.", "success");
      } else {
        showToast(data.error || "Failed to update settings", "error");
      }
    } catch {
      showToast("Failed to update auto-reload settings", "error");
    } finally {
      setSavingAutoReload(false);
    }
  }

  /* ---------- derived values ---------- */

  const balanceColor =
    balance !== null ? getBalanceColor(balance) : "text-gold";

  const estimatedSms =
    balance !== null ? Math.floor(balance / creditsPerSms) : null;

  const lastReloadDate = (() => {
    const positive = transactions.filter((t) => t.amount > 0);
    if (positive.length === 0) return null;
    // transactions are sorted newest-first from the API
    return positive[0].created_at;
  })();

  const isLowBalance =
    balance !== null && balance < lowBalanceThreshold && balance >= 0;

  /* ---------------------------------------------------------------- */
  /*  RENDER                                                          */
  /* ---------------------------------------------------------------- */

  return (
    <PortalLayout>
      <h1 className="text-3xl font-bold font-serif text-text mb-8">
        SMS Credits
      </h1>

      {/* Toast */}
      {toast && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg text-sm border ${
            toast.type === "success"
              ? "bg-success/10 border-success/30 text-success"
              : toast.type === "error"
                ? "bg-error/10 border-error/30 text-error"
                : "bg-gold/10 border-gold/30 text-gold"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Trial Banner */}
      {!loading && accountStatus === "trial" && (
        <div className="mb-6 px-4 py-3 rounded-lg text-sm border bg-gold/10 border-gold/30 text-gold flex items-start gap-3">
          <InfoIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>
            You&apos;re on a free trial &mdash; 20 complimentary credits
            included. Upgrade anytime to run full campaigns.
          </span>
        </div>
      )}

      {/* Low Balance Amber Banner */}
      {!loading && isLowBalance && (
        <div className="mb-6 px-4 py-3 rounded-lg text-sm border bg-yellow-500/10 border-yellow-500/30 text-yellow-400 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <WarningIcon className="w-5 h-5 flex-shrink-0" />
            <span>
              SMS credits are low. Reload credits to keep your campaigns
              running.
            </span>
          </div>
          <button
            onClick={() => setReloadModalOpen(true)}
            className="flex-shrink-0 bg-gold text-black font-semibold text-sm px-4 py-1.5 rounded-lg hover:bg-gold/90 transition-colors"
          >
            Reload Credits
          </button>
        </div>
      )}

      {/* ---- Balance Card ---- */}
      <div className="bg-card rounded-xl border border-border p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="text-sm text-text-muted mb-1">Current Balance</p>
            {loading ? (
              <div className="h-14 w-32 bg-border rounded animate-pulse" />
            ) : (
              <p className={`text-5xl font-bold ${balanceColor}`}>
                {balance?.toLocaleString()}
              </p>
            )}
            <p className="text-sm text-text-muted mt-2">SMS credits</p>

            {!loading && balance !== null && (
              <div className="flex flex-wrap gap-4 mt-3">
                <span className="text-xs text-text-muted">
                  ~{estimatedSms?.toLocaleString()} SMS remaining
                </span>
                {lastReloadDate && (
                  <span className="text-xs text-text-muted">
                    Last reload: {formatDate(lastReloadDate)}
                  </span>
                )}
                {projectedDays !== null && avgDailyUsage > 0 && (
                  <span className="text-xs text-text-muted">
                    ~{projectedDays} days at {avgDailyUsage}/day avg
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-3">
            <button
              onClick={() => setReloadModalOpen(true)}
              className="bg-gold text-black font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-gold/90 transition-colors"
            >
              Reload Credits
            </button>
          </div>
        </div>
      </div>

      {/* ---- Credit Packages ---- */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold font-serif text-text mb-4">
          Credit Packages
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className={`bg-card rounded-xl border p-6 flex flex-col items-center text-center relative ${
                pkg.badge
                  ? "border-gold shadow-lg shadow-gold/10"
                  : "border-border"
              }`}
            >
              {pkg.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold text-black bg-gold px-3 py-1 rounded-full whitespace-nowrap">
                  {pkg.badge}
                </span>
              )}
              <p className="text-lg font-semibold text-text mt-1">
                {pkg.name}
              </p>
              <p className="text-3xl font-bold text-gold mt-2">
                ${pkg.price}
              </p>
              <p className="text-sm text-text-muted mt-1">
                {pkg.credits.toLocaleString()} credits
              </p>
              <p className="text-xs text-text-muted mt-1">
                {pkg.costPerCredit} per credit
              </p>
              <button
                onClick={() => handleBuyCredits(pkg.id)}
                disabled={purchasing !== null}
                className={`mt-4 w-full px-4 py-2.5 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm ${
                  pkg.badge
                    ? "bg-gold text-black hover:bg-gold/90"
                    : "bg-white/10 text-text hover:bg-white/15"
                }`}
              >
                {purchasing === pkg.id ? "Redirecting..." : "Buy Now"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Auto-Reload Section ---- */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold font-serif text-text mb-4">
          Auto-Reload
        </h2>
        <div className="bg-card rounded-xl border border-border p-6">
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-40 bg-border rounded" />
              <div className="h-10 w-full bg-border rounded" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text">
                    Automatic Credit Reload
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Automatically purchase credits when your balance drops below
                    a threshold
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleAutoReloadUpdate({
                      enabled: !autoReload?.enabled,
                    })
                  }
                  disabled={savingAutoReload}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    autoReload?.enabled ? "bg-gold" : "bg-border"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoReload?.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {autoReload?.enabled && (
                <>
                  {/* Threshold */}
                  <div>
                    <p className="text-xs text-text-muted mb-2">
                      Reload when credits drop below:
                    </p>
                    <div className="flex gap-2">
                      {THRESHOLD_OPTIONS.map((t) => (
                        <button
                          key={t}
                          onClick={() =>
                            handleAutoReloadUpdate({ threshold: t })
                          }
                          disabled={savingAutoReload}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            autoReload.threshold === t
                              ? "bg-gold text-black"
                              : "bg-white/5 text-text-muted hover:bg-white/10"
                          }`}
                        >
                          {t} credits
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bundle selector */}
                  <div>
                    <p className="text-xs text-text-muted mb-2">
                      Package to auto-purchase:
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {PACKAGES.map((pkg) => (
                        <button
                          key={pkg.id}
                          onClick={() =>
                            handleAutoReloadUpdate({ bundle_type: pkg.id })
                          }
                          disabled={savingAutoReload}
                          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                            autoReload.bundle_type === pkg.id
                              ? "bg-gold text-black font-medium"
                              : "bg-white/5 text-text-muted hover:bg-white/10"
                          }`}
                        >
                          {pkg.name} (${pkg.price} /{" "}
                          {pkg.credits.toLocaleString()} credits)
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Saved payment method */}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div>
                      <p className="text-xs text-text-muted">
                        Saved Payment Method
                      </p>
                      {autoReload.stripe_payment_method_id ? (
                        <p className="text-sm text-text mt-0.5">
                          Card ending in ****{" "}
                          <span className="text-text-muted">(saved)</span>
                        </p>
                      ) : (
                        <p className="text-sm text-error mt-0.5">
                          No payment method saved &mdash; auto-reload will not
                          fire
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() =>
                        showToast(
                          "To save a payment method, complete a manual credit purchase first. Your card will be saved for future auto-reloads.",
                          "info",
                        )
                      }
                      className="text-xs text-gold hover:text-gold/80 transition-colors"
                    >
                      {autoReload.stripe_payment_method_id
                        ? "Update card"
                        : "Add card"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---- Transaction History ---- */}
      <div>
        <h2 className="text-xl font-semibold font-serif text-text mb-4">
          Transaction History
        </h2>
        {loading ? (
          <div className="bg-card rounded-xl border border-border p-6 animate-pulse">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 w-1/4 bg-border rounded" />
                  <div className="h-4 w-1/6 bg-border rounded" />
                  <div className="h-4 w-1/4 bg-border rounded" />
                  <div className="h-4 w-1/12 bg-border rounded" />
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
                      Description
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Credits
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Cost/Credit
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Bundle
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Balance
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
                      <td className="px-4 py-3 text-sm text-text-muted max-w-xs truncate">
                        {txn.description || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {txn.amount !== 0 ? (
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
                        ) : (
                          <span className="text-text-muted">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {txn.cost_per_credit
                          ? `$${Number(txn.cost_per_credit).toFixed(4)}`
                          : "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap capitalize">
                        {txn.bundle_type || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {txn.running_balance?.toLocaleString() ?? "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ---- Reload Credits Modal ---- */}
      {reloadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReloadModalOpen(false);
          }}
        >
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold font-serif text-text">
                Reload Credits
              </h3>
              <button
                onClick={() => setReloadModalOpen(false)}
                className="text-text-muted hover:text-text transition-colors"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Package radio selection */}
            <div className="space-y-3 mb-6">
              {PACKAGES.map((pkg) => (
                <label
                  key={pkg.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedPackage === pkg.id
                      ? "border-gold bg-gold/5"
                      : "border-border hover:border-border/80 bg-bg"
                  }`}
                >
                  <input
                    type="radio"
                    name="package"
                    value={pkg.id}
                    checked={selectedPackage === pkg.id}
                    onChange={() => setSelectedPackage(pkg.id)}
                    className="accent-[var(--gold)] w-4 h-4 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text">
                        {pkg.name}
                      </span>
                      {pkg.badge && (
                        <span className="text-[10px] font-bold text-black bg-gold px-2 py-0.5 rounded-full">
                          {pkg.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-text-muted">
                      {pkg.costPerCredit} per credit
                    </span>
                  </div>
                  <span className="text-lg font-bold text-gold flex-shrink-0">
                    ${pkg.price}
                  </span>
                </label>
              ))}
            </div>

            {/* Pay button */}
            <button
              onClick={() => {
                setReloadModalOpen(false);
                handleBuyCredits(selectedPackage);
              }}
              disabled={purchasing !== null}
              className="w-full bg-gold text-black font-semibold text-sm py-3 rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {purchasing ? "Redirecting..." : "Pay with Stripe"}
            </button>

            <p className="text-xs text-text-muted text-center mt-3">
              You will be redirected to Stripe Checkout to complete your
              purchase.
            </p>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18 18 6M6 6l12 12"
      />
    </svg>
  );
}
