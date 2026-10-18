# Brightling AI: brief for privacy review (COPPA)

Prepared 2026-10-10 for a COPPA-experienced lawyer, before a pilot with about 10 US families. Written by the product owner; not legal advice. The questions we need answered are at the end.

## The product

- An adaptive math tutor for children aged 5 to 11, used on a tablet at home.
- A tutor character, Nova, gives problems and short spoken or written lines.
- The parent signs up and gives consent. Children never create accounts or log in; the parent picks the child's avatar on the tablet.
- The pilot is free. There are no ads, no data sales, and no third-party trackers or analytics.

## Sign-up and consent flow

1. The parent enters their email address and gets a sign-in link.
2. The parent sets a parent PIN, which guards the parent area on a shared tablet.
3. The parent reads the privacy notice (the current draft is attached below).
4. **Consent method:** a Stripe Checkout card check in "setup" mode.
   - The card is verified but **not charged**.
   - The card is detached right after the check, so we keep no card, and we store no card details ourselves.
   - We record the consent time, the notice version, and the Stripe session id.
5. Only after consent can the parent add a child: nickname, grade and avatar.

## Data we collect about the child

| Data | Why | How long |
|---|---|---|
| Nickname, grade, avatar | Show the right child and the right level | While the account is active |
| Answers to problems, skill estimates, which styles help | Adapt the teaching; weekly report to the parent | While the account is active |
| A line the child said that matched a distress phrase | Alert the parent | 30 days |

We do **not** collect last name, photo, school, birthday, location, or contact details of the child. We do not keep audio or anything else the child says.

## Where data goes (vendors)

| Vendor | Role | What it receives |
|---|---|---|
| Supabase (US) | Database, parent sign-in | Everything in the table above; the parent's email address |
| Vercel (US) | Hosting | Requests pass through; no separate storage |
| Resend | Email | The parent's email address, the weekly report and distress alerts (these include the child's nickname) |
| Stripe | Consent card check | The parent's card details, entered on Stripe's page. We send Stripe only an internal parent id |
| Microsoft Azure AI Speech (US region), only if speech is turned on | Speech to text and text to speech | **The child's voice recording** of each spoken answer (a few seconds), and Nova's lines to be read aloud. The child's name is never sent. Azure is not asked to keep audio |
| Anthropic (Claude), **off for the pilot** | Writes Nova's lines | Only a description of the turn (skill, event, age band). Never the name, never audio |

Each vendor is meant to be under a data processing agreement that forbids training on our data. We will confirm each agreement before the pilot.

## Speech

- **When the child speaks:**
  - The tablet records up to 6 seconds after the child taps the mic.
  - The recording is sent to our server, which passes it to Azure for transcription.
  - We hold the recording only in memory and keep only the resulting number as the child's answer.
- **Text that isn't a number:**
  - It is checked against the distress list.
  - If it matches, it is stored as in the distress section below.
  - If it doesn't match, it is discarded.
- **Hearing Nova:** Nova's lines are read aloud by Azure, or from pre-recorded clips. The child's name is removed from anything sent for speaking.
- **The pilot can run without speech** if needed. Without it, children aged 5 to 7, who can't read well yet, would need a parent to read along.

## Distress alerts

- **Matching:** if a child's spoken or typed words match a phrase on the list, the following happens:
  - the app shows and says: "That sounds hard. Please tell a grown-up you trust."
  - the parent is emailed right away with the exact line and the time
  - the email says the app is not a crisis service and gives 911 and 988
- **The draft list:** "hurt myself", "kill myself", "want to die", "nobody loves me", "hits me", "hit me", "touches me", "scared at home", "run away", "hate myself".
- **Retention:** the line is kept for 30 days, then deleted.

## Parent rights and retention

- **In the parent area, a parent can:**
  - see and export all of a child's data
  - delete a child
  - delete the whole account
- **Revoking consent:** this means deleting.
- **Inactive accounts:** after 12 months of inactivity, we email a warning and delete the account 30 days later unless the parent signs in.

## Questions for you

1. **Consent method.** Does a no-charge card verification (Stripe setup mode, card detached afterwards) count as verifiable parental consent? We understand that the FTC's listed method involves a monetary transaction. If it doesn't count, which method do you recommend for a small pilot (for example a $0.50 charge, refunded or not, or signed form, or another method)?
2. **Voice recordings.**
   - Does the FTC's policy on audio used only as a replacement for written words cover our speech use?
   - Do we need to say anything more in the notice, or get a separate consent?
   - Is Azure's processing acceptable as described?
3. **2025 COPPA Rule amendments.** Do we need any of the following, and what should each contain?
   - a written data retention policy
   - a written information security program
   - separate consent for disclosure to vendors
4. **Privacy notice.**
   - Please review the attached draft.
   - It is currently reachable only after sign-in. Does it need a public link, for example on the home page and before sign-up?
   - Do we need a direct notice emailed to the parent?
5. **Distress list and alert.**
   - Please review the phrase list.
   - Is emailing the exact line to the parent appropriate?
   - Do we have any duty beyond telling the parent?
6. **Weekly report email.** It includes the child's nickname and progress. Is that fine over email?
7. **Pilot terms.** Do we need terms of service or a pilot agreement with the families?
8. **Anything else** we should do before the first family signs up.

## Attached: the privacy notice (draft 2026-10-10)

The notice is shown in the app at `/parent/privacy`. It opens with "We keep only what the tutor needs to teach your child. We never sell data, show ads, or use trackers." Then:

**What we keep about your child**
- Nickname, grade and avatar.
- Answers to practice problems, how well each skill is going, and how your child likes to learn.
- If your child says something that worries us, the line they said, for 30 days.

**What we never keep**
- Last name, photo, school, birthday, location, audio, or any other free-speech text.

**Who helps us run the app**
- Supabase (database), Vercel (hosting), Anthropic (AI), Microsoft Azure (speech), Resend (email), and Stripe (card check).
- When your child talks to the tutor, the recording goes to Microsoft Azure to be turned into text, and is not kept. Your child's name is never sent.
- Each is under a data processing agreement and may not train on our data.
- We do not use ads, sell data, or load third-party trackers or analytics in the kid area.

**How the card check works**
- Stripe checks that your card is real, which tells us an adult is signing up. You are not charged, and we do not keep the card.

**Your rights**
- See all of your child's data at any time.
- Delete a kid or your whole account. All data is removed within 30 days.
- Revoke consent, which means deleting.

**How long we keep it**
- While the account is active. After 12 months without use we warn you by email, then delete.

**Not a crisis service**
- This app is not a crisis service. If your child says something that sounds hard, the app asks them to tell a grown-up they trust and emails you right away.
