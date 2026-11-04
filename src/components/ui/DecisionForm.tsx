"use client";
import { useState, type FormEvent } from "react";
import { Button } from "./button";
export function DecisionForm({
  actions,
  actionLabel,
  reasonLabel,
  submitLabel,
  errorMessage,
  onSubmit,
  pending = false,
  minReasonLength = 10,
}: {
  actions: { value: string; label: string }[];
  actionLabel: string;
  reasonLabel: string;
  submitLabel: string;
  errorMessage: string;
  onSubmit: (value: { action: string; reason: string }) => void | Promise<void>;
  pending?: boolean;
  minReasonLength?: number;
}) {
  const [action, setAction] = useState(actions[0]?.value ?? "");
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!action || reason.trim().length < minReasonLength) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    void onSubmit({ action, reason: reason.trim() });
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        {actionLabel}
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="block border border-input rounded-md p-2"
        >
          {actions.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        {reasonLabel}
        <textarea
          required
          minLength={minReasonLength}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={invalid}
          className="block w-full rounded-md border border-input p-2"
        />
      </label>
      {invalid && <p role="alert">{errorMessage}</p>}
      <Button disabled={pending} type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}
