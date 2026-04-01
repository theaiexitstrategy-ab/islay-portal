"use client";

import Sidebar from "./Sidebar";
import MobileSidebar from "./MobileSidebar";
import CreditBalanceWidget from "./CreditBalanceWidget";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <MobileSidebar />

      {/* Top bar with credit balance widget */}
      <div className="lg:ml-64 sticky top-0 z-30 bg-bg/80 backdrop-blur-sm border-b border-border px-6 lg:px-8 py-3 flex items-center justify-end">
        <CreditBalanceWidget />
      </div>

      <main className="lg:ml-64 min-h-[calc(100vh-52px)] p-6 lg:p-8">{children}</main>
    </div>
  );
}
