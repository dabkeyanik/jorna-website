"use client";

// The client's proposed changes to a contract, side by side with the
// vendor's version (backend DECISIONS #23), and the three answers:
//
// - Accept: their terms become the next version, sent back to sign.
// - Decline: the current version stands; a note says why.
// - Revise: the editor opens with their changes already in
//   (/contracts/new?edit=…&proposal=…), so the vendor keeps what they like
//   and sends their own version.
//
// /contracts/changes?id=… — a static export can't have a page per contract.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@jorna/shared/lib/api";
import { acceptProposal, declineProposal, getContract, getContractProposals } from "@/lib/jorna";
import { termsOf } from "@/lib/contractDiff";
import { describeWhen } from "@/lib/contractDraft";
import type { Contract, ProposalHistory } from "@/lib/types";
import { Button, Card, LinkButton } from "@jorna/shared/components/ui";
import { ContractCompare } from "@/components/ContractCompare";

const ANSWERED: Record<string, string> = {
  accepted: "You accepted these changes.",
  declined: "You kept your version.",
  revised: "You answered with a new version.",
  superseded: "Your client replaced this proposal, or the contract changed since.",
  withdrawn: "Your client withdrew this proposal.",
};

function ChangesInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";

  const [contract, setContract] = useState<Contract | null>(null);
  const [history, setHistory] = useState<ProposalHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [declining, setDeclining] = useState(false);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent(`/contracts/changes?id=${id}`)}&role=vendor`);
    }
  }, [authLoading, user, router, id]);

  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;
    Promise.all([getContract(id), getContractProposals(id)])
      .then(([c, h]) => {
        if (cancelled) return;
        setContract(c);
        setHistory(h);
      })
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Couldn't load these changes."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user, id]);

  async function answer(kind: "accept" | "decline", proposalId: string) {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "accept") await acceptProposal(id, proposalId, note.trim() || null);
      else await declineProposal(id, proposalId, note.trim() || null);
      router.push(`/contracts/view?id=${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work — try again.");
      // Answered elsewhere meanwhile, or the date clashed: show where it stands.
      getContractProposals(id).then(setHistory).catch(() => undefined);
      setBusy(null);
    }
  }

  if (authLoading || !user || (loading && id)) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }
  if (!contract || !history) {
    return (
      <div className="py-20 text-center">
        <p role="alert" className="text-ink-soft">{error ?? "No contract picked."}</p>
        <LinkButton href="/leads" variant="ghost" className="mt-4">
          Back to leads
        </LinkButton>
      </div>
    );
  }

  const client = contract.guest_name || "Your client";
  const open = history.open_proposal;
  const latest = history.proposals[0];

  return (
    <div className="mx-auto w-[min(960px,100%-2rem)]">
      <Link href={`/contracts/view?id=${contract.booking_id}`} className="eyebrow hover:text-gold">
        ← The contract
      </Link>
      <header className="mt-3">
        <p className="eyebrow">{open ? "Changes proposed" : "Proposed changes"}</p>
        <h1 className="serif text-3xl text-maroon dark:text-gold">{client}</h1>
        <p className="mt-1 text-ink-soft">
          {describeWhen(contract.date_iso, contract.date_end, contract.time_start, contract.time_end)} ·{" "}
          {contract.service_name ?? "Contract"}
        </p>
      </header>

      {!open ? (
        <Card className="mt-6 p-5">
          <p className="text-ink">
            {latest ? ANSWERED[latest.status] ?? "This proposal is closed." : `${client} hasn't proposed any changes.`}
          </p>
          <LinkButton href={`/contracts/view?id=${contract.booking_id}`} variant="ghost" className="mt-4">
            Open the contract
          </LinkButton>
        </Card>
      ) : (
        <>
          {open.message ? (
            <blockquote className="mt-5 rounded-xl border-l-4 border-gold bg-gold/10 px-4 py-3 text-ink">
              “{open.message}”
              <footer className="mt-1 text-xs text-ink-faint">
                {client}, {new Date(open.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </footer>
            </blockquote>
          ) : null}

          <Card className="mt-5 p-5">
            <ContractCompare
              before={termsOf(contract)}
              after={open.proposed}
              beforeLabel="Your version"
              afterLabel={`${client}'s proposal`}
            />
          </Card>

          {error ? (
            <p role="alert" className="mt-4 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
              {error}
            </p>
          ) : null}

          <Card className="mt-5 p-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">
                A note for {client} {declining ? "(say why you'd rather keep it)" : "(optional)"}
              </span>
              <textarea
                value={note}
                maxLength={1000}
                rows={2}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl border border-card-edge bg-ground-2 px-3 py-2 text-sm text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {declining ? (
                <>
                  <Button disabled={busy !== null} onClick={() => answer("decline", open.proposal_id)}>
                    {busy === "decline" ? "Sending…" : "Keep my version"}
                  </Button>
                  <Button variant="quiet" onClick={() => setDeclining(false)}>
                    Never mind
                  </Button>
                </>
              ) : (
                <>
                  <Button disabled={busy !== null} onClick={() => answer("accept", open.proposal_id)}>
                    {busy === "accept" ? "Accepting…" : "Accept changes"}
                  </Button>
                  <LinkButton
                    variant="ghost"
                    href={`/contracts/new?edit=${contract.booking_id}&proposal=${open.proposal_id}`}
                  >
                    Revise
                  </LinkButton>
                  <Button variant="quiet" disabled={busy !== null} onClick={() => setDeclining(true)}>
                    Decline
                  </Button>
                </>
              )}
            </div>
            <p className="mt-3 text-xs text-ink-faint">
              Accept sends {client} the contract with their changes in, and restarts your hold on the date. Revise
              opens the editor with their changes already in — keep what you like, change the rest, and send it.
              Decline leaves your version as it is.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

export default function ContractChangesPage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-ink-soft">Loading…</p>}>
      <ChangesInner />
    </Suspense>
  );
}
