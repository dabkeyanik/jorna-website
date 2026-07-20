"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { getConversationMessages, sendConversationMessage } from "@/lib/jorna";
import { openConversationSocket } from "@/lib/chat";
import type { GroupMessage } from "@/lib/types";

function clockTime(iso: string): string {
  const t = Date.parse(iso.endsWith("Z") || /[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function ConversationInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const conversationId = params.get("id");

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [live, setLive] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?next=/conversation${conversationId ? `?id=${conversationId}` : ""}`);
    }
  }, [authLoading, user, router, conversationId]);

  // Merge a message in by id — the socket echo, the POST response, and the poll
  // all converge on the same message_id without duplicating.
  const upsert = useCallback((incoming: GroupMessage | GroupMessage[]) => {
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.message_id, m]));
      for (const m of Array.isArray(incoming) ? incoming : [incoming]) byId.set(m.message_id, m);
      return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const res = await getConversationMessages(conversationId, { limit: 100 });
      upsert(res.messages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load this conversation.");
    } finally {
      setLoading(false);
    }
  }, [conversationId, upsert]);

  // Initial load, live socket, and a 5s poll fallback.
  useEffect(() => {
    if (!conversationId || !user) return;
    void loadMessages();

    const socket = openConversationSocket(conversationId, {
      onMessage: upsert,
      onOpen: () => setLive(true),
      onClose: () => setLive(false),
    });
    const poll = setInterval(loadMessages, 5000);

    return () => {
      socket.close();
      clearInterval(poll);
    };
  }, [conversationId, user, loadMessages, upsert]);

  // Autoscroll only if the user is already near the bottom (don't yank them up
  // from reading history).
  useEffect(() => {
    if (atBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const content = draft.trim();
    if (!content || !conversationId) return;
    setSending(true);
    setError(null);
    try {
      const msg = await sendConversationMessage(conversationId, content);
      upsert(msg);
      setDraft("");
      atBottomRef.current = true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  if (authLoading || !user || loading) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] w-[min(680px,100%-2rem)] flex-col py-4">
      <div className="flex items-center justify-between gap-3 pb-3">
        <Link href="/messages" className="text-sm text-ink-soft hover:text-ink">
          ← Messages
        </Link>
        <span
          className={`text-xs ${live ? "text-green" : "text-ink-faint"}`}
          title={live ? "Live" : "Reconnecting…"}
        >
          ● {live ? "Live" : "Offline"}
        </span>
      </div>

      <div
        className="flex-1 overflow-y-auto rounded-2xl border border-card-edge bg-panel p-4"
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottomRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-faint">
            No messages yet — say hello.
          </p>
        ) : (
          <div className="grid gap-2.5">
            {messages.map((m) => {
              const mine = m.sender_id === user.user_id;
              return (
                <div
                  key={m.message_id}
                  className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                >
                  {!mine && m.sender_name ? (
                    <span className="mb-0.5 px-1 text-[0.7rem] text-ink-faint">
                      {m.sender_name}
                    </span>
                  ) : null}
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                      mine
                        ? "bg-maroon text-ground dark:bg-gold dark:text-[#2A0C19]"
                        : "bg-card text-ink"
                    }`}
                  >
                    {m.content}
                  </div>
                  <span className="mt-0.5 px-1 text-[0.65rem] text-ink-faint">
                    {clockTime(m.created_at)}
                  </span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {error ? (
        <p className="mt-2 text-center text-xs text-maroon dark:text-gold">{error}</p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="mt-3 flex items-end gap-2"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder="Message…"
          className="max-h-32 flex-1 resize-none rounded-2xl border border-card-edge bg-ground-2 px-4 py-2.5 text-ink outline-none focus:border-gold"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="rounded-full bg-maroon px-5 py-2.5 font-semibold text-ground transition hover:brightness-110 disabled:opacity-50 dark:bg-gold dark:text-[#2A0C19]"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default function ConversationPage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-ink-soft">Loading…</p>}>
      <ConversationInner />
    </Suspense>
  );
}
