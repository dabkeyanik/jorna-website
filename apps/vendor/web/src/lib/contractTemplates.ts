"use client";

// Named contract-term presets, stored per-browser (localStorage), not synced
// to the vendor's account — see HONEYBOOK_PARITY_PLAN.md §1.1 for why this
// is a deliberate barebones cut rather than an oversight: there's no backend
// concept of a "template" today (only the single `default_*` fields on
// VendorDetail), and adding one is a bigger ask than a vendor's own browser
// remembering a few presets they quote from.
//
// Scoped to exactly the fields /contracts/new actually collects — deposit,
// cancellation window, overtime rate, equipment/power, travel. Guest-count
// mode isn't here: it's a single account-wide policy set once in Settings
// (VendorContractDefaultsFields), not something that varies per contract.

const KEY = "jorna_contract_templates";

export interface ContractTemplate {
  id: string;
  name: string;
  depositPercent: string;
  cancellationWindowHours: string;
  overtimeRate: string;
  equipmentPower: string;
  travel: string;
}

export type ContractTemplateInput = Omit<ContractTemplate, "id">;

function read(): ContractTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt or hand-edited storage — treat as empty rather than throw.
    return [];
  }
}

function write(templates: ContractTemplate[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(templates));
}

export function listTemplates(): ContractTemplate[] {
  return read();
}

/** Adds a new template. Names aren't unique — a vendor renaming by
 *  delete-then-save can end up with two of the same name briefly, which is
 *  harmless (the picker keys on id, not name). */
export function saveTemplate(input: ContractTemplateInput): ContractTemplate {
  const template: ContractTemplate = { id: crypto.randomUUID(), ...input };
  write([...read(), template]);
  return template;
}

export function deleteTemplate(id: string) {
  write(read().filter((t) => t.id !== id));
}
