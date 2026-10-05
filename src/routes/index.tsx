import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, ArrowRight, ArrowUpRight, BadgeCheck, BellRing, Check, CircleParking, Clock3, Cpu, CreditCard, Crosshair, Radio, Radar, ShieldCheck, Sparkles, Trophy, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CampusRadar } from "@/components/campus-radar";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "LotPulse | UTM Campus Parking Radar" },
    { name: "description", content: "Stay one step ahead at UTM with LotPulse. Explore predictive parking threat levels, scout reports and your weekly clout." },
    { property: "og:title", content: "LotPulse | UTM Campus Parking Radar" },
    { property: "og:description", content: "Your campus. Your radar. Predictive parking insights and student-powered scout reports for UTM." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

const lots = [
  { id: "P9", name: "North parking", threat: 85, last: "3h", prediction: "Mon 1PM–3PM", tone: "high" },
  { id: "P4", name: "South parking", threat: 62, last: "5h", prediction: "Mon 2PM–4PM", tone: "medium" },
  { id: "P8", name: "West parking", threat: 30, last: "7h", prediction: "Tue 10AM–12PM", tone: "low" },
  { id: "Inner Circle", name: "Central campus", threat: 74, last: "2h", prediction: "Mon 12PM–2PM", tone: "high" },
];
const scouts = [ { name: "UofT_Driver", initials: "UD", score: 450 }, { name: "parking_ninja", initials: "PN", score: 380 }, { name: "UTM_scout", initials: "US", score: 325 } ];
type Modal = "report" | "reported" | "payment" | "paid" | "map" | null;

function Index() {
  const [tab, setTab] = useState<"radar" | "clout">("radar");
  const [selected, setSelected] = useState("P9");
  const [modal, setModal] = useState<Modal>(null);
  const [reports, setReports] = useState<string[]>([]);
  const [payments, setPayments] = useState<string[]>([]);
  const lot = lots.find((item) => item.id === selected) ?? lots[0];
  const reported = reports.includes(selected);
  const paid = payments.includes(selected);
  const points = 120 + reports.length * 25;
  const selectLot = (id: string) => { setSelected(id); setTab("radar"); setModal(null); };
  const confirmReport = () => { setReports((previous) => previous.includes(selected) ? previous : [...previous, selected]); setModal("reported"); };
  const confirmPayment = () => { setPayments((previous) => [...previous, selected]); setModal("paid"); };

  if (!lot) return null;

  function Leaderboard() {
    return <section className="scouts" aria-label="Weekly top scouts">
      <div className="scouts-header"><div className="scouts-title"><Trophy /> WEEKLY TOP SCOUTS</div><p>Campus clout. Earned, not given.</p></div>
      {scouts.map((scout, index) => <div className="scout-row" key={scout.name}><span className="scout-rank">{index + 1}</span><span className="scout-avatar">{scout.initials}</span><span className="scout-name">{scout.name}</span><span className="scout-points">{scout.score}<small>pts</small></span></div>)}
      <div className="scout-row scout-self"><span className="scout-rank">8</span><span className="scout-avatar">YO</span><span className="scout-name">You <span className="text-muted-foreground">· Rookie scout</span></span><span className="scout-points" data-testid="scout-points">{points}<small>pts</small></span></div>
    </section>;
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><Radar className="brand-icon" /><span className="brand-word">lot<span>pulse</span></span><span className="brand-tag">BUILT FOR UTM.</span></div>
      <nav className="main-nav" aria-label="Main navigation"><Button variant="nav" data-active={tab === "radar"} onClick={() => setTab("radar")}><Radar /> Radar</Button><Button variant="nav" data-active={tab === "clout"} onClick={() => setTab("clout")}><Trophy /> Clout System</Button></nav>
      <div className="profile"><span className="profile-score"><Zap size={14} /> {points} pts</span><span className="avatar" title="Your scout profile">YO</span></div>
    </header>
    <main className="dashboard">
      <div className="page-intro"><div><div className="eyebrow"><span className="status-dot" /> UNIVERSITY OF TORONTO MISSISSAUGA</div><h1>{tab === "radar" ? "Your campus. Your radar." : "Good scouts get clout."}</h1><p className="page-subtitle">{tab === "radar" ? "A little intel. A lot less parking anxiety." : "Looking out for campus has its perks."}</p></div><div className="live-badge"><Radio size={12} /> DEMO SIGNAL</div></div>
      {tab === "radar" ? <div className="dashboard-grid">
        <div className="main-column">
          <section className="focus-lot" aria-label={`Lot ${selected} hybrid engine`}>
            <div className="lot-header"><div className="lot-title"><span className="lot-icon"><CircleParking size={22} /></span><div><h2>{selected === "Inner Circle" ? "Inner Circle" : `LOT ${selected}`}</h2><p>{lot.name} · UTM campus</p></div></div><span className="engine-tag"><Cpu size={13} /> HYBRID ENGINE</span></div>
            <div className="metrics">
              <div className="live-metric"><div className="metric-label"><Radio size={13} /> LIVE STATUS</div><div className={`clear-status ${reported ? "reported" : ""}`}><span className="status-dot" />{reported ? "SPOTTED" : "CLEAR"}</div><p className="last-spot">Last Spot: <strong>{reported ? "Just now" : lot.last}</strong></p><Button variant="utility" className="jit-button" onClick={() => setModal(paid ? "paid" : "payment")}><CreditCard />{paid ? "30min active" : "Pay 30min"}<span className="jit-label">JIT</span><ArrowUpRight /></Button></div>
              <div className="threat-metric"><div className="metric-label"><Sparkles size={13} /> AI THREAT LEVEL</div><div className="threat-gauge"><svg className="gauge" viewBox="0 0 100 100" role="img" aria-label={`Threat level ${lot.threat} percent`}><circle className="gauge-track" cx="50" cy="50" r="41" /><circle className="gauge-value" cx="50" cy="50" r="41" strokeDasharray={`${lot.threat * 2.576} 257.6`} /></svg><div><div className="threat-value">{lot.threat}<span>%</span></div><div className="threat-word">{lot.threat > 70 ? "HIGH PROBABILITY" : lot.threat > 40 ? "MODERATE RISK" : "LOW PROBABILITY"}</div></div></div><p className="prediction"><Activity size={13} /><span>{lot.threat > 70 ? "High patrol prob:" : "Patrol window:"}<br /><strong>{lot.prediction}</strong></span></p></div>
            </div>
            <div className="metric-footer"><span><Users size={12} /> Student signals + predictive intelligence</span><span><Clock3 size={12} /> {reported ? "Updated just now" : "Updated 30s ago"}</span></div>
          </section>
          <div className="report-section"><Button variant="spotted" onClick={() => setModal("report")} disabled={reported}><Crosshair className="report-icon" /><span className="report-button-text"><strong>{reported ? "CAMPUS ALERTED!" : `SPOTTED (${selected === "Inner Circle" ? "IC" : selected})!`}</strong><small>{reported ? "Your fellow students thank you." : "I spotted an enforcer."}</small></span><ArrowRight className="report-arrow" /></Button><div className="report-caption"><ShieldCheck size={12} /><span>Look out for your campus.</span><span className="points">+25 clout per report</span></div></div>
          <section aria-label="Other campus lots"><div className="section-heading"><h2>Elsewhere on campus</h2><span>AI THREAT LEVEL</span></div><div className="lots-list">{lots.filter((item) => item.id !== selected).map((item) => <Button variant="lot" key={item.id} onClick={() => selectLot(item.id)} aria-label={`View ${item.id}, ${item.threat}% threat`}><span className="lot-item-top">{item.id}<ArrowUpRight /></span><span className={`lot-threat tone-${item.tone}`}>{item.threat}% <small>threat</small></span><span className={`threat-bar tone-${item.tone}`}>{Array.from({ length: 10 }, (_, i) => <i className={i >= Math.round(item.threat / 10) ? "empty" : ""} key={i} />)}</span></Button>)}</div></section>
        </div>
        <aside className="sidebar"><CampusRadar selected={selected} onSelect={selectLot} onExpand={() => setModal("map")} /><Leaderboard /><div className="community-note"><ShieldCheck /><p>Student-powered. Community-first.<br />Every signal makes campus a little smarter.</p></div></aside>
      </div> : <div className="clout-page"><div className="clout-score"><div><div className="metric-label"><Zap size={14} /> YOUR WEEKLY CLOUT</div><strong>{points} <span className="text-lg">pts</span></strong><p>Rookie scout · Weekly rank #8</p></div><Trophy size={42} className="tone-medium" /></div><Leaderboard /><div className="community-note"><BadgeCheck /><p>{reports.length} {reports.length === 1 ? "report" : "reports"} this session · +25 points for each new lot report.</p></div><Button variant="utility" className="mt-6" onClick={() => setTab("radar")}><Radar /> Back to campus radar <ArrowRight /></Button></div>}
      <footer className="page-footer"><span className="footer-brand"><Radar size={12} /> LOTPULSE <span>· FOR STUDENTS, BY STUDENTS.</span></span><span>Simulated signals. Not a guarantee. Always park responsibly.</span></footer>
    </main>
    <nav className="mobile-nav" aria-label="Mobile navigation"><Button variant="nav" data-active={tab === "radar"} onClick={() => setTab("radar")}><Radar /> Radar</Button><Button variant="nav" data-active={tab === "clout"} onClick={() => setTab("clout")}><Trophy /> Clout System</Button></nav>
    <Dialog open={modal !== null} onOpenChange={(open) => { if (!open) setModal(null); }}><DialogContent className="max-w-md w-[calc(100%-32px)] rounded-lg">
      {modal === "report" && <><div className="modal-icon"><Crosshair size={27} /></div><DialogTitle>Enforcer spotted in {selected}?</DialogTitle><DialogDescription className="modal-body">Confirm your sighting to send a simulated campus alert and earn 25 clout.</DialogDescription><div className="modal-summary"><span>Report location</span><strong>{selected}</strong></div><div className="modal-actions"><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button onClick={confirmReport}><BellRing /> Confirm sighting</Button></div><p className="demo-notice">Demo report · No real alert will be sent</p></>}
      {modal === "reported" && <><div className="modal-icon success-icon"><Check size={28} /></div><DialogTitle>Signal sent. Campus covered.</DialogTitle><DialogDescription className="modal-body">Your simulated {selected} report is on the radar. That’s +25 clout for looking out for your fellow students.</DialogDescription><div className="modal-summary"><span>Your clout</span><strong>{points} pts</strong></div><Button onClick={() => setModal(null)}>Back to radar <ArrowRight /></Button></>}
      {modal === "payment" && <><div className="modal-icon"><CreditCard size={26} /></div><DialogTitle>A little extra time in {selected}.</DialogTitle><DialogDescription className="modal-body">Preview a 30-minute parking payment. This demo won’t charge you or issue a valid parking permit.</DialogDescription><div className="modal-summary"><span>Parking session</span><strong>{selected} · 30 minutes</strong></div><Button onClick={confirmPayment}><CreditCard /> Simulate payment <ArrowUpRight /></Button><p className="demo-notice">No payment provider connected · No charge</p></>}
      {modal === "paid" && <><div className="modal-icon success-icon"><Check size={28} /></div><DialogTitle>Demo session activated.</DialogTitle><DialogDescription className="modal-body">Your simulated 30-minute session for {selected} is active in this preview only. For real parking, use UTM’s official payment service.</DialogDescription><div className="modal-summary"><span>Demo duration</span><strong>30 minutes</strong></div><Button onClick={() => setModal(null)}>Back to radar <ArrowRight /></Button></>}
      {modal === "map" && <><DialogTitle>Campus radar</DialogTitle><DialogDescription>UTM lots · Illustrative campus schematic</DialogDescription><CampusRadar selected={selected} onSelect={selectLot} expanded /></>}
    </DialogContent></Dialog>
  </div>;
}
