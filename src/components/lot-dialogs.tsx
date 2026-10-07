import { useId, useState, type FormEvent, type ReactNode } from "react";
import { BellRing, CreditCard, Crosshair, TimerReset } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { POINTS_PER_REPORT, SESSION_MINUTES } from "@/lib/community";
import { formatPrice, formatRate } from "@/lib/format";
import type { Lot } from "@/lib/lots";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: ReactNode;
  title: string;
  description: string;
  summary: { label: string; value: string }[];
  confirmLabel: string;
  confirmIcon: ReactNode;
  onConfirm: () => void;
  notice: string;
  /** Extra fields shown above the buttons; the dialog becomes a form. */
  children?: ReactNode;
  busy?: boolean;
  confirmDisabled?: boolean;
}

function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="lp-dialog">
        <span className="lp-dialog-icon" aria-hidden>
          {props.icon}
        </span>
        <DialogTitle className="lp-dialog-title">{props.title}</DialogTitle>
        <DialogDescription className="lp-dialog-body">{props.description}</DialogDescription>
        <dl className="lp-dialog-summary">
          {props.summary.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            if (!props.busy && !props.confirmDisabled) props.onConfirm();
          }}
        >
          {props.children}
          <div className="lp-dialog-actions">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => props.onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              autoFocus={!props.children}
              disabled={props.busy || props.confirmDisabled}
            >
              {props.confirmIcon} {props.busy ? "Sending…" : props.confirmLabel}
            </Button>
          </div>
        </form>
        <p className="lp-dialog-notice">{props.notice}</p>
      </DialogContent>
    </Dialog>
  );
}

interface LotDialogProps {
  lot: Lot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

const SCOUT_NAME = /^[A-Za-z0-9_]{3,20}$/;

interface ReportDialogProps extends Omit<LotDialogProps, "onConfirm"> {
  live: boolean;
  /** Live mode: ask for a public scout name with the first report. */
  needsName: boolean;
  busy: boolean;
  onConfirm: (scoutName?: string) => void;
}

export function ReportDialog({
  lot,
  live,
  needsName,
  busy,
  onConfirm,
  ...rest
}: ReportDialogProps) {
  const nameId = useId();
  const [name, setName] = useState("");
  const nameValid = SCOUT_NAME.test(name);
  return (
    <ConfirmDialog
      {...rest}
      busy={busy}
      confirmDisabled={needsName && !nameValid}
      onConfirm={() => onConfirm(needsName ? name : undefined)}
      icon={<Crosshair />}
      title={`Enforcement at ${lot.name}?`}
      description={
        live
          ? "Confirm the sighting to warn every student watching this lot. You can undo it for 2 minutes."
          : "Confirm the sighting to warn everyone watching this lot. You can undo it for a few seconds afterwards."
      }
      summary={[
        { label: "Location", value: `${lot.name} · ${lot.area}` },
        { label: "Reward", value: `+${POINTS_PER_REPORT} clout` },
      ]}
      confirmLabel="Send alert"
      confirmIcon={<BellRing />}
      notice={
        live
          ? "Only your scout name, the lot and the time are shared. No photos or personal details."
          : "Demo only. No real alert is sent."
      }
    >
      {needsName && (
        <div className="lp-field">
          <label htmlFor={nameId}>Pick a scout name</label>
          <input
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. deck_runner"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={20}
            aria-describedby={`${nameId}-hint`}
            aria-invalid={name.length > 0 && !nameValid}
            autoFocus
          />
          <span id={`${nameId}-hint`}>
            Shown on the leaderboard. 3–20 letters, numbers or underscores. No real names.
          </span>
        </div>
      )}
    </ConfirmDialog>
  );
}

export function PaymentDialog({
  lot,
  extending,
  ...rest
}: LotDialogProps & { extending: boolean }) {
  return (
    <ConfirmDialog
      {...rest}
      icon={extending ? <TimerReset /> : <CreditCard />}
      title={extending ? `Extend your ${lot.name} session?` : `Pay for 30 min at ${lot.name}?`}
      description="Just-in-time payment preview for when a patrol is close. For real parking, use UTM's official payment service."
      summary={[
        { label: "Lot", value: lot.name },
        { label: "Posted rate", value: formatRate(lot.rate) },
        { label: "Demo charge", value: `${formatPrice(lot.rate.halfHour)} (not charged)` },
        { label: extending ? "Adds" : "Duration", value: `${SESSION_MINUTES} minutes` },
      ]}
      confirmLabel={extending ? "Extend session" : "Start session"}
      confirmIcon={<CreditCard />}
      notice="Demo only. Nothing is charged and no permit is issued. Rates change, so check posted signs."
    />
  );
}
