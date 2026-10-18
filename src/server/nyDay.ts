// "Today" across the app is the New York calendar date. No server-only import, so unit tests can use it directly.
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });

/** Calendar date (YYYY-MM-DD) in New York of the instant `ms`. */
export const nyDay = (ms: number): string => fmt.format(ms);
