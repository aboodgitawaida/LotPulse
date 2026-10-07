import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CloutView } from "@/components/clout-view";
import { FocusLot } from "@/components/focus-lot";
import { Leaderboard } from "@/components/leaderboard";
import { LotSwitcher } from "@/components/lot-switcher";
import { ReportButton } from "@/components/report-button";
import { getLot, type LotId } from "@/lib/lots";
import type { LotStatus } from "@/lib/store";

const now = new Date("2026-10-05T12:20:00");

const status = (overrides: Partial<LotStatus> = {}): LotStatus => ({
  threat: 50,
  tone: "medium",
  lastSighting: null,
  spotted: false,
  cooldownMinutes: 0,
  session: null,
  ...overrides,
});

describe("LotSwitcher", () => {
  it("marks the selected lot and reports clicks", async () => {
    const onSelect = vi.fn();
    render(<LotSwitcher selected="P9" statusFor={() => status()} onSelect={onSelect} />);

    expect(screen.getByRole("button", { name: /^Lot P9/ })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: /^Inner Circle/ }));
    expect(onSelect).toHaveBeenCalledWith<[LotId]>("IC");
  });
});

describe("FocusLot", () => {
  it("shows clear status, threat and the countdown to the next peak", () => {
    render(<FocusLot lot={getLot("P9")} status={status()} now={now} onPay={() => {}} />);
    expect(screen.getByText("Clear")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Patrol probability 50 percent" })).toBeInTheDocument();
    expect(screen.getByText("Next peak in 40m")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pay 30 min/ })).toBeInTheDocument();
  });

  it("shows a spotted lot and the remaining paid session", () => {
    const at = now.getTime();
    render(
      <FocusLot
        lot={getLot("P9")}
        status={status({
          spotted: true,
          tone: "high",
          lastSighting: { id: "1", lot: "P9", scout: "You", at, mine: true },
          session: { lot: "P9", at, until: at + 30 * 60_000 },
        })}
        now={now}
        onPay={() => {}}
      />,
    );
    expect(screen.getByText("Spotted")).toBeInTheDocument();
    expect(screen.getByText("by you")).toBeInTheDocument();
    expect(screen.getByText("30m left")).toBeInTheDocument();
  });
});

describe("ReportButton", () => {
  it("is disabled with a countdown during cooldown", () => {
    render(<ReportButton lot={getLot("P4")} cooldownMinutes={12} onReport={() => {}} />);
    expect(screen.getByRole("button", { name: /Campus alerted/ })).toBeDisabled();
    expect(screen.getByText(/again in 12 min/)).toBeInTheDocument();
  });
});

describe("Leaderboard", () => {
  it("always includes you, ranked by points", () => {
    render(<Leaderboard points={300} limit={3} />);
    const you = screen.getByText("You").closest("li");
    expect(you).toHaveAttribute("aria-current", "true");
    expect(you).toHaveTextContent("4");
  });
});

describe("CloutView", () => {
  it("shows tier progress and earned badges", () => {
    render(
      <CloutView
        points={145}
        rank={8}
        reports={[{ id: "r", lot: "P9", at: now.getTime() }]}
        payments={[]}
        badges={new Set(["first-signal"])}
        onReset={() => {}}
      />,
    );
    expect(screen.getByText("5 pts to Scout")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "97");
    expect(screen.getByText("First signal").closest("li")).toHaveAttribute("data-earned", "true");
    expect(screen.getByText("Hat trick").closest("li")).toHaveAttribute("data-earned", "false");
  });
});
