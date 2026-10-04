"use client";

// The vendor's side of field-by-field negotiation (backend DECISIONS #26):
// the shared workspace, sending through the vendor's routes. Chosen by
// VendorNegotiation for contracts the server negotiates this way.

import { useEffect, useState, type ReactNode } from "react";
import { getMyVendor, listMyServices, saveContractNegotiationDraft, sendContractNegotiation } from "@/lib/jorna";
import type { FieldNegotiationState } from "@jorna/shared/lib/contractTypes";
import { FieldNegotiationWorkspace, type PackageOption } from "@jorna/shared/components/negotiation/FieldNegotiationWorkspace";

export function VendorFieldNegotiation({
  bookingId,
  initial,
  title,
  clientName,
  vendorName,
  onClose,
  onDone,
  headerActions,
}: {
  bookingId: string;
  initial: FieldNegotiationState;
  title: string;
  clientName: string;
  vendorName: string;
  onClose?: () => void;
  onDone: (message: string) => void;
  headerActions?: ReactNode;
}) {
  const [state, setState] = useState(initial);
  const [packages, setPackages] = useState<PackageOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    getMyVendor()
      .then((v) => (v ? listMyServices(v.vendor_id) : null))
      .then((res) => {
        if (cancelled || !res) return;
        setPackages(res.items.filter((s) => s.status !== "archived").map((s) => ({ service_id: s.service_id, name: s.name })));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <FieldNegotiationWorkspace
      key={state.round}
      state={state}
      title={title}
      vendorName={vendorName}
      clientName={clientName}
      packages={packages}
      onClose={onClose}
      headerActions={headerActions}
      onSaveDraft={async (answers, message) => {
        await saveContractNegotiationDraft(bookingId, answers, message);
      }}
      onSend={async (answers, message) => {
        const next = await sendContractNegotiation(bookingId, state.round, answers, message);
        setState(next);
        onDone(
          next.can_sign
            ? `Nothing's waiting now — ${clientName} can sign.`
            : `Round ${next.round} is with ${clientName}. We emailed them.`,
        );
      }}
    />
  );
}
