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

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/analytics");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <PortalLayout>
        <h1 className="text-3xl font-bold font-serif text-text mb-8">
          Analytics
        </h1>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-card rounded-xl border border-border p-6 h-80 animate-pulse"
            >
              <div className="h-4 w-32 bg-border rounded mb-4" />
              <div className="h-60 bg-border/30 rounded" />
            </div>
          ))}
        </div>
      </PortalLayout>
    );
  }

  if (!data) {
    return (
      <PortalLayout>
        <h1 className="text-3xl font-bold font-serif text-text mb-8">
          Analytics
        </h1>
        <p className="text-text-muted">Failed to load analytics data.</p>
      </PortalLayout>
    );
  }

  const monthDiff = data.leadsLastMonth > 0
    ? Math.round(((data.leadsThisMonth - data.leadsLastMonth) / data.leadsLastMonth) * 100)
    : data.leadsThisMonth > 0 ? 100 : 0;

  const totalSms = data.smsSent + data.smsFailed;
  const deliveryRate = totalSms > 0 ? Math.round((data.smsSent / totalSms) * 100) : 0;

  // Chart options
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

  // Leads over time data
  const timeLabels = Object.keys(data.leadsOverTime).map((d) => {
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
  const timeValues = Object.values(data.leadsOverTime);

  // Source data
  const sourceLabels = Object.keys(data.bySource);
  const sourceValues = Object.values(data.bySource);

  // Artist data
  const artistLabels = Object.keys(data.byArtist);
  const artistValues = Object.values(data.byArtist);

  return (
    <PortalLayout>
      <h1 className="text-3xl font-bold font-serif text-text mb-8">
        Analytics
      </h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Leads This Month"
          value={data.leadsThisMonth}
          sub={`${monthDiff >= 0 ? "+" : ""}${monthDiff}% vs last month`}
          color="text-gold"
        />
        <StatCard
          label="Leads Last Month"
          value={data.leadsLastMonth}
          color="text-text"
        />
        <StatCard
          label="SMS Delivery Rate"
          value={`${deliveryRate}%`}
          sub={`${data.smsSent} sent / ${data.smsFailed} failed`}
          color={deliveryRate >= 80 ? "text-success" : "text-error"}
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
        {/* Leads over last 30 days */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">
            Leads — Last 30 Days
          </h3>
          <div className="h-64">
            <Line
              data={{
                labels: timeLabels,
                datasets: [
                  {
                    label: "Leads",
                    data: timeValues,
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

        {/* Leads by source */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">
            Leads by Source
          </h3>
          <div className="h-64">
            {sourceLabels.length > 0 ? (
              <Pie
                data={{
                  labels: sourceLabels,
                  datasets: [
                    {
                      data: sourceValues,
                      backgroundColor: CHART_COLORS.slice(0, sourceLabels.length),
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

        {/* Leads by artist */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">
            Leads by Artist
          </h3>
          <div className="h-64">
            {artistLabels.length > 0 ? (
              <Bar
                data={{
                  labels: artistLabels,
                  datasets: [
                    {
                      label: "Leads",
                      data: artistValues,
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

        {/* SMS Delivery */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">
            SMS Delivery
          </h3>
          <div className="h-64">
            {totalSms > 0 ? (
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
    </PortalLayout>
  );
}
