import { renderToStaticMarkup } from "react-dom/server";
import { WeekSummary } from "./WeekSummary";

const text = (h: string) => h.replaceAll("&#x27;", "'");
const base = { nickname: "Mia", sessions: 4, minutes: 38, mastered: ["Counting to 20", "Adding within 5"], currentSkill: "Adding within 10", stuck: ["counting on from the bigger number"] };
it("shows sessions, minutes, day cubes, mastered cubes and the current skill", () => {
  const html = text(renderToStaticMarkup(<WeekSummary nickname="Mia" week={base} playedDays={["2026-10-05","2026-10-06","2026-10-08","2026-10-10"]} />));
  expect(html).toContain("4 sessions, 38 minutes");
  expect(html).toContain('aria-label="Played 4 of the last 7 days"');
  expect(html).toContain("Mastered: Counting to 20, Adding within 5");
  expect(html).toContain("Working on <b>Adding within 10</b>. Tricky part: counting on from the bigger number.");
});
it("uses singular forms", () => {
  const html = text(renderToStaticMarkup(<WeekSummary nickname="Mia" week={{ ...base, sessions: 1, minutes: 1 }} playedDays={["2026-10-10"]} />));
  expect(html).toContain("1 session, 1 minute"); expect(html).toContain('aria-label="Played 1 of the last 7 days"');
});
it("shows the empty week sentence and no cubes when nothing was played", () => {
  const html = text(renderToStaticMarkup(<WeekSummary nickname="Mia" week={{ ...base, sessions: 0, minutes: 0, mastered: [], stuck: [] }} playedDays={[]} />));
  expect(html).toContain("Mia hasn't played this week. Hand over the tablet and tap Mia to start.");
  expect(html).not.toContain("data-cube");
});
it("omits the mastered line when nothing new, and the tricky part when nothing is stuck", () => {
  const html = text(renderToStaticMarkup(<WeekSummary nickname="Mia" week={{ ...base, mastered: [], stuck: [] }} playedDays={["2026-10-10"]} />));
  expect(html).not.toContain("Mastered:"); expect(html).not.toContain("Tricky part");
  expect(html).toContain("Working on <b>Adding within 10</b>.");
});
it("says everything is mastered when currentSkill is null", () => {
  const html = text(renderToStaticMarkup(<WeekSummary nickname="Mia" week={{ ...base, currentSkill: null, stuck: [] }} playedDays={["2026-10-10"]} />));
  expect(html).toContain("Everything so far is mastered."); expect(html).not.toContain("Working on");
});
it("escapes skill names", () => {
  const html = renderToStaticMarkup(<WeekSummary nickname="Mia" week={{ ...base, currentSkill: "<i>x</i>" }} playedDays={["2026-10-10"]} />);
  expect(html).not.toContain("<i>x</i>");
});
