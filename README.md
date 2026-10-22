# CW Contact

CW Contact is a browser-based practice station for a first amateur-radio Morse code (CW) conversation. The first release guides one short, scripted contact and advances only after the learner correctly keys each reply.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the printed local URL, press **Start**, and key with the keyboard:

- **Straight key**: hold Arrow Down (↓). Short for dit, long for dah.
- **Paddles**: Arrow Left (←) sends dits, Arrow Right (→) sends dahs. Hold both to alternate.

Both are always available; use whichever you like. Left-handed? Turn on **Swap paddles** to send dahs with ← and dits with →.
- **Backspace** undoes the last letter; **Escape** stops a playing message, or clears when nothing is playing.
- **-** and **=** change the speed by 1 WPM.
- On touch screens, use the on-screen key buttons.

End each message with **K** (or **SK** to sign off) to send it. The station replies only when the message matches the target text.

Choose **Practice** in the header to key freely and watch the decoder without a scripted contact.

Not sure what speed to use? Press **Listen** to hear your next message (or PARIS) at the selected speed, or **Detect my speed** and key SOS to set the speed from your rhythm. **Follow my speed** (on by default) keeps adjusting to your keying, and the pause meter shows when a pause becomes a letter or word gap.

No account or external service is needed.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm test` | Run unit tests (decoder, keyer, answer checking, script, contact flow) |
| `npm run typecheck` | Type-check the source and tests |
| `npm run build` | Type-check and build a static site into `dist/` |
| `npm run preview` | Serve the built site |

## Container image

The `Dockerfile` tests and builds the site with the official `node:22-alpine` image, then serves `dist/` from the official `nginx:alpine` image on port 8080 (config in `docker/nginx.conf`). It runs as UID 10001 with a read-only root filesystem; nginx writes only to `/tmp` and logs to stdout and stderr.

```sh
docker build -t cwchat .
docker run --rm --read-only --tmpfs /tmp --user 10001 --cap-drop ALL -p 8080:8080 cwchat
```

## Project layout

- `conversations/` — one JSON file per scripted conversation (see below).
- `src/morse.ts` — Morse table, the SK prosign, and standard timing.
- `src/decoder.ts` — turns key timing into letters and words.
- `src/keyer.ts` — iambic mode A paddle keyer.
- `src/check.ts` — compares a sent message with its target and explains mistakes.
- `src/conversations.ts` — loads and validates the conversation files.
- `src/randoms.ts` — value lists and seeded picking for `{RANDOM_…}` placeholders.
- `src/script.ts` — fills in the learner's call sign, the glossary, and call sign rules.
- `src/session.ts` — contact state: keying, sending on K or SK, and turn progression.
- `src/callsign.ts` — click-to-edit call sign in the header.
- `src/input.ts` — maps arrow keys to the straight key and paddles (with swap).
- `src/speed.ts` — estimates keying speed from one SOS.
- `src/reveal.ts` — times the letter-by-letter reveal of station messages.
- `src/latency.ts` — explains noticeable audio output delay.
- `src/render.ts` — small DOM helpers.
- `src/audio.ts` — sidetone and station audio (Web Audio).
- `src/main.ts`, `index.html`, `src/styles.css` — the interface.

## Adding a conversation

Add a JSON file to `conversations/` with an `id`, `order`, `title`, `description`, `station` call sign, and `lines`. Each line has a `speaker` (`station` or `learner`), and the exact `sent` text (use `{MYCALL}` and `{MYNAME}` for the learner's call sign and name).

Random placeholders vary each contact: `{RANDOM_NAME}`, `{RANDOM_QTH}`, `{RANDOM_STATE}`, `{RANDOM_RST}`, `{RANDOM_WX}`, `{RANDOM_TEMP}`, `{RANDOM_PWR}`, `{RANDOM_AGE}`, `{RANDOM_YRS}` (years licensed), and `{RANDOM_PARK}`. The same token gets the same value everywhere in a contact (including replays and call sign or name changes), and a numbered token such as `{RANDOM_WX_2}` gets a different value of the same kind. Values are drawn again on Start, Restart, and Next. The value lists are in `src/randoms.ts`. Nothing else: the words chart explains the terms, and unknown fields are rejected. `npm test` validates every file: speakers alternate, every message ends with K or BK except the last (SK), `{MYCALL}` and the station call each appear at least once, and any CW abbreviation used needs a glossary entry in `src/script.ts`.

## Planning documents

- [First-release specification](docs/MVP.md) — user flow, input and decoding behavior, completion rules, and acceptance criteria.
- [Future feature roadmap](docs/ROADMAP.md) — learning aids, richer conversations, and radio simulation ideas.
- [Research notes](docs/RESEARCH.md) — sources for the beginner contact format and operating terms.
