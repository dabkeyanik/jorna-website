"use client";

import { useState } from "react";
import { Button } from "@jorna/shared/components/ui";
import type { SavedContractTemplate } from "@/lib/types";
import { inputClass } from "./shared";

/** Start from a saved template, or save this one as a template. */
export function TemplatesCard({
  templates,
  canPick,
  onPick,
  onSave,
  notice,
}: {
  templates: SavedContractTemplate[];
  /** Only a new contract starts from a template. */
  canPick: boolean;
  onPick: (templateId: string) => void;
  /** Resolves true once saved, so the name field can clear. */
  onSave: (name: string) => Promise<boolean>;
  notice: string | null;
}) {
  const [templateName, setTemplateName] = useState("");

  async function save() {
    if (!templateName.trim()) return;
    if (await onSave(templateName.trim())) setTemplateName("");
  }

  return (
    <div className="grid gap-2 rounded-2xl border border-card-edge bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-faint">Templates</p>
      {canPick && templates.length > 0 ? (
        <label className="grid gap-1 text-sm text-ink-soft">
          <span>Start from a template</span>
          <select
            defaultValue=""
            onChange={(e) => onPick(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Choose…
            </option>
            {templates.map((t) => (
              <option key={t.template_id} value={t.template_id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="flex gap-2">
        <input
          aria-label="Template name"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="e.g. Standard DJ package"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <Button type="button" variant="ghost" size="md" onClick={save} disabled={!templateName.trim()}>
          Save template
        </Button>
      </div>
      {notice ? <p className="text-xs text-ink-soft">{notice}</p> : null}
    </div>
  );
}
