"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import PortalLayout from "@/components/PortalLayout";
import type { Lead, Artist } from "@/types/database";
import Link from "next/link";

interface DashboardStats {
  totalLeads: number;
  newThisWeek: number;
  promoClaims: number;
  bookingsConfirmed: number;
}

interface ArtistPerformance {
  name: string;
  totalLeads: number;
  totalBookings: number;
  conversionRate: string;
}

interface CreditTransaction {
  id: string;
  amount: number;
  created_at: string;
  description?: string;
}

interface CreditsData {
  balance: number;
  transactions: CreditTransaction[];
  avgDailyUsage: number;
  projectedDaysRemaining: number;
  credits_per_sms: number;
  low_balance_threshold: number;
  account_status: string;
}

const statusColors: Record<string, string> = {
  New: "bg-gold/20 text-gold",
  Contacted: "bg-blue-500/20 text-blue-400",
  Booked: "bg-success/20 text-success",
  "No Show": "bg-error/20 text-error",
  Completed: "bg-success/20 text-success",
  Cancelled: "bg-error/20 text-error",
  "Follow Up": "bg-yellow-500/20 text-yellow-400",
};

function StatCard({
  label,
  value,
  icon,
  iconColor,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconColor: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-2xl ${iconColor}`}>{icon}</span>
      </div>
      <p className="text-3xl font-bold text-text">{value}</p>
      <p className="text-sm text-text-muted mt-1">{label}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-pulse">
      <div className="h-6 w-6 bg-border rounded mb-3" />
      <div className="h-8 w-16 bg-border rounded mb-2" />
      <div className="h-4 w-24 bg-border rounded" />
    </div>
  );
}

function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-pulse">
      <div className="h-6 w-40 bg-border rounded mb-6" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 mb-4">
          <div className="h-4 w-1/4 bg-border rounded" />
          <div className="h-4 w-1/6 bg-border rounded" />
          <div className="h-4 w-1/6 bg-border rounded" />
          <div className="h-4 w-1/6 bg-border rounded" />
          <div className="h-4 w-1/8 bg-border rounded" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [artistPerformance, setArtistPerformance] = useState<ArtistPerformance[]>([]);
  const [credits, setCredits] = useState<CreditsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [dashRes, leadsRes, artistsRes, creditsRes] = await Promise.all([
          fetch("/api/dashboard"),
          fetch("/api/leads"),
          fetch("/api/artists"),
          fetch("/api/credits"),
        ]);

        const dashData = await dashRes.json();
        const leadsData = await leadsRes.json();
        const artistsData = await artistsRes.json();
        const creditsData = await creditsRes.json();

        const errors: string[] = [];
        if (!dashRes.ok) errors.push(`Dashboard API ${dashRes.status}: ${JSON.stringify(dashData)}`);
        if (!leadsRes.ok) errors.push(`Leads API ${leadsRes.status}: ${JSON.stringify(leadsData)}`);
        if (!artistsRes.ok) errors.push(`Artists API ${artistsRes.status}: ${JSON.stringify(artistsData)}`);
        if (!creditsRes.ok) errors.push(`Credits API ${creditsRes.status}: ${JSON.stringify(creditsData)}`);
        if (errors.length > 0) setApiError(errors.join(" | "));

        if (dashRes.ok) setStats(dashData);

        if (creditsRes.ok) {
          setCredits({
            balance: creditsData.balance ?? 0,
            transactions: creditsData.transactions ?? [],
            avgDailyUsage: creditsData.avgDailyUsage ?? 0,
            projectedDaysRemaining: creditsData.projectedDaysRemaining ?? 0,
            credits_per_sms: creditsData.credits_per_sms ?? 1,
            low_balance_threshold: creditsData.low_balance_threshold ?? 50,
            account_status: creditsData.account_status ?? "active",
          });
        }

        const leadsArray: Lead[] = Array.isArray(leadsData) ? leadsData : [];
        // Only show the 10 most recent on the dashboard
        setLeads(leadsArray.slice(0, 10));

        const artistsArray: Artist[] = Array.isArray(artistsData)
          ? artistsData
          : [];

        // Build artist performance
        const performance: ArtistPerformance[] = artistsArray.map((a) => ({
          name: a.name || "Unknown",
          totalLeads: a.total_leads,
          totalBookings: a.total_bookings,
          conversionRate:
            a.total_leads > 0
              ? ((a.total_bookings / a.total_leads) * 100).toFixed(1) + "%"
              : "0.0%",
        }));

        setArtistPerformance(performance);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Real-time subscription for new leads                             */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const channel = supabase
      .channel("leads-realtime")
      .on<Lead>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "leads",
          filter: "client_id=eq.islay_studios",
        },
        (payload) => {
          // Prepend the new lead to the list (keep max 10)
          setLeads((prev) => [payload.new, ...prev].slice(0, 10));
          // Increment total leads stat
          setStats((prev) =>
            prev ? { ...prev, totalLeads: prev.totalLeads + 1 } : prev,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

  // Derive credit display values
  const creditsPerSms = credits?.credits_per_sms ?? 1;
  const estimatedSmsRemaining = credits
    ? Math.floor(credits.balance / creditsPerSms)
    : 0;
  const lastReloadDate = credits
    ? (() => {
        const positiveTransactions = credits.transactions.filter(
          (t) => t.amount > 0,
        );
        if (positiveTransactions.length === 0) return null;
        // Sort descending by date and take the most recent
        const sorted = [...positiveTransactions].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        return sorted[0].created_at;
      })()
    : null;

  const isLowBalance =
    credits !== null &&
    credits.account_status !== "trial" &&
    credits.balance < (credits.low_balance_threshold ?? 50);

  const isTrial = credits?.account_status === "trial";

  return (
    <PortalLayout>
      <h1 className="text-3xl font-bold font-serif text-text mb-8">
        Dashboard
      </h1>

      {/* API Error Banner */}
      {apiError && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-error/10 border border-error/30 text-error text-sm font-mono break-all">
          <p className="font-medium mb-1">API Error:</p>
          {apiError}
        </div>
      )}

      {/* Trial Banner */}
      {!loading && isTrial && (
        <div className="mb-6 bg-gold/10 border border-gold/30 text-gold rounded-lg px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm">
            You&apos;re on a free trial &mdash; 20 complimentary credits
            included. Upgrade anytime to run full campaigns.
          </p>
          <Link
            href="/credits"
            className="px-4 py-2 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold/90 shrink-0"
          >
            Upgrade
          </Link>
        </div>
      )}

      {/* Low Balance Banner */}
      {!loading && isLowBalance && !isTrial && (
        <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm">
            SMS credits are low. Reload credits to keep your campaigns running.
          </p>
          <Link
            href="/credits"
            className="px-4 py-2 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold/90 shrink-0"
          >
            Reload Credits
          </Link>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : stats ? (
          <>
            <StatCard
              label="Total Leads"
              value={stats.totalLeads}
              icon={
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              }
              iconColor="text-gold"
            />
            <StatCard
              label="New This Week"
              value={stats.newThisWeek}
              icon={
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
              iconColor="text-success"
            />
            <StatCard
              label="Promo Claims"
              value={stats.promoClaims}
              icon={
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                  />
                </svg>
              }
              iconColor="text-gold"
            />
            <StatCard
              label="Bookings Confirmed"
              value={stats.bookingsConfirmed}
              icon={
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
              iconColor="text-success"
            />
          </>
        ) : (
          <p className="text-text-muted col-span-full">
            Failed to load stats.
          </p>
        )}
      </div>

      {/* Credits Card */}
      {!loading && credits && (
        <div className="mb-8">
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold font-serif text-text">
                SMS Credits
              </h2>
              <Link
                href="/credits"
                className="px-4 py-2 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold/90"
              >
                Reload Credits
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-text-muted mb-1">Credit Balance</p>
                <p className="text-2xl font-bold text-gold">
                  {credits.balance.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-muted mb-1">
                  Estimated SMS Remaining
                </p>
                <p className="text-2xl font-bold text-text">
                  {estimatedSmsRemaining.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-muted mb-1">Last Reload</p>
                <p className="text-2xl font-bold text-text">
                  {lastReloadDate ? formatDate(lastReloadDate) : "\u2014"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Leads */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold font-serif text-text mb-4">
          Recent Leads
        </h2>
        {loading ? (
          <SkeletonTable rows={5} />
        ) : leads.length === 0 ? (
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
                      Date
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const status = lead.lead_status || "New";
                    const badgeClass =
                      statusColors[status] || "bg-border text-text-muted";
                    return (
                      <tr
                        key={lead.id}
                        className="border-b border-border last:border-0 hover:bg-white/[0.02] transition-colors"
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
      </div>

      {/* Artist Performance */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold font-serif text-text mb-4">
          Artist Performance
        </h2>
        {loading ? (
          <SkeletonTable rows={4} />
        ) : artistPerformance.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-text-muted">No artist data available.</p>
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
                      Total Leads Assigned
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Total Bookings
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Conversion Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {artistPerformance.map((artist) => (
                    <tr
                      key={artist.name}
                      className="border-b border-border last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-text whitespace-nowrap">
                        {artist.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {artist.totalLeads}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {artist.totalBookings}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                        {artist.conversionRate}
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
