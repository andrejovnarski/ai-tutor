"use client";
import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  initialPlayState, isGone, playReducer, runRequest,
  type AnswerBody, type FetchFn, type PlayEvent, type SleepFn, type StepBody, replyLine,
} from "./playMachine";

/** Resolves after `ms`, or at once when `signal` aborts (runRequest then stops). */
const realSleep: SleepFn = (ms, signal) => new Promise((resolve) => {
  if (signal?.aborted) return resolve();
  const t = setTimeout(done, ms);
  function done() { clearTimeout(t); signal?.removeEventListener("abort", done); resolve(); }
  signal?.addEventListener("abort", done, { once: true });
});

export function usePlay(kidId: string, deps?: { fetch?: FetchFn; sleep?: SleepFn }) {
  const [state, dispatch] = useReducer(playReducer, initialPlayState);
  const fetchFn: FetchFn = deps?.fetch ?? ((u, i) => fetch(u, i));
  const sleep = deps?.sleep ?? realSleep;
  const live = useRef(true);
  const gen = useRef(0); // bumped by every new load; a response from an older generation is dropped
  const busy = useRef(false); // same-tick double-tap guard
  // Aborted on unmount ("I'm done for now", Back to kids): an in-flight request and its backoff stop, so an answer
  // is never posted after the kid has left (spec §9: quitting mid-problem does not count the attempt).
  const abort = useRef<AbortController>(new AbortController());
  const stateRef = useRef(state);
  stateRef.current = state;
  const fetchRef = useRef(fetchFn); fetchRef.current = fetchFn;
  const sleepRef = useRef(sleep); sleepRef.current = sleep;

  const emit = useCallback((g: number, ev: PlayEvent) => {
    if (live.current && g === gen.current) dispatch(ev);
  }, []);

  const load = useCallback(async () => {
    const g = ++gen.current;
    busy.current = false;
    dispatch({ type: "load" });
    const r = await runRequest(fetchRef.current, sleepRef.current, {
      url: `/api/kids/${kidId}/turn`, init: { method: "POST" },
      onRetry: (attempt) => emit(g, { type: "retrying", attempt }),
      signal: abort.current.signal,
    });
    if (r === "aborted") return;
    if (r !== "offline" && isGone(r.status)) return emit(g, { type: "gone" });
    if (r === "offline" || !r.ok) return emit(g, { type: "offline" });
    try {
      emit(g, { type: "loaded", body: (await r.json()) as StepBody });
    } catch {
      emit(g, { type: "offline" });
    }
  }, [kidId, emit]);

  useEffect(() => {
    live.current = true;
    if (abort.current.signal.aborted) abort.current = new AbortController(); // remount (React strict mode)
    void load();
    return () => { live.current = false; abort.current.abort(); };
  }, [load]);

  const answer = useCallback(async (given: number) => {
    const s = stateRef.current;
    if (busy.current || s.phase !== "problem" || s.version === undefined) return;
    busy.current = true;
    const g = gen.current;
    dispatch({ type: "send" });
    try {
      const r = await runRequest(fetchRef.current, sleepRef.current, {
        url: `/api/kids/${kidId}/answer`,
        init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: s.version, given }) },
        onRetry: (attempt) => emit(g, { type: "retrying", attempt }),
        signal: abort.current.signal,
      });
      if (r === "aborted") return;
      if (r === "offline") return emit(g, { type: "offline" });
      if (isGone(r.status)) return emit(g, { type: "gone" });
      if (r.status === 409) return emit(g, { type: "conflict", body: (await r.json()) as StepBody });
      if (!r.ok) return emit(g, { type: "offline" });
      emit(g, { type: "answered", body: (await r.json()) as AnswerBody });
    } catch {
      emit(g, { type: "offline" });
    } finally {
      if (g === gen.current) busy.current = false;
    }
  }, [kidId, emit]);

  const retry = useCallback(() => { void load(); }, [load]);

  /** Something the kid said that isn't a number: one try at /say (no retries). A failure is silent, because the
   * problem is still on screen; a reply that comes back after the problem moved on is dropped. */
  const say = useCallback(async (text: string) => {
    const g = gen.current;
    const v = stateRef.current.version;
    try {
      const r = await fetchRef.current(`/api/kids/${kidId}/say`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }),
        signal: abort.current.signal,
      });
      // Read the body on any status: a 5xx from a distress line whose storing failed still carries the reply.
      const line = replyLine(await r.json().catch(() => null));
      if (!line || stateRef.current.version !== v) return;
      emit(g, { type: "said", line });
    } catch {
      // offline or aborted: the kid can still answer
    }
  }, [kidId, emit]);

  return { state, answer, retry, say };
}
