"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export default function CreditBalanceWidget() {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    async function fetchBalance() {
      try {
        const res = await fetch("/api/credits");
        const data = await res.json();
        setBalance(data.balance ?? 0);
      } catch {
        // silently fail — widget is non-critical
      }
    }
    fetchBalance();
  }, []);

  // Realtime updates
  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const channel = supabase
      .channel("credits-widget")
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (balance === null) return null;

  const color =
    balance > 100
      ? "text-success"
      : balance >= 20
        ? "text-yellow-400"
        : "text-error";

  const bgColor =
    balance > 100
      ? "bg-success/10 border-success/20"
      : balance >= 20
        ? "bg-yellow-500/10 border-yellow-500/20"
        : "bg-error/10 border-error/20";

  return (
    <Link
      href="/credits"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:opacity-80 ${bgColor}`}
    >
      <svg
        className={`w-3.5 h-3.5 ${color}`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"
        />
      </svg>
      <span className={color}>{balance.toLocaleString()}</span>
      <span className="text-text-muted">credits</span>
    </Link>
  );
}
