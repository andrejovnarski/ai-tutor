import { parseSpokenNumber } from "./parseSpoken";

it.each([
  ["12", 12], ["twelve", 12], ["Twelve.", 12], ["twenty-three", 23], ["twenty three", 23],
  ["seventeen", 17], ["seventy", 70], ["one hundred", 100], ["a hundred", 100], ["hundred", 100],
  ["zero", 0], ["none", 0], ["nothing", 0], ["it's 7", 7], ["um, seven", 7], ["I think it's seven", 7],
  ["a hundred and five", 105], ["six. six!", 6], ["seven seven", 7], ["twelve, twelve", 12],
  ["five, no, six", 6], ["five wait six", 6], ["four actually five", 5], ["three I mean four", 4],
  ["to", 2], ["too", 2], ["for", 4], ["won", 1], ["ate", 8],
] as const)("%s → %s", (text, n) => expect(parseSpokenNumber(text)).toBe(n));

it.each(["", "I don't know", "five or six", "five and six", "banana", "I want to go",
  "five, six", "five… six", "one two", "2 3", "7 + 5", "that one", "the first one", "this one has more"])(
  "%s → null", (text) => expect(parseSpokenNumber(text)).toBeNull());
