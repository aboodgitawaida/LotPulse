import { useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { ActivityFeed } from "@/components/activity-feed";
import { AppHeader, MobileNav, type View } from "@/components/app-header";
import { BrandMark } from "@/components/brand-mark";
import { CampusMap } from "@/components/campus-map";
import { CloutView } from "@/components/clout-view";
import { FocusLot } from "@/components/focus-lot";
import { Hero } from "@/components/hero";
import { Leaderboard } from "@/components/leaderboard";
import { DeleteDataDialog, ReportDialog } from "@/components/lot-dialogs";
import { LotSwitcher } from "@/components/lot-switcher";
import { ReportButton } from "@/components/report-button";
import { Ticker } from "@/components/ticker";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { POINTS_PER_REPORT } from "@/lib/community";
import { LOTS, TONE_LABEL, getLot, type LotId, type Tone } from "@/lib/lots";
import { canonical } from "@/lib/site";
import { trackSpotlight } from "@/lib/spotlight";
import { useMediaQuery } from "@/lib/use-media-query";
import { StoreProvider, useStore } from "@/lib/store";

interface DashboardSearch {
  view?: "clout";
}

export const Route = createFileRoute("/")({
  head: () => ({ links: canonical("/") }),
  validateSearch: (search: Record<string, unknown>): DashboardSearch =>
    search["view"] === "clout" ? { view: "clout" } : {},
  // Everything on this page depends on the visitor's clock and saved progress,
  // so render it in the browser and show a skeleton during SSR.
  ssr: false,
  pendingComponent: DashboardSkeleton,
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <StoreProvider>
      <Dashboard />
    </StoreProvider>
  );
}

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 5) return ["Late night,", "scout."];
  if (hour < 12) return ["Good morning,", "scout."];
  if (hour < 18) return ["Good afternoon,", "scout."];
  return ["Good evening,", "scout."];
}

