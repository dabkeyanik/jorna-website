"use client";

export function SignatureBlock({ clientName, vendorName }: { clientName: string; vendorName: string }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <div className="h-10 border-b border-ink/30" />
        <p className="mt-1 text-sm text-ink">{clientName}</p>
        <p className="text-xs text-ink-faint">Types their name on the link to sign</p>
      </div>
      <div>
        <div className="serif flex h-10 items-end border-b border-ink/30 text-lg italic text-ink-soft">{vendorName}</div>
        <p className="mt-1 text-sm text-ink">{vendorName}</p>
        <p className="text-xs text-ink-faint">Sending it is your agreement to these terms</p>
      </div>
    </div>
  );
}
