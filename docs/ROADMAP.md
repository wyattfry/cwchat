# Future feature roadmap

The first release is the guided contact in [MVP.md](MVP.md). These ideas extend it after the basic keying, decoding, and turn progression are reliable.

## Phase 2: learning aids

- **Letter and number chart:** searchable Morse reference, with a playable example for each character.
- **Q-code and shorthand chart:** concise meanings and examples for CQ, DE, QTH, QRS, RST, 73, and other terms introduced in lessons.
- **Compose replies from copy:** after Copy by ear (now built as a Receiving setting), hide the reply target so the learner builds their reply from what they copied, such as the operator's name and location.
- **Repeat request:** teach the learner to send “PSE AGN” (please send again); the bot repeats its last message. “QRS” can request a slower repeat.

## Phase 3: conversation progression

- **Difficulty tree:** start with a prompted exchange and on-screen decoding of station messages, then switch to copying station messages by ear, remove the exact target text, add alternative valid replies, and eventually allow freer exchanges.
- **Speed progression:** separate bot receive speed from learner keying speed. Increase each gradually and let learners slow down when needed.
- **Vocabulary progression:** add weather, rig, antenna, power, QSL, and longer closing exchanges after call signs and basic reports are comfortable.
- **Multiple bot personalities:** vary names, locations, signal reports, phrasing, and timing while keeping responses internally consistent.

## Phase 4: radio simulation

- **VFO tuner:** scroll or drag to tune across a simulated band. Include a precise accessible alternative for keyboard and touch users.
- **Stations on frequencies:** place different bots at different points on the dial; tuning to one reveals its call and conversation.
- **Signal environment:** add adjustable band noise, fading, and interference. Keep training text and audio accessible even when the signal is challenging.
- **Pitch while tuning:** shift received tone and level as the learner moves through a station's signal. Keep sidetone independent from received pitch.

## Design notes

- Favor common approaches used by established CW trainers and decoders (for example adaptive dit/dah tracking, PARIS-based speed, Farnsworth spacing) over novel mechanisms.
- Preserve the learner's control over pace. A bot response should follow a valid learner transmission, not a timer.
- Keep a text path through every lesson so hearing or audio-device limitations do not block practice.
- When prompts become less explicit, accept equivalent operating phrases rather than one exact sentence.
- Treat realistic radio effects as adjustable difficulty, not as a required obstacle in the beginner lesson.