function Dashboard() {
  const search = Route.useSearch();
  const view: View = search.view ?? "radar";
  const navigate = useNavigate({ from: "/" });
  const store = useStore();
  // Phones get the map from the bottom nav instead (matches .desktop-only in
  // styles.css), so they skip loading Leaflet and tiles for a hidden map.
  const showInlineMap = useMediaQuery("(min-width: 681px)");
  const [dialog, setDialog] = useState<"report" | "map" | "delete" | null>(null);
  const [sending, setSending] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const live = store.mode === "live";
  // Only claim a lot is clear once reports have actually loaded.
  const known = live && !store.loading && !store.unreachable;
  const unknownReason = !live
    ? "Not connected to live reports"
    : store.unreachable
      ? "Can't reach live reports right now"
      : "Checking for reports…";

  const lot = getLot(store.selected);
  const status = store.statusFor(lot.id);
  const { statusFor } = store;
  const tones = useMemo(
    () =>
      Object.fromEntries(
        LOTS.map((item) => [item.id, known ? statusFor(item.id).tone : "unknown"]),
      ) as Record<LotId, Tone | "unknown">,
    [statusFor, known],
  );

  const selectLot = (id: LotId) => {
    store.select(id);
    setDialog((current) => (current === "map" ? null : current));
    if (view !== "radar") void navigate({ search: {} });
  };

  const confirmReport = async (scoutName?: string, captchaToken?: string) => {
    setSending(true);
    setReportError(null);
    try {
      await store.report(lot.id, scoutName, captchaToken);
      setDialog(null);
      toast.success(`Report sent for ${lot.name}`, {
        description: `Everyone on LotPulse can see it now. +${POINTS_PER_REPORT} clout.`,
        duration: 6000,
      });
    } catch (error) {
      // Keep the dialog open so the reason sits next to the button.
      setReportError(error instanceof Error ? error.message : "Couldn't send the report.");
    } finally {
      setSending(false);
    }
  };

  const confirmDelete = async () => {
    setSending(true);
    setReportError(null);
    try {
      await store.deleteMyData();
      setDialog(null);
      toast.success("Your data was deleted", {
        description: "Your scout name, reports and clout are gone for good.",
        duration: 6000,
      });
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Couldn't delete your data.");
    } finally {
      setSending(false);
    }
  };

  const weekday = store.now.toLocaleDateString("en-CA", { weekday: "long" });
  const statuses = LOTS.map((item) => ({ lot: item, status: statusFor(item.id) }));
  const hottest = statuses.reduce((top, item) =>
    item.status.recentReports > top.status.recentReports ? item : top,
  );
  const spottedCount = statuses.filter((item) => item.status.spotted).length;
  const tickerItems = [
    { label: live ? "Live scout network" : "Not connected" },
    ...statuses.map(({ lot: item, status: itemStatus }) =>
      known
        ? {
            label: `${item.short} · ${TONE_LABEL[itemStatus.tone]}${itemStatus.recentReports > 0 ? ` · ${itemStatus.recentReports} in 2h` : ""}`,
            tone: itemStatus.tone,
          }
        : { label: `${item.short} · –` },
    ),
    { label: "Report it, earn clout" },
  ];

  return (
    <div className="app" onPointerMove={trackSpotlight}>
      <div className="scroll-progress" aria-hidden />
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <AppHeader view={view} points={store.points} />

      <main id="main" className="page" data-view={view}>
        {view === "radar" ? (
          <>
            <Hero
              eyebrow="University of Toronto Mississauga"
              lines={greeting(store.now)}
              subtitle={
                <>
                  Live enforcement reports from students this {weekday}. Pick a lot, check the
                  latest report, warn the campus.
                </>
              }
              aside={
                <>
                  <span className="demo-chip" data-live={known}>
                    {!live ? "Not connected" : store.unreachable ? "Reconnecting…" : "Live reports"}
                  </span>
                  <button
                    type="button"
                    className="hero-stat"
                    data-tone={known ? hottest.status.tone : undefined}
                    onClick={() => selectLot(hottest.lot.id)}
                  >
                    <span className="hero-stat-value">
                      {known ? hottest.status.recentReports : "–"}
                      <small>/2h</small>
                    </span>
                    <span className="hero-stat-label">
                      {!known ? (
                        <>
                          Lot status · <strong>unknown</strong>
                          <span>{unknownReason}</span>
                        </>
                      ) : spottedCount === 0 ? (
                        <>
                          No recent reports · <strong>all lots clear</strong>
                        </>
                      ) : (
                        <>
                          Most reported · <strong>{hottest.lot.name}</strong>
                        </>
                      )}
                      {known && (
                        <span>
                          {spottedCount === 0
                            ? "Nothing in the last 2 hours"
                            : `${spottedCount} ${spottedCount === 1 ? "lot" : "lots"} reported in the last 2 hours`}
                        </span>
                      )}
                    </span>
                  </button>
                </>
              }
            />

            <Ticker items={tickerItems} />

            {live && store.unreachable && (
              <p className="connection-banner" role="status">
                Can't reach live reports right now, so lot statuses are unknown. Retrying
                automatically.
              </p>
            )}

            <LotSwitcher
              selected={lot.id}
              statusFor={store.statusFor}
              onSelect={selectLot}
              known={known}
            />

            <div className="dashboard-grid">
              <div className="dashboard-main">
                <FocusLot
                  lot={lot}
                  status={status}
                  now={store.now}
                  live={live}
                  known={known}
                  unknownReason={unknownReason}
                />
                <ReportButton
                  lot={lot}
                  cooldownMinutes={status.cooldownMinutes}
                  onReport={() => setDialog("report")}
                />
              </div>
              <aside className="dashboard-side" aria-label="Campus overview">
                {showInlineMap && (
                  <div className="desktop-only">
                    <CampusMap
                      selected={lot.id}
                      tones={tones}
                      onSelect={selectLot}
                      onExpand={() => setDialog("map")}
                    />
                  </div>
                )}
                <ActivityFeed
                  sightings={store.sightings}
                  now={store.now}
                  onSelect={selectLot}
                  live={live}
                  loading={store.loading}
                  unreachable={store.unreachable}
                />
                <Leaderboard rows={store.leaderboard} unavailable={store.unreachable} />
              </aside>
            </div>
          </>
        ) : (
          <>
            <Hero
              eyebrow="Clout system"
              lines={["Good scouts", "get clout."]}
              subtitle="Every report helps a classmate dodge a ticket."
            />
            <CloutView
              points={store.points}
              rank={store.rank}
              reports={store.reports}
              badges={store.badges}
              leaderboard={store.leaderboard}
              unavailable={store.unreachable}
              onDeleteData={
                store.scoutName
                  ? () => {
                      setReportError(null);
                      setDialog("delete");
                    }
                  : undefined
              }
            />
          </>
        )}

        <footer className="page-footer">
          <p className="footer-wordmark" aria-hidden>
            Lot<em>Pulse</em>
          </p>
          <div className="footer-row">
            <span className="footer-brand">
              <BrandMark className="footer-mark" /> LotPulse · for students, by students
            </span>
            <span>
              Scout reports are crowd-sourced and unverified. Not affiliated with UTM. Always follow
              posted parking rules. <Link to="/privacy">Privacy</Link>
            </span>
          </div>
        </footer>
      </main>

      <MobileNav view={view} onOpenMap={() => setDialog("map")} />

      <ReportDialog
        lot={lot}
        live={live}
        needsName={store.needsName}
        busy={sending}
        error={reportError}
        open={dialog === "report"}
        onOpenChange={(open) => {
          setReportError(null);
          setDialog(open ? "report" : null);
        }}
        onConfirm={confirmReport}
      />
      {store.scoutName && (
        <DeleteDataDialog
          scoutName={store.scoutName}
          reports={store.reports.length}
          busy={sending}
          error={reportError}
          open={dialog === "delete"}
          onOpenChange={(open) => {
            setReportError(null);
            setDialog(open ? "delete" : null);
          }}
          onConfirm={() => void confirmDelete()}
        />
      )}
      <Dialog open={dialog === "map"} onOpenChange={(open) => setDialog(open ? "map" : null)}>
        <DialogContent className="map-dialog">
          <DialogTitle className="lp-dialog-title">Campus radar</DialogTitle>
          <DialogDescription className="lp-dialog-body">
            Tap a pin to switch lots. Pin colour shows reports in the last 2 hours.
          </DialogDescription>
          <CampusMap selected={lot.id} tones={tones} onSelect={selectLot} expanded />
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="app" aria-busy="true">
      <header className="topbar">
        <span className="brand">
          <BrandMark className="brand-mark" />
          <span className="brand-word">
            Lot<span>Pulse</span>
          </span>
        </span>
      </header>
      <main className="page">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-chips" />
        <div className="dashboard-grid">
          <div className="dashboard-main">
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-cta" />
          </div>
          <div className="dashboard-side">
            <div className="skeleton skeleton-card" />
          </div>
        </div>
        <span className="sr-only">Loading LotPulse…</span>
      </main>
    </div>
  );
}
