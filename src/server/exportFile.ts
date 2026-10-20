import type { KidExport } from "./rights";

// The parent's download: every stored row unchanged, indented, with a plain-words guide on top.

function about(name: string) {
  return {
    file: `Everything Brightling AI stores about ${name}, exactly as stored. Times are in UTC. Each part is explained below.`,
    kid: `${name}'s profile: nickname, grade, age band (5-7 or 8-11), avatar, whether the starting check is done (placed), and when the profile was made.`,
    skill_state: `How each skill is going. p_known is our estimate, from 0 to 1, that ${name} knows the skill. level is 1 to 3. attempts, correct_streak and wrong_streak count answers. last_seen is the last practice. placed means the starting check set it. recent_tags are the latest mistake types (null means right). mastered_at is when it was mastered. A recall is two problems on a skill learned before. check_step is how far apart recalls are (0 to 3: 1, 3, 7 or 21 days). check_due is when the next recall is due. remembered_at is when ${name} last remembered the skill.`,
    style_stats: `How ${name} does with each way of showing a problem (number line, blocks, ten frames, stories, drawings): tries, and wins (right answers).`,
    attempts: `Every answer ${name} gave: the session, the skill, the problem (template_id and seed recreate it exactly), level, ${name}'s answer, result (correct, known-mistake, wrong or helped — helped means ${name} tapped Help me; answer is empty then), mistake_tag, the style shown, time_ms (time taken in milliseconds), when (at), which try (1 or 2), and mode (practice, review, recall, check, placement or wind-down).`,
    sessions: `Each time ${name} played: when it started, last changed and ended, and state, the tutor's working notes for that session (problems, right first time, skills mastered, what comes next).`,
    distress_flags: `Things ${name} said that sounded like ${name} might need a grown-up: the words (line), when (at), and when we emailed you (emailed_at). Each is deleted after 30 days.`,
  };
}

export function exportFile(data: KidExport, now: Date): string {
  return JSON.stringify({ about: about(data.kid.nickname), exported_at: now.toISOString(), ...data }, null, 2);
}
