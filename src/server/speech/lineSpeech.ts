/** What the browser needs to speak a line: the nickname-free text, a token for /speak, and a pre-rendered clip if one exists. */
export type LineSpeech = { text: string; token: string; clip?: string };
