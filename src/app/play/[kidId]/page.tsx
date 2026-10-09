"use client";
// Minimal play screen: proves the loop end to end. Plan 5 replaces it.
import { use, useCallback, useEffect, useRef, useState } from "react";
import type { PublicTurn } from "@/server/publicTurn";

type Step = { version: number; turn: PublicTurn };
type Reply = { version: number; next: PublicTurn; feedback: { then: "retry" | "next"; reveal: boolean; result: { kind: string } }; revealed?: number };

const big = { fontSize: 32, minWidth: 96, minHeight: 72, margin: 8, borderRadius: 16 } as const;

export default function PlayPage({ params }: { params: Promise<{ kidId: string }> }) {
  const { kidId } = use(params);
  const [step, setStep] = useState<Step | null>(null);
  const [message, setMessage] = useState("");
  const [typed, setTyped] = useState("");
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/kids/${kidId}/turn`, { method: "POST" })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const s = (await r.json()) as Step;
        if (live) setStep(s);
      })
      .catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [kidId]);

  const submit = useCallback(async (given: number) => {
    if (busy.current || !step) return;
    busy.current = true;
    try {
      const r = await fetch(`/api/kids/${kidId}/answer`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: step.version, given }),
      });
      if (r.status === 409) {
        const s = (await r.json()) as Step;
        setStep(s);
        setMessage("");
      } else if (r.ok) {
        const b = (await r.json()) as Reply;
        setStep({ version: b.version, turn: b.next });
        const f = b.feedback;
        setMessage(
          f.result.kind === "correct" ? "Correct!"
            : f.then === "retry" ? "Try again"
            : f.reveal && b.revealed !== undefined ? `The answer is ${b.revealed}`
            : "Let's try the next one",
        );
      } else setFailed(true);
      setTyped("");
    } finally {
      busy.current = false;
    }
  }, [kidId, step]);

  if (failed) return <main style={{ padding: 24 }}><p role="alert">Something went wrong.</p></main>;
  if (!step) return <main style={{ padding: 24 }}><p>Loading...</p></main>;
  const t = step.turn;
  if (t.kind === "end") {
    return <main style={{ padding: 24 }}><h1>All done!</h1><p>You did {t.summary.problems} problems.</p></main>;
  }
  return (
    <main style={{ padding: 24 }} data-version={step.version}>
      {message && <p role="status" data-testid="feedback" style={{ fontSize: 24 }}>{message}</p>}
      <h1 data-testid="say" style={{ fontSize: 36 }}>{t.prompt.say}</h1>
      {t.input === "number-pad" || !t.choices ? (
        <div>
          <p aria-live="polite" style={{ fontSize: 40, minHeight: 56 }}>{typed}</p>
          {"0123456789".split("").map((d) => (
            <button key={d} style={big} onClick={() => setTyped((v) => (v + d).slice(0, 6))}>{d}</button>
          ))}
          <button style={big} onClick={() => setTyped((v) => v.slice(0, -1))}>Back</button>
          <button style={big} disabled={typed === ""} onClick={() => submit(Number(typed))}>Go</button>
        </div>
      ) : (
        <div data-testid="choices">
          {t.choices.map((c, i) => (
            <button key={`${c}-${i}`} style={big} onClick={() => submit(c)}>{c}</button>
          ))}
        </div>
      )}
    </main>
  );
}
