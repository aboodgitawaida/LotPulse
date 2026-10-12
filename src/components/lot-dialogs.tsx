import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { BellRing, Crosshair } from "lucide-react";

import { TURNSTILE_SITE_KEY, Turnstile } from "@/components/turnstile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { POINTS_PER_REPORT } from "@/lib/community";
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
  /** Why the last attempt failed, shown above the buttons. */
  error?: string | null;
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
          {props.error && (
            <p className="lp-dialog-error" role="alert">
              {props.error}
            </p>
          )}
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

const SCOUT_NAME = /^[A-Za-z0-9_]{3,20}$/;

interface ReportDialogProps {
  lot: Lot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  live: boolean;
  /** Ask for a public scout name with the first report. */
  needsName: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: (scoutName?: string, captchaToken?: string) => void;
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
  // The first live report creates an anonymous account, which needs a captcha
  // when Turnstile is configured. Tokens are single use, so a failed attempt
  // gets a fresh challenge.
  const needsCaptcha = live && needsName && Boolean(TURNSTILE_SITE_KEY);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy && rest.open) {
      setCaptchaToken(null);
      setAttempt((n) => n + 1);
    }
    wasBusy.current = busy;
  }, [busy, rest.open]);
  return (
    <ConfirmDialog
      {...rest}
      busy={busy}
      confirmDisabled={(needsName && !nameValid) || (needsCaptcha && !captchaToken)}
      onConfirm={() =>
        onConfirm(
          needsName ? name : undefined,
          needsCaptcha ? (captchaToken ?? undefined) : undefined,
        )
      }
      icon={<Crosshair />}
      title={`Enforcement at ${lot.name}?`}
      description="Confirm the report to warn every student watching this lot. It shows up on everyone's screen right away."
      summary={[
        { label: "Location", value: `${lot.name} · ${lot.area}` },
        { label: "Reward", value: `+${POINTS_PER_REPORT} clout` },
      ]}
      confirmLabel="Send alert"
      confirmIcon={<BellRing />}
      notice={
        live
          ? "Only your scout name, the lot and the time are shared. No photos or personal details."
          : "Reporting isn't connected on this site yet, so nothing will be sent."
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
      {needsCaptcha && <Turnstile key={attempt} onToken={setCaptchaToken} />}
    </ConfirmDialog>
  );
}
