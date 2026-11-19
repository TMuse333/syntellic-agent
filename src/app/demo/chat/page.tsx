"use client";

/**
 * /demo/chat — try the chatbot as a visitor (mobile-friendly).
 * ?account=demo  &post=post-demo-001 (simulates arriving from that post)
 */
import { useEffect, useRef, useState } from "react";

type Msg = { role: "bot" | "you"; text: string };
type Quick = { label: string; value: string };

export default function DemoChat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conv, setConv] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [quick, setQuick] = useState<Quick[]>([]);
  const params = useRef<{ account: string; post?: string; session: string } | null>(null);
  const end = useRef<HTMLDivElement>(null);

  async function send(message?: string, label?: string) {
    if (!params.current) return;
    setBusy(true);
    setQuick([]);
    if (message) setMsgs((m) => [...m, { role: "you", text: label ?? message }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: params.current.account,
          sessionId: params.current.session,
          conversationId: conv ?? undefined,
          entryPostId: conv ? undefined : params.current.post,
          utm: conv ? undefined : params.current.post ? { source: "instagram", medium: "post_link", content: params.current.post } : undefined,
          message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConv(data.conversationId);
      setMsgs((m) => [...m, { role: "bot", text: data.reply }]);
      setQuick(data.quickReplies ?? []);
      setStatus(data.booked ? `Booked: ${data.booked.kind} · ${data.booked.label}` : `step: ${data.step}`);
    } catch (e) {
      setMsgs((m) => [...m, { role: "bot", text: `(error: ${e instanceof Error ? e.message : "failed"})` }]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    params.current = {
      account: q.get("account") || "demo",
      post: q.get("post") || undefined,
      session: `sess_${Math.random().toString(36).slice(2, 10)}`,
    };
    send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col bg-background">
      <header className="border-b px-4 py-3">
        <p className="text-sm font-semibold">Chat preview</p>
        <p className="text-xs text-muted-foreground">{status || "connecting…"}</p>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "you" ? "flex justify-end" : "flex justify-start"}>
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === "you" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}
        {busy && <p className="text-xs text-muted-foreground">typing…</p>}
        {!busy && quick.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {quick.map((q) => (
              <button
                key={q.value}
                type="button"
                onClick={() => send(q.value, q.label)}
                className="rounded-full border border-primary px-3 py-1.5 text-left text-sm text-primary hover:bg-primary hover:text-primary-foreground"
              >
                {q.label}
              </button>
            ))}
          </div>
        )}
        <div ref={end} />
      </div>
      <form
        className="flex gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const t = input.trim();
          if (!t || busy) return;
          setInput("");
          send(t);
        }}
      >
        <input
          className="flex-1 rounded-full border px-4 py-2 text-base outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message"
          autoComplete="off"
        />
        <button className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </main>
  );
}
