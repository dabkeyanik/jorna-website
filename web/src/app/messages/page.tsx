"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { listConversations } from "@/lib/jorna";
import type { ConversationSummary } from "@/lib/types";
import { Card, LinkButton } from "@/components/ui";

function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const then = Date.parse(iso.endsWith("Z") || /[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

/**
 * What to call a chat.
 *
 * The backend names them "{bundle} — All Parties", so the fallback is rarely
 * reached — but when it was, every plan's chat read "Group · 4 people" and you
 * had to open them to tell a wedding from a birthday. Naming the people in it
 * is at least about this conversation.
 */
function title(c: ConversationSummary): string {
  if (c.name) return c.name;
  const names = (c.members ?? [])
    .map((m) => m.name?.trim())
    .filter((n): n is string => Boolean(n));
  if (names.length > 0) {
    return names.length <= 3
      ? names.join(", ")
      : `${names.slice(0, 2).join(", ")} and ${names.length - 2} others`;
  }
  const n = c.member_count ?? c.members?.length ?? 0;
  return n ? `Group · ${n} people` : "Conversation";
}

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/messages");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listConversations()
      .then((c) => !cancelled && setConversations(c))
      .catch((err) =>
        !cancelled &&
        setError(err instanceof ApiError ? err.message : "Couldn't load your messages."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading || !user) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  return (
    <div className="mx-auto w-[min(680px,100%-2rem)] py-10">
      <header>
        <span className="eyebrow">Messages</span>
        <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold sm:text-5xl">
          Your chats
        </h1>
        {/* "Confirmed" is the backend's word for a plan that has been sent, and
            it appears nowhere else a client can see — so it named a condition
            nobody could check. */}
        <p className="mt-2 text-ink-soft">
          Every plan you&apos;ve sent has a group chat with its vendors.
        </p>
      </header>

      {error ? (
        <p className="mt-6 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-10 text-center text-ink-soft">Loading…</p>
      ) : conversations.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-ink-soft">
            No chats yet. One opens for each plan when you send it to its
            vendors.
          </p>
          <LinkButton href="/bundles" variant="ghost" className="mt-5">
            Dashboard
          </LinkButton>
        </div>
      ) : (
        <div className="mt-8 grid gap-2">
          {conversations.map((c) => (
            <Link key={c.conversation_id} href={`/conversation?id=${c.conversation_id}`}>
              <Card className="p-4 transition hover:border-gold/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{title(c)}</p>
                    <p className="mt-0.5 truncate text-sm text-ink-soft">
                      {c.last_message?.content ?? "No messages yet"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {timeAgo(c.last_message?.created_at)}
                  </span>
                </div>
                {c.type === "vendors_only" ? (
                  <span className="mt-2 inline-block rounded-full border border-card-edge px-2 py-0.5 text-[0.65rem] text-ink-faint">
                    Vendors only
                  </span>
                ) : null}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
