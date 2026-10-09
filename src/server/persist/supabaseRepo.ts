import type { SupabaseClient } from "@supabase/supabase-js";
import type { KidState } from "../../domain/kid/types";
import type { Session, Writes } from "../../domain/session/types";
import type { OpenSession, Repo } from "./repo";
import { attemptRow, kidStateFromRows, skillRow, styleRow, type KidRow, type SkillRow, type StyleRow } from "./rows";

const UNIQUE_VIOLATION = "23505";
const INVALID_TEXT_REPRESENTATION = "22P02";

type SessionRow = { id: string; version: number; state: Session };
const open = (r: SessionRow): OpenSession => ({ id: r.id, version: r.version, state: r.state });

/** Repo over the caller's Supabase client, so RLS limits every read and write to their own family. */
export class SupabaseRepo implements Repo {
  constructor(private readonly db: SupabaseClient) {}

  async loadKid(kidId: string): Promise<KidState | null> {
    const kid = await this.db.from("kids").select("id, grade, age_band, placed").eq("id", kidId).maybeSingle();
    // A malformed id can match no kid.
    if (kid.error?.code === INVALID_TEXT_REPRESENTATION) return null;
    if (kid.error) throw kid.error;
    if (!kid.data) return null;
    const [skills, styles] = await Promise.all([
      this.db.from("skill_state").select("*").eq("kid_id", kidId),
      this.db.from("style_stats").select("*").eq("kid_id", kidId),
    ]);
    if (skills.error) throw skills.error;
    if (styles.error) throw styles.error;
    return kidStateFromRows(kid.data as KidRow, skills.data as SkillRow[], styles.data as StyleRow[]);
  }

  async openSession(kidId: string): Promise<OpenSession | null> {
    const { data, error } = await this.db.from("sessions").select("id, version, state")
      .eq("kid_id", kidId).is("ended_at", null).maybeSingle();
    if (error) throw error;
    return data ? open(data as SessionRow) : null;
  }

  async createSession(kidId: string, state: Session): Promise<OpenSession | null> {
    const { data, error } = await this.db.from("sessions").insert({ kid_id: kidId, state })
      .select("id, version, state").single();
    if (error?.code === UNIQUE_VIOLATION) return null;
    if (error) throw error;
    return open(data as SessionRow);
  }

  async saveStep(s: OpenSession, next: Session, ended: boolean, writes: Writes | null): Promise<number> {
    const { data, error } = await this.db.rpc("save_step", {
      p_session: s.id, p_version: s.version, p_state: next, p_ended: ended,
      p_attempts: writes ? writes.attempts.map((a) => attemptRow(s.id, a)) : [],
      p_skill_states: writes ? writes.skillStates.map((st) => skillRow(writes.kidId, st)) : [],
      p_style_stats: writes ? writes.styleStats.map((st) => styleRow(writes.kidId, st)) : [],
      p_kid_placed: writes?.kidPlaced === true,
    });
    if (error) throw error;
    return data as number;
  }
}
