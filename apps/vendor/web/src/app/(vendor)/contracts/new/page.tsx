"use client";

// A vendor authoring a whole booking themselves — event, price, terms — for
// a client who may never have used Jorna. Once created, the link at the
// bottom is the client's entire way in: no account, no login, just the
// token in that URL. See /booking-link (the page it points to) and the
// backend's docs/DECISIONS.md #13 for the full design.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { convertLead, createContract, getMyVendor, listLeads, listServices } from "@/lib/jorna";
import { priceUnitLabel, type Contract, type ServiceItem, type VendorDetail } from "@/lib/types";
import { Button, Card, Field, LinkButton } from "@/components/ui";
import { contractDefaultsToStrings } from "@/components/VendorProfileFields";
import { listTemplates, saveTemplate, type ContractTemplate } from "@/lib/contractTemplates";
import { guestBookingLink } from "@/lib/contractLink";

// Today as YYYY-MM-DD in the vendor's own timezone — the backend allows a
// day of slack for UTC, but the form shouldn't offer yesterday at all.
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const QUANTITY_NOUN: Record<string, string> = {
  person: "guests",
  performer: "performers",
  hour: "hours",
  day: "days",
};

function NewContractInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  // Arriving from a lead's "Convert" (LeadsPanel) pre-fills the client and
  // date, and submits through convertLead so the lead is marked won.
  const leadId = useSearchParams().get("lead");

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [location, setLocation] = useState("");

  const [serviceId, setServiceId] = useState("");
  // For a package priced per person/hour/etc: how many, so the total is the
  // rate times the quantity rather than the bare rate (which is what used to
  // be pre-filled as the whole contract's price).
  const [quantity, setQuantity] = useState("");
  // Once the vendor types their own total, stop overwriting it.
  const [amountTouched, setAmountTouched] = useState(false);
  const [multiDay, setMultiDay] = useState(false);
  const [dateEnd, setDateEnd] = useState("");
  const [dateIso, setDateIso] = useState("");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [amount, setAmount] = useState("");
  const [depositPercent, setDepositPercent] = useState("");
  const [cancellationWindowHours, setCancellationWindowHours] = useState("");
  const [overtimeRate, setOvertimeRate] = useState("");
  const [equipmentPower, setEquipmentPower] = useState("");
  const [travel, setTravel] = useState("");

  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Contract | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/contracts/new&role=vendor");
  }, [authLoading, user, router]);

  useEffect(() => {
    setTemplates(listTemplates());
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMyVendor()
      .then(async (mine) => {
        if (cancelled) return;
        if (!mine) {
          router.replace("/vendor-onboarding");
          return;
        }
        setVendor(mine);
        const defaults = contractDefaultsToStrings(mine);
        setDepositPercent(defaults.depositPercent);
        setCancellationWindowHours(defaults.cancellationWindowHours);
        setOvertimeRate(defaults.overtimeRate);
        setEquipmentPower(defaults.equipmentPower);
        setTravel(defaults.travel);

        const [svc, leads] = await Promise.all([
          listServices({ vendor_id: mine.vendor_id, limit: 100 }).catch(() => null),
          leadId ? listLeads().catch(() => null) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (svc) setServices(svc.items);
        const lead = leads?.items.find((l) => l.lead_id === leadId);
        if (lead) {
          setClientName(lead.name);
          setClientEmail(lead.email ?? "");
          setClientPhone(lead.phone ?? "");
          if (lead.event_date_iso && lead.event_date_iso >= todayIso()) setDateIso(lead.event_date_iso);
        }
      })
      .catch((err) =>
        !cancelled &&
        setLoadError(err instanceof ApiError ? err.message : "Couldn't load your listing."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user, router, leadId]);

  const selected = services.find((s) => s.service_id === serviceId) ?? null;
  const perUnit = selected ? (selected.price_unit ?? "event") !== "event" : false;

  function pickService(id: string) {
    setServiceId(id);
    setQuantity("");
    const svc = services.find((s) => s.service_id === id);
    if (!svc || amountTouched) return;
    // Only a flat price is a total by itself.
    setAmount((svc.price_unit ?? "event") === "event" ? svc.price.toString() : "");
  }

  function pickQuantity(raw: string) {
    setQuantity(raw);
    const n = Number(raw);
    if (selected && !amountTouched && n > 0) {
      setAmount((Math.round(selected.price * n * 100) / 100).toString());
    }
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((tpl) => tpl.id === id);
    if (!t) return;
    setDepositPercent(t.depositPercent);
    setCancellationWindowHours(t.cancellationWindowHours);
    setOvertimeRate(t.overtimeRate);
    setEquipmentPower(t.equipmentPower);
    setTravel(t.travel);
  }

  function saveCurrentAsTemplate() {
    if (!newTemplateName.trim()) return;
    const t = saveTemplate({
      name: newTemplateName.trim(),
      depositPercent,
      cancellationWindowHours,
      overtimeRate,
      equipmentPower,
      travel,
    });
    setTemplates((prev) => [...prev, t]);
    setTemplateId(t.id);
    setNewTemplateName("");
    setSavingTemplate(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceId) {
      setError("Pick a package first.");
      return;
    }
    if (dateIso < todayIso()) {
      setError("The event date is in the past.");
      return;
    }
    if (multiDay && dateEnd && dateEnd < dateIso) {
      setError("The end date is before the start date.");
      return;
    }
    const amountCents = Math.round(Number(amount) * 100);
    if (!amountCents || amountCents <= 0) {
      setError("Enter a price greater than zero.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const input = {
        service_id: serviceId,
        guest_name: clientName.trim() || null,
        guest_email: clientEmail.trim() || null,
        guest_phone: clientPhone.trim() || null,
        location: location.trim() || null,
        date_iso: dateIso,
        date_end: multiDay && dateEnd ? dateEnd : null,
        time_start: timeStart,
        time_end: timeEnd,
        amount_cents: amountCents,
        deposit_percent: depositPercent ? Number(depositPercent) : null,
        cancellation_window_hours: cancellationWindowHours ? Number(cancellationWindowHours) : null,
        overtime_rate_cents: overtimeRate ? Math.round(Number(overtimeRate) * 100) : null,
        contract_terms:
          equipmentPower.trim() || travel.trim()
            ? { equipment_power: equipmentPower.trim() || undefined, travel: travel.trim() || undefined }
            : null,
      };
      const contract = leadId ? await convertLead(leadId, input) : await createContract(input);
      setCreated(contract);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the contract.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(guestBookingLink(created.contract_token));
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* clipboard can be denied — the link is still visible to select by hand */
    }
  }

  if (authLoading || !user || loading) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  if (loadError || !vendor) {
    return (
      <div className="py-20 text-center">
        <p role="alert" className="text-ink-soft">{loadError ?? "Couldn't load your listing."}</p>
      </div>
    );
  }

  if (created) {
    const link = guestBookingLink(created.contract_token);
    return (
      <div className="mx-auto w-[min(640px,100%-2rem)]">
        <div className="text-center">
          <p className="eyebrow">Contract created</p>
          <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold">Send this link</h1>
          <p className="mt-3 text-ink-soft">
            Your client opens it, fills in their own details, and signs — no account needed on
            their end.
          </p>
        </div>
        <Card className="mt-8 p-5">
          <p className="break-all rounded-lg bg-ground-2 px-3 py-2.5 font-mono text-sm text-ink">
            {link}
          </p>
          <Button className="mt-3 w-full" onClick={copyLink}>
            {linkCopied ? "Copied!" : "Copy link"}
          </Button>
        </Card>
        <div className="mt-6 flex justify-center gap-4">
          <Button variant="ghost" onClick={() => {
            // A converted lead is spent — another contract starts fresh.
            if (leadId) router.replace("/contracts/new");
            setCreated(null);
            setClientName("");
            setClientEmail("");
            setClientPhone("");
            setLocation("");
            setServiceId("");
            setQuantity("");
            setAmountTouched(false);
            setMultiDay(false);
            setDateEnd("");
            setDateIso("");
            setTimeStart("");
            setTimeEnd("");
            setAmount("");
          }}>
            Create another
          </Button>
          <LinkButton href="/contracts" variant="ghost">
            View all contracts
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-[min(640px,100%-2rem)]">
      <header>
        <Link href="/contracts" className="eyebrow hover:text-gold">
          ← All contracts
        </Link>
        <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold">New booking</h1>
        <p className="mt-3 text-ink-soft">
          You set the event and price. Your client fills in their own details and signs when you
          send the link.
        </p>
      </header>

      <form onSubmit={submit} className="mt-8 grid gap-6">
        {/* Who it's for. Optional — the client can fill or correct these on
            the link — but a name is what tells one sent contract from the
            next in the Contracts list. */}
        <Card className="grid gap-3 p-5 sm:grid-cols-2">
          <p className="text-sm font-medium text-ink-soft sm:col-span-2">Client</p>
          <div className="sm:col-span-2">
            <Field
              label="Name"
              placeholder="Who this booking is for"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>
          <Field
            label="Email (optional)"
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
          />
          <Field
            label="Phone (optional)"
            type="tel"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
          />
        </Card>

        <Card className="p-5">
          <p className="mb-3 text-sm font-medium text-ink-soft">Package</p>
          {services.length === 0 ? (
            <p className="text-sm text-ink-faint">
              You don&apos;t have any packages listed yet — add one on your listing first.
            </p>
          ) : (
            <select
              value={serviceId}
              onChange={(e) => pickService(e.target.value)}
              className="w-full rounded-xl border border-card-edge bg-ground-2 px-3.5 py-2.5 text-ink outline-none focus:border-gold"
            >
              <option value="" disabled>
                Choose a package
              </option>
              {services.map((s) => (
                <option key={s.service_id} value={s.service_id}>
                  {s.name} — ${s.price}{s.price_unit && s.price_unit !== "event" ? ` ${priceUnitLabel(s.price_unit)}` : ""}
                </option>
              ))}
            </select>
          )}
        </Card>

        <Card className="grid gap-3 p-5 sm:grid-cols-2">
          <Field
            label={multiDay ? "Start date" : "Date"}
            type="date"
            min={todayIso()}
            value={dateIso}
            onChange={(e) => setDateIso(e.target.value)}
            required
          />
          {multiDay ? (
            <Field
              label="End date"
              type="date"
              min={dateIso || todayIso()}
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              required
            />
          ) : (
            <label className="flex items-center gap-2 self-end pb-3 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={multiDay}
                onChange={(e) => setMultiDay(e.target.checked)}
              />
              Runs over more than one day
            </label>
          )}
          {perUnit && selected ? (
            <Field
              label={`How many ${QUANTITY_NOUN[selected.price_unit ?? ""] ?? "units"}`}
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => pickQuantity(e.target.value)}
              hint={`$${selected.price} ${priceUnitLabel(selected.price_unit)}`}
            />
          ) : null}
          <Field
            label="Total price ($)"
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setAmountTouched(true);
            }}
            required
          />
          <Field
            label="Start time"
            type="time"
            value={timeStart}
            onChange={(e) => setTimeStart(e.target.value)}
            required
          />
          <Field
            label="End time"
            type="time"
            value={timeEnd}
            onChange={(e) => setTimeEnd(e.target.value)}
            required
          />
          {timeStart && timeEnd && timeEnd <= timeStart ? (
            <p className="text-xs text-ink-faint sm:col-span-2">
              Ends the next morning — that&apos;s fine for a late night.
            </p>
          ) : null}
          <div className="sm:col-span-2">
            <Field
              label="Venue (optional)"
              placeholder="Leave blank if your client will add it"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </Card>

        <Card className="grid gap-3 p-5 sm:grid-cols-2">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
            <p className="text-sm font-medium text-ink-soft">Contract terms</p>
            {templates.length > 0 ? (
              <select
                aria-label="Contract template"
                value={templateId}
                onChange={(e) => applyTemplate(e.target.value)}
                className="rounded-lg border border-card-edge bg-ground-2 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-gold"
              >
                <option value="">Load a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <Field
            label="Deposit (%)"
            type="number"
            min={0}
            max={100}
            placeholder="e.g. 50"
            value={depositPercent}
            onChange={(e) => setDepositPercent(e.target.value)}
          />
          {/* Stored in hours (the backend's unit, and templates'), asked in
              days — nobody thinks of a cancellation policy as "720 hours". */}
          <Field
            label="Cancellation window (days)"
            type="number"
            min={0}
            placeholder="e.g. 30"
            value={
              cancellationWindowHours ? String(Math.round(Number(cancellationWindowHours) / 24)) : ""
            }
            onChange={(e) =>
              setCancellationWindowHours(e.target.value ? String(Number(e.target.value) * 24) : "")
            }
          />
          <Field
            label="Overtime rate ($/hr)"
            type="number"
            min={0}
            step="0.01"
            value={overtimeRate}
            onChange={(e) => setOvertimeRate(e.target.value)}
          />
          <div className="sm:col-span-2">
            <Field
              label="Equipment & power (optional)"
              placeholder="Vendor brings all gear; venue provides standard power"
              value={equipmentPower}
              onChange={(e) => setEquipmentPower(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Travel (optional)"
              placeholder="30 miles included, $0.75/mi beyond"
              value={travel}
              onChange={(e) => setTravel(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            {savingTemplate ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  autoFocus
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Template name, e.g. Standard DJ package"
                  className="min-w-0 flex-1 rounded-lg border border-card-edge bg-ground-2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-gold"
                />
                <Button
                  type="button"
                  size="md"
                  onClick={saveCurrentAsTemplate}
                  disabled={!newTemplateName.trim()}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setSavingTemplate(false);
                    setNewTemplateName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="md" onClick={() => setSavingTemplate(true)}>
                Save these terms as a template
              </Button>
            )}
          </div>
        </Card>

        {error ? (
          <p role="alert" className="rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={busy || services.length === 0}>
          {busy ? "Creating…" : "Generate contract & link"}
        </Button>
      </form>
    </div>
  );
}

export default function NewContractPage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-ink-soft">Loading…</p>}>
      <NewContractInner />
    </Suspense>
  );
}
