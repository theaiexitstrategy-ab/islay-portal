"use client";

import Sidebar from "./Sidebar";
import MobileSidebar from "./MobileSidebar";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <MobileSidebar />
      <main className="lg:ml-64 min-h-screen p-6 lg:p-8">{children}</main>
    </div>
  );
}
