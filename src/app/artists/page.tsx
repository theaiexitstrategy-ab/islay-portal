"use client";

import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import type { Artist } from "@/types/database";

/* ------------------------------------------------------------------ */
/*  Skeleton loader                                                    */
/* ------------------------------------------------------------------ */

function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-card rounded-xl border border-border p-6 animate-pulse space-y-4"
        >
          <div className="h-6 w-2/3 bg-border rounded" />
          <div className="h-4 w-1/3 bg-border rounded" />
          <div className="h-4 w-1/2 bg-border rounded" />
          <div className="flex gap-4 mt-4">
            <div className="h-10 flex-1 bg-border rounded" />
            <div className="h-10 flex-1 bg-border rounded" />
            <div className="h-10 flex-1 bg-border rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Artist card                                                        */
/* ------------------------------------------------------------------ */

function ArtistCard({ artist }: { artist: Artist }) {
  const conversionRate =
    artist.total_leads > 0
      ? ((artist.total_bookings / artist.total_leads) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="bg-card rounded-xl border border-border p-6 flex flex-col gap-4">
      {/* Name + active indicator */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-text">{artist.name || "\u2014"}</h3>
          <p className="text-sm text-text-muted mt-0.5">{artist.role || "\u2014"}</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              artist.active ? "bg-green-500" : "bg-gray-500"
            }`}
          />
          <span className="text-xs text-text-muted">
            {artist.active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      {/* Booking platform */}
      <div>
        {artist.booking_url ? (
          <a
            href={artist.booking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gold hover:text-gold/80 underline underline-offset-2 transition-colors"
          >
            {artist.booking_platform || "Booking Link"}
          </a>
        ) : artist.booking_platform ? (
          <p className="text-sm text-text-muted">{artist.booking_platform}</p>
        ) : null}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mt-auto pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-lg font-bold text-text">{artist.total_leads}</p>
          <p className="text-xs text-text-muted">Leads</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-text">{artist.total_bookings}</p>
          <p className="text-xs text-text-muted">Bookings</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gold">{conversionRate}%</p>
          <p className="text-xs text-text-muted">Conversion</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchArtists() {
      try {
        const res = await fetch("/api/artists");
        const data = await res.json();
        setArtists(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch artists:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchArtists();
  }, []);

  return (
    <PortalLayout>
      <h1 className="text-3xl font-bold font-serif text-text mb-8">Artists</h1>

      {loading ? (
        <SkeletonCards />
      ) : artists.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <p className="text-text-muted">No artists found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {artists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
