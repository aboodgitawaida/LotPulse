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
import { PaymentDialog, ReportDialog } from "@/components/lot-dialogs";
import { LotSwitcher } from "@/components/lot-switcher";
import { ReportButton } from "@/components/report-button";
import { ThreatForecast } from "@/components/threat-forecast";
import { Ticker } from "@/components/ticker";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { POINTS_PER_REPORT } from "@/lib/community";
import { LOTS, TONE_LABEL, getLot, type LotId, type Tone } from "@/lib/lots";
import { trackSpotlight } from "@/lib/spotlight";
import { StoreProvider, useStore } from "@/lib/store";

interface DashboardSearch {
  view?: "clout";
}

export const Route = createFileRoute("/")({
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
  const [dialog, setDialog] = useState<"report" | "pay" | "map" | null>(null);
  const [sending, setSending] = useState(false);
  const live = store.mode === "live";

  const lot = getLot(store.selected);
  const status = store.statusFor(lot.id);
  const { statusFor } = store;
  const tones = useMemo(
    () =>
      Object.fromEntries(LOTS.map((item) => [item.id, statusFor(item.id).tone])) as Record<
        LotId,
        Tone
      >,
    [statusFor],
  );

  const selectLot = (id: LotId) => {
    store.select(id);
    setDialog((current) => (current === "map" ? null : current));
    if (view !== "radar") void navigate({ search: {} });
  };

  const confirmReport = async (scoutName?: string) => {
    setSending(true);
    try {
      const report = await store.report(lot.id, scoutName);
      setDialog(null);
      toast.success(`Alert sent for ${lot.name}`, {
        description: `+${POINTS_PER_REPORT} clout. Thanks for looking out.`,
        duration: 8000,
        action: {
          label: "Undo",
          onClick: () => {
            store.undoReport(report.id).then(
              () => toast("Sighting removed"),
              (error: unknown) =>
                toast.error(error instanceof Error ? error.message : "Couldn't undo."),
            );
          },
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send the alert.");
    } finally {
      setSending(false);
    }
  };

  const confirmPayment = () => {
    const extending = status.session !== null;
    store.pay(lot.id);
    setDialog(null);
    toast.success(extending ? "Session extended by 30 min" : "30-minute demo session started", {
      description: "Simulated. Nothing was charged.",
    });
  };

  const weekday = store.now.toLocaleDateString("en-CA", { weekday: "long" });
  const statuses = LOTS.map((item) => ({ lot: item, status: statusFor(item.id) }));
  const hottest = statuses.reduce((top, item) =>
    item.status.threat > top.status.threat ? item : top,
  );
  const spottedCount = statuses.filter((item) => item.status.spotted).length;
  const tickerItems = [
    { label: live ? "Live scout network" : "Demo radar" },
    ...statuses.map(({ lot: item, status: itemStatus }) => ({
      label: `${item.short} ${itemStatus.threat}% · ${TONE_LABEL[itemStatus.tone]}${itemStatus.spotted ? " · spotted" : ""}`,
      tone: itemStatus.tone,
    })),
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
                  Here's the patrol outlook for {weekday}. Pick a lot, watch the curve, warn the
                  campus.
                </>
              }
              aside={
                <>
                  <span className="demo-chip" data-live={live}>
                    {live ? "Live reports · simulated forecasts" : "Demo data"}
                  </span>
                  <button
                    type="button"
                    className="hero-stat"
                    data-tone={hottest.status.tone}
                    onClick={() => selectLot(hottest.lot.id)}
                  >
                    <span className="hero-stat-value">
                      {hottest.status.threat}
                      <small>%</small>
                    </span>
                    <span className="hero-stat-label">
                      Hottest right now · <strong>{hottest.lot.name}</strong>
                      <span>
                        {spottedCount === 0
                          ? "No lots spotted"
                          : `${spottedCount} ${spottedCount === 1 ? "lot" : "lots"} spotted`}
                      </span>
                    </span>
                  </button>
                </>
              }
            />

            <Ticker items={tickerItems} />

            <LotSwitcher selected={lot.id} statusFor={store.statusFor} onSelect={selectLot} />

            <div className="dashboard-grid">
              <div className="dashboard-main">
                <FocusLot
                  lot={lot}
                  status={status}
                  now={store.now}
                  live={live}
                  {...(!live && { onPay: () => setDialog("pay") })}
                />
                <ReportButton
                  lot={lot}
                  cooldownMinutes={status.cooldownMinutes}
                  onReport={() => setDialog("report")}
                />
                <ThreatForecast lot={lot} now={store.now} />
              </div>
              <aside className="dashboard-side" aria-label="Campus overview">
                <div className="desktop-only">
                  <CampusMap
                    selected={lot.id}
                    tones={tones}
                    onSelect={selectLot}
                    onExpand={() => setDialog("map")}
                  />
                </div>
                <ActivityFeed
                  sightings={store.sightings}
                  now={store.now}
                  onSelect={selectLot}
                  live={live}
                  loading={store.loading}
                />
                <Leaderboard rows={store.leaderboard} />
              </aside>
            </div>
          </>
        ) : (
          <>
            <Hero
              eyebrow="Clout system"
              lines={["Good scouts", "get clout."]}
              subtitle="Every sighting helps a classmate dodge a ticket."
            />
            <CloutView
              points={store.points}
              rank={store.rank}
              reports={store.reports}
              payments={store.payments}
              badges={store.badges}
              leaderboard={store.leaderboard}
              showJit={!live}
              {...(!live && {
                onReset: () => {
                  store.reset();
                  toast("Demo progress reset");
                },
              })}
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
              {live
                ? "Scout reports are crowd-sourced; forecasts are simulated."
                : "Simulated demo."}{" "}
              Not affiliated with UTM. Always follow posted parking rules.{" "}
              <Link to="/privacy">Privacy</Link>
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
        open={dialog === "report"}
        onOpenChange={(open) => setDialog(open ? "report" : null)}
        onConfirm={confirmReport}
      />
      <PaymentDialog
        lot={lot}
        extending={status.session !== null}
        open={dialog === "pay"}
        onOpenChange={(open) => setDialog(open ? "pay" : null)}
        onConfirm={confirmPayment}
      />
      <Dialog open={dialog === "map"} onOpenChange={(open) => setDialog(open ? "map" : null)}>
        <DialogContent className="map-dialog">
          <DialogTitle className="lp-dialog-title">Campus radar</DialogTitle>
          <DialogDescription className="lp-dialog-body">
            Tap a pin to switch lots. Pin colour shows patrol probability.
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
