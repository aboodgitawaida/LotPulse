import type { ReactNode } from "react";
import { BellRing, CreditCard, Crosshair, TimerReset } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { POINTS_PER_REPORT, SESSION_MINUTES } from "@/lib/community";
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
        <div className="lp-dialog-actions">
          <Button variant="secondary" size="lg" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="lg" onClick={props.onConfirm} autoFocus>
            {props.confirmIcon} {props.confirmLabel}
          </Button>
        </div>
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

export function ReportDialog({ lot, ...rest }: LotDialogProps) {
  return (
    <ConfirmDialog
      {...rest}
      icon={<Crosshair />}
      title={`Enforcement at ${lot.name}?`}
      description="Confirm the sighting to warn everyone watching this lot. You can undo it for a few seconds afterwards."
      summary={[
        { label: "Location", value: `${lot.name} · ${lot.area}` },
        { label: "Reward", value: `+${POINTS_PER_REPORT} clout` },
      ]}
      confirmLabel="Send alert"
      confirmIcon={<BellRing />}
      notice="Demo only. No real alert is sent."
    />
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
        { label: extending ? "Adds" : "Duration", value: `${SESSION_MINUTES} minutes` },
      ]}
      confirmLabel={extending ? "Extend session" : "Start session"}
      confirmIcon={<CreditCard />}
      notice="Demo only. Nothing is charged and no permit is issued."
    />
  );
}
