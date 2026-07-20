"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { LinkButton } from "@/components/ui";

// Placeholder until Phase C wires up the group chat (conversations list +
// per-conversation WebSocket). The tab exists so the app mirrors iOS; this
// screen is honest about what's coming rather than faking an inbox.
export default function MessagesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/messages");
  }, [loading, user, router]);

  if (loading || !user) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  return (
    <div className="mx-auto w-[min(560px,100%-2rem)] py-20 text-center">
      <span className="eyebrow">Messages</span>
      <h1 className="serif mt-3 text-3xl text-maroon dark:text-gold">
        Group chat is coming to the web
      </h1>
      <p className="mx-auto mt-3 max-w-[42ch] text-ink-soft">
        Each confirmed bundle opens a group chat with your vendors. It&apos;s live
        in the app today and coming here soon. For now you can manage everything
        else — planning, bookings, and payments — right here.
      </p>
      <LinkButton href="/bundles" className="mt-6">
        Go to your bundles
      </LinkButton>
    </div>
  );
}
