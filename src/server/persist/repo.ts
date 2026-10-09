import type { KidState } from "../../domain/kid/types";
import type { Session, Writes } from "../../domain/session/types";
import { attemptRow, kidStateFromRows, skillRow, styleRow, type AttemptRow, type KidRow, type SkillRow, type StyleRow } from "./rows";

export type OpenSession = { id: string; version: number; state: Session };

export interface Repo {
  /** null = not found or not yours. */
  loadKid(kidId: string): Promise<KidState | null>;
  openSession(kidId: string): Promise<OpenSession | null>;
  /** null if the kid already has an open session (a lost create race). */
  createSession(kidId: string, state: Session): Promise<OpenSession | null>;
  /** The new version, or -1 if `s.version` is stale or the session already ended (nothing is written then). */
  saveStep(s: OpenSession, next: Session, ended: boolean, writes: Writes | null): Promise<number>;
}

type StoredSession = { id: string; kidId: string; version: number; state: Session; ended: boolean };
const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** In-memory Repo for tests. Mirrors the SQL: one open session per kid, compare-and-set on version. */
export class MemoryRepo implements Repo {
  private kids = new Map<string, { row: KidRow; skills: Map<string, SkillRow>; styles: Map<string, StyleRow> }>();
  readonly sessions: StoredSession[] = [];
  readonly attempts: AttemptRow[] = [];

  addKid(kid: KidState): void {
    const row: KidRow = { id: kid.kidId, grade: kid.grade, age_band: kid.ageBand, placed: kid.placed };
    const skills = new Map(Object.values(kid.skills).map((s) => [s.skillId, skillRow(kid.kidId, s)]));
    const styles = new Map(Object.values(kid.styles).map((s) => [s.style, styleRow(kid.kidId, s)]));
    this.kids.set(kid.kidId, { row, skills, styles });
  }

  async loadKid(kidId: string): Promise<KidState | null> {
    const k = this.kids.get(kidId);
    return k ? kidStateFromRows(k.row, [...k.skills.values()], [...k.styles.values()]) : null;
  }

  private open(kidId: string) {
    return this.sessions.find((s) => s.kidId === kidId && !s.ended);
  }

  async openSession(kidId: string): Promise<OpenSession | null> {
    const s = this.kids.has(kidId) ? this.open(kidId) : undefined;
    return s ? { id: s.id, version: s.version, state: copy(s.state) } : null;
  }

  async createSession(kidId: string, state: Session): Promise<OpenSession | null> {
    if (!this.kids.has(kidId)) throw new Error("unknown kid");
    if (this.open(kidId)) return null;
    const s: StoredSession = { id: `session-${this.sessions.length + 1}`, kidId, version: 0, state: copy(state), ended: false };
    this.sessions.push(s);
    return { id: s.id, version: 0, state: copy(state) };
  }

  async saveStep(s: OpenSession, next: Session, ended: boolean, writes: Writes | null): Promise<number> {
    const stored = this.sessions.find((x) => x.id === s.id);
    if (!stored || stored.ended || stored.version !== s.version) return -1;
    stored.version += 1;
    stored.state = copy(next);
    if (ended) stored.ended = true;
    if (writes) this.apply(s.id, writes);
    return stored.version;
  }

  private apply(sessionId: string, w: Writes): void {
    const k = this.kids.get(w.kidId)!;
    for (const a of w.attempts) this.attempts.push(attemptRow(sessionId, a));
    for (const st of w.skillStates) k.skills.set(st.skillId, skillRow(w.kidId, st));
    for (const st of w.styleStats) k.styles.set(st.style, styleRow(w.kidId, st));
    if (w.kidPlaced) k.row.placed = true;
  }
}
