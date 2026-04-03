"use client";

import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar, Pie } from "react-chartjs-2";
import type { SocialAccount } from "@/types/database";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
);

interface AnalyticsData {
  leadsThisMonth: number;
  leadsLastMonth: number;
  bySource: Record<string, number>;
  byArtist: Record<string, number>;
  smsSent: number;
  smsFailed: number;
  leadsOverTime: Record<string, number>;
  creditsSpent: number;
}

type SocialTab = "portal" | "instagram" | "tiktok" | "google";

const CHART_COLORS = [
  "#c9a84c",
  "#3b82f6",
  "#22c55e",
  "#ef4444",
  "#a855f7",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
];

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <p className="text-sm text-text-muted mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color || "text-text"}`}>{value}</p>
      {sub && <p className="text-sm text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

function ConnectPlaceholder({ platform, onConnect }: { platform: string; onConnect: () => void }) {
  return (
    <div className="bg-card rounded-xl border border-border p-8 text-center">
      <p className="text-text-muted mb-4">
        Connect your {platform} account to view analytics.
      </p>
      <button
        onClick={onConnect}
        className="px-6 py-2.5 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold/90 transition-colors"
      >
        Connect {platform}
      </button>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SocialTab>("portal");
  const [dateRange, setDateRange] = useState("30");

  useEffect(() => {
    async function fetchAll() {
      try {
        const [analyticsRes, socialRes] = await Promise.all([
          fetch("/api/analytics"),
          fetch("/api/social-accounts"),
        ]);
        const analyticsJson = await analyticsRes.json();
        const socialJson = await socialRes.json();
        setData(analyticsJson);
        setSocialAccounts(Array.isArray(socialJson) ? socialJson : []);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const getAccount = (platform: string) =>
    socialAccounts.find((a) => a.platform === platform);

  const isConnected = (platform: string) => !!getAccount(platform);

  const tabs: { id: SocialTab; label: string }[] = [
    { id: "portal", label: "Portal Analytics" },
    { id: "instagram", label: "Instagram / Facebook" },
    { id: "tiktok", label: "TikTok" },
    { id: "google", label: "Google Analytics" },
  ];

  if (loading) {
    return (
      <PortalLayout>
        <h1 className="text-3xl font-bold font-serif text-text mb-8">Analytics</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-card rounded-xl border border-border p-6 animate-pulse"
            >
              <div className="h-4 w-24 bg-border rounded mb-2" />
              <div className="h-8 w-16 bg-border rounded" />
            </div>
          ))}
        </div>
      </PortalLayout>
    );
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: "#888888", font: { size: 12 } },
      },
    },
    scales: {
      x: {
        ticks: { color: "#888888", font: { size: 11 } },
        grid: { color: "#222222" },
      },
      y: {
        ticks: { color: "#888888", font: { size: 11 } },
        grid: { color: "#222222" },
        beginAtZero: true,
      },
    },
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { color: "#888888", font: { size: 12 }, padding: 16 },
      },
    },
  };

  return (
    <PortalLayout>
      <h1 className="text-3xl font-bold font-serif text-text mb-8">Analytics</h1>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-8 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
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

      {/* Portal Analytics Tab */}
      {activeTab === "portal" && data && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Leads This Month"
              value={data.leadsThisMonth}
              sub={(() => {
                const diff = data.leadsLastMonth > 0
                  ? Math.round(((data.leadsThisMonth - data.leadsLastMonth) / data.leadsLastMonth) * 100)
                  : data.leadsThisMonth > 0 ? 100 : 0;
                return `${diff >= 0 ? "+" : ""}${diff}% vs last month`;
              })()}
              color="text-gold"
            />
            <StatCard label="Leads Last Month" value={data.leadsLastMonth} />
            <StatCard
              label="SMS Delivery Rate"
              value={`${data.smsSent + data.smsFailed > 0 ? Math.round((data.smsSent / (data.smsSent + data.smsFailed)) * 100) : 0}%`}
              sub={`${data.smsSent} sent / ${data.smsFailed} failed`}
              color={data.smsSent / (data.smsSent + data.smsFailed || 1) >= 0.8 ? "text-success" : "text-error"}
            />
            <StatCard
              label="Credits Spent This Month"
              value={data.creditsSpent}
              sub="SMS credits used"
              color="text-gold"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">
                Leads — Last 30 Days
              </h3>
              <div className="h-64">
                <Line
                  data={{
                    labels: Object.keys(data.leadsOverTime).map((d) =>
                      new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                    ),
                    datasets: [
                      {
                        label: "Leads",
                        data: Object.values(data.leadsOverTime),
                        borderColor: "#c9a84c",
                        backgroundColor: "rgba(201, 168, 76, 0.1)",
                        fill: true,
                        tension: 0.3,
                        pointRadius: 2,
                        pointHoverRadius: 5,
                      },
                    ],
                  }}
                  options={chartOptions}
                />
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">
                Leads by Source
              </h3>
              <div className="h-64">
                {Object.keys(data.bySource).length > 0 ? (
                  <Pie
                    data={{
                      labels: Object.keys(data.bySource),
                      datasets: [
                        {
                          data: Object.values(data.bySource),
                          backgroundColor: CHART_COLORS.slice(0, Object.keys(data.bySource).length),
                          borderColor: "#111111",
                          borderWidth: 2,
                        },
                      ],
                    }}
                    options={pieOptions}
                  />
                ) : (
                  <p className="text-text-muted text-sm flex items-center justify-center h-full">
                    No source data available
                  </p>
                )}
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">
                Leads by Artist
              </h3>
              <div className="h-64">
                {Object.keys(data.byArtist).length > 0 ? (
                  <Bar
                    data={{
                      labels: Object.keys(data.byArtist),
                      datasets: [
                        {
                          label: "Leads",
                          data: Object.values(data.byArtist),
                          backgroundColor: "#c9a84c",
                          borderRadius: 4,
                        },
                      ],
                    }}
                    options={chartOptions}
                  />
                ) : (
                  <p className="text-text-muted text-sm flex items-center justify-center h-full">
                    No artist data available
                  </p>
                )}
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">
                SMS Delivery
              </h3>
              <div className="h-64">
                {data.smsSent + data.smsFailed > 0 ? (
                  <Pie
                    data={{
                      labels: ["Sent", "Failed"],
                      datasets: [
                        {
                          data: [data.smsSent, data.smsFailed],
                          backgroundColor: ["#22c55e", "#ef4444"],
                          borderColor: "#111111",
                          borderWidth: 2,
                        },
                      ],
                    }}
                    options={pieOptions}
                  />
                ) : (
                  <p className="text-text-muted text-sm flex items-center justify-center h-full">
                    No SMS data available
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "portal" && !data && (
        <p className="text-text-muted">Failed to load analytics data.</p>
      )}

      {/* Instagram / Facebook Tab */}
      {activeTab === "instagram" && (
        <>
          {!isConnected("instagram") ? (
            <ConnectPlaceholder
              platform="Instagram"
              onConnect={() => (window.location.href = "/settings")}
            />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  label="Followers"
                  value={getAccount("instagram")?.follower_count?.toLocaleString() || "0"}
                  color="text-pink-400"
                />
                <StatCard
                  label="Platform"
                  value="Instagram"
                  sub={`@${getAccount("instagram")?.handle || "connected"}`}
                  color="text-pink-400"
                />
                <StatCard
                  label="Last Synced"
                  value={
                    getAccount("instagram")?.last_synced
                      ? new Date(getAccount("instagram")!.last_synced!).toLocaleDateString()
                      : "Never"
                  }
                  color="text-text-muted"
                />
              </div>

              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">
                  Follower Growth
                </h3>
                <div className="h-64">
                  <Line
                    data={{
                      labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
                      datasets: [
                        {
                          label: "Followers",
                          data: [
                            getAccount("instagram")?.follower_count || 0,
                            getAccount("instagram")?.follower_count || 0,
                            getAccount("instagram")?.follower_count || 0,
                            getAccount("instagram")?.follower_count || 0,
                          ],
                          borderColor: "#ec4899",
                          backgroundColor: "rgba(236, 72, 153, 0.1)",
                          fill: true,
                          tension: 0.3,
                        },
                      ],
                    }}
                    options={chartOptions}
                  />
                </div>
                <p className="text-xs text-text-muted mt-2">
                  Historical data will populate as the platform syncs over time.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* TikTok Tab */}
      {activeTab === "tiktok" && (
        <>
          {!isConnected("tiktok") ? (
            <ConnectPlaceholder
              platform="TikTok"
              onConnect={() => (window.location.href = "/settings")}
            />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  label="Followers"
                  value={getAccount("tiktok")?.follower_count?.toLocaleString() || "0"}
                  color="text-cyan-300"
                />
                <StatCard
                  label="Platform"
                  value="TikTok"
                  sub={`@${getAccount("tiktok")?.handle || "connected"}`}
                  color="text-cyan-300"
                />
                <StatCard
                  label="Last Synced"
                  value={
                    getAccount("tiktok")?.last_synced
                      ? new Date(getAccount("tiktok")!.last_synced!).toLocaleDateString()
                      : "Never"
                  }
                  color="text-text-muted"
                />
              </div>

              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">
                  Video Performance
                </h3>
                <div className="h-64">
                  <Bar
                    data={{
                      labels: ["Views", "Likes", "Shares"],
                      datasets: [
                        {
                          label: "Total",
                          data: [0, 0, 0],
                          backgroundColor: ["#06b6d4", "#c9a84c", "#22c55e"],
                          borderRadius: 4,
                        },
                      ],
                    }}
                    options={chartOptions}
                  />
                </div>
                <p className="text-xs text-text-muted mt-2">
                  Video stats will populate once the TikTok API syncs data.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Google Analytics Tab */}
      {activeTab === "google" && (
        <>
          {!isConnected("google") ? (
            <ConnectPlaceholder
              platform="Google Analytics"
              onConnect={() => (window.location.href = "/settings")}
            />
          ) : (
            <div className="space-y-6">
              {/* Date Range Selector */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Date Range:
                </span>
                {["7", "30", "90"].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDateRange(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      dateRange === d
                        ? "bg-gold text-black"
                        : "bg-white/5 text-text-muted hover:bg-white/10"
                    }`}
                  >
                    {d} Days
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <StatCard label="Sessions" value="--" sub={`Last ${dateRange} days`} color="text-yellow-400" />
                <StatCard label="Users" value="--" color="text-yellow-400" />
                <StatCard label="Bounce Rate" value="--" color="text-text-muted" />
                <StatCard
                  label="GA4 Property"
                  value={getAccount("google")?.ga_property_id || "Not set"}
                  color="text-text-muted"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">
                    Sessions Over Time
                  </h3>
                  <div className="h-64">
                    <Line
                      data={{
                        labels: Array.from({ length: 7 }, (_, i) => `Day ${i + 1}`),
                        datasets: [
                          {
                            label: "Sessions",
                            data: [0, 0, 0, 0, 0, 0, 0],
                            borderColor: "#f59e0b",
                            backgroundColor: "rgba(245, 158, 11, 0.1)",
                            fill: true,
                            tension: 0.3,
                          },
                        ],
                      }}
                      options={chartOptions}
                    />
                  </div>
                  <p className="text-xs text-text-muted mt-2">
                    {getAccount("google")?.ga_property_id
                      ? "Data will populate once GA4 API syncs."
                      : "Enter your GA4 Property ID in Settings to enable analytics."}
                  </p>
                </div>

                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">
                    Traffic Sources
                  </h3>
                  <div className="h-64">
                    <Pie
                      data={{
                        labels: ["Direct", "Organic", "Social", "Referral"],
                        datasets: [
                          {
                            data: [0, 0, 0, 0],
                            backgroundColor: ["#c9a84c", "#22c55e", "#3b82f6", "#a855f7"],
                            borderColor: "#111111",
                            borderWidth: 2,
                          },
                        ],
                      }}
                      options={pieOptions}
                    />
                  </div>
                  <p className="text-xs text-text-muted mt-2">
                    Traffic source data will populate from GA4 Data API.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </PortalLayout>
  );
}
