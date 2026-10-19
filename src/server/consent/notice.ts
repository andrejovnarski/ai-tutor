export const PRIVACY_NOTICE_VERSION = "2026-10-19-draft";

export const DRAFT_BANNER = "Draft — pending legal review.";

export const NOTICE_SUMMARY =
  "We keep only what the tutor needs to teach your child. We never sell data, show ads, or use trackers.";

export type NoticeSection = { heading: string; body: string[] };

export const NOTICE_SECTIONS: NoticeSection[] = [
  {
    heading: "What we keep about your child",
    body: [
      "Nickname, grade and avatar.",
      "Answers to practice problems, how well each skill is going, and how your child likes to learn.",
      "If your child says something that worries us, the line they said, for 30 days.",
      "Rewards (cubes, levels and stickers) are worked out from your child's answers. We don't keep anything extra for them.",
    ],
  },
  {
    heading: "What we never keep",
    body: ["Last name, photo, school, birthday, location, audio, or any other free-speech text."],
  },
  {
    heading: "Who helps us run the app",
    body: [
      "Supabase (database), Vercel (hosting), Anthropic (AI), Microsoft Azure (speech), Resend (email), and Stripe (card check).",
      "When your child talks to the tutor, the recording goes to Microsoft Azure to be turned into text, and is not kept. Your child's name is never sent.",
      "Each is under a data processing agreement and may not train on our data.",
      "We do not use ads, sell data, or load third-party trackers or analytics in the kid area.",
    ],
  },
  {
    heading: "How the card check works",
    body: [
      "Stripe checks that your card is real, which tells us an adult is signing up. You are not charged, and we do not keep the card.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "See all of your child's data at any time: download it from your child's page.",
      "Delete a kid or your whole account. All data is removed within 30 days.",
      "Revoke consent, which means deleting.",
    ],
  },
  {
    heading: "How long we keep it",
    body: ["While the account is active. After 12 months without use we warn you by email, then delete."],
  },
  {
    heading: "Not a crisis service",
    body: [
      "This app is not a crisis service. If your child says something that sounds hard, the app asks them to tell a grown-up they trust and emails you right away.",
    ],
  },
];
