"use client";
import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  initialPlayState, playReducer, runRequest,
  type AnswerBody, type FetchFn, type PlayEvent, type SleepFn, type StepBody,
} from "./playMachine";

const realSleep: SleepFn = (ms) => new Promise((r) => setTimeout(r, ms));

export function usePlay(kidId: string, deps?: { fetch?: FetchFn; sleep?: SleepFn }) {
  const [state, dispatch] = useReducer(playReducer, initialPlayState);
  const fetchFn: FetchFn = deps?.fetch ?? ((u, i) => fetch(u, i));
  const sleep = deps?.sleep ?? realSleep;
  const live = useRef(true);
  const gen = useRef(0); // bumped by every new load; a response from an older generation is dropped
  const busy = useRef(false); // same-tick double-tap guard
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
    });
    if (r === "offline" || !r.ok) return emit(g, { type: "offline" });
    try {
      emit(g, { type: "loaded", body: (await r.json()) as StepBody });
    } catch {
      emit(g, { type: "offline" });
    }
  }, [kidId, emit]);

  useEffect(() => {
    live.current = true;
    void load();
    return () => { live.current = false; };
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
      });
      if (r === "offline") return emit(g, { type: "offline" });
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

  return { state, answer, retry };
}
