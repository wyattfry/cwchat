# First-release specification

## Goal

Let a beginner complete one guided CW contact using a keyboard or on-screen key as a Morse key. The learner sees exactly what to send at each turn, hears and reads the other station, and gets immediate feedback from a live decoder. As on the air, the learner's message is sent when they end it with K (or SK); the other station never replies until that message is correct.

## Contact flow

1. The learner presses Start. A simulated station calls CQ and identifies itself.
2. The learner answers with the called station's call sign, their own call sign, and K.
3. The station acknowledges and gives a signal report, operator name, and location.
4. The learner returns a signal report, name, and location.
5. The station thanks the learner and sends best regards.
6. The learner signs off with 73 SK; the app marks the contact complete.

### Call signs

- The station is `K0DEMO`. The learner defaults to `N0CALL`, the conventional placeholder call used by amateur-radio software. Both use a US format with a four-letter suffix, which is never issued, so neither belongs to a real operator.
- The learner's call sign in the header ("You N0CALL ✎") is click-to-edit: Enter saves, Escape cancels, and leaving the field saves a valid call sign. It accepts letters, digits, and `/`, 3–10 characters, stored in uppercase. The script substitutes it wherever `{MYCALL}` appears.
- The learner's name ("Name PAT ✎" in the header, default PAT) works the same way: 2–10 letters, stored in uppercase, substituted wherever `{MYNAME}` appears, and changeable mid-contact without restarting. Changing it mid-contact does not restart: the current target and later messages use the new call sign, and messages already sent keep the old one.

### Script

Conversations live in `conversations/`, one JSON file each; this table mirrors `conversations/01-answer-cq.json`, which is the source of truth. The script is fixed. For each learner turn, show the exact target text; the words chart explains its terms. In the contact log, each message shows only the sender's call sign and the text as sent. Station messages appear letter by letter as each character finishes playing; Replay plays and reveals the message again.

| # | Speaker | Sent |
| --- | --- | --- |
| 1 | Station | `CQ CQ DE K0DEMO K0DEMO K` |
| 2 | Learner | `K0DEMO DE {MYCALL} K` |
| 3 | Station | `{MYCALL} DE K0DEMO UR RST {RANDOM_RST} NAME {RANDOM_NAME} QTH {RANDOM_QTH} K` |
| 4 | Learner | `K0DEMO DE {MYCALL} UR RST 599 NAME PAT QTH TEXAS K` |
| 5 | Station | `{MYCALL} DE K0DEMO TNX FER QSO 73 K` |
| 6 | Learner | `K0DEMO DE {MYCALL} 73 SK` |

### Word key

Show these terms as a two-column chart at the top of the page throughout the contact, sorted alphabetically, with a one-line meaning for each. Terms that need more explanation (K, RST, FER, QSO, SK) have an info button that opens a short note; Escape closes it.

| Word | Meaning |
| --- | --- |
| CQ | Calling any station |
| DE | From; "this is" |
| K | Over; your turn to send. Ending a message with K sends it. |
| UR | Your |
| RST | Signal report: readability (1–5), strength (1–9), tone (1–9). 579 is perfectly readable, fairly strong, clean tone; 599 is perfect on all three. |
| NAME | Operator's name follows |
| QTH | Location |
| TNX | Thanks |
| FER | For |
| QSO | A two-way contact |
| 73 | Best regards |
| SK | End of contact. Can be keyed as one prosign or as S then K. |

## Conversations

Conversations are JSON files in `conversations/` (see the README for the format), validated on load and in tests. When no contact is under way, Contact shows only a level select screen (no glossary, Morse chart, contact log, task, or keying cards): a numbered card per conversation, in order, with its one-line description and a status of Completed, Up next (the first one not completed, highlighted), or Start. Choosing a card opens that contact and starts it at once; the arrow keys move between cards instead of keying, and Enter or Space starts the focused one. The choice and completed set are remembered on this device. A conversation may start with either the station or the learner. The completion screen offers Next (when there is a later conversation) and Restart, and a ‹ Back link at the top left of the contact view (next to its title, e.g. "Level 2 · Call CQ") returns to the level select screen. Each view has its own address, so browser Back and Forward work: `#/` for the level select, `#/contact/<id>` for a contact, and `#/practice` for Practice; the page title names the contact. Opening a contact address directly (a bookmark or reload) shows the contact ready with a Start button, since the browser allows sound only after a click; an unknown contact id falls back to the level select. When the station opens the conversation, choosing a level, Restart, and Next first show "Starting in 3… 2… 1…" as plain text in the contact log (one second each), with the station's first message bubble already shown just below it (empty, Replay disabled, and in Copy by ear with its copy field focused), while the task panel reads Get ready; the message plays when the countdown ends. The countdown line keeps its space (invisible) for the rest of the contact so the log does not shift. Back cancels it. Conversations the learner opens start at once.

Conversation text can include `{RANDOM_…}` placeholders (name, QTH, state, RST, weather, temperature, power, age, years licensed, park). Values are drawn from a seed when a contact starts and stay fixed for that contact, including replays and call sign or name changes; Start, Restart, and Next draw new ones. The learner's own name is never chosen, and their fixed QTH (TEXAS, TX) is left out of the pools. The bundled conversations are **Answer a CQ** (K0DEMO calls CQ; the script below), **Call CQ** (the learner calls CQ and W0TEST answers), **Trade the weather** (eight messages with K0RAIN that add WX and ES and address the operator by name), **Talk about your rig** (a harder exchange with W0BUZZ, BEV in BOZEMAN, that drills B, V, and Z and adds FB, RIG, HR, PWR, QRP, ANT, and VERT), and **Hunt a park (POTA)** (a terse Parks on the Air contact with activator K0PARK: cut numbers 5NN, BK hand-backs, GM, TU, GL, and confirming park US-4567 with QSL).

## Receiving

A collapsed Receiving setting (remembered on this device) chooses how station messages appear, from most to least support:

- **Read along** (default): letters appear as they play.
- **Listen first**: the bubble stays empty while the message plays, then shows the full text.
- **Copy by ear**: the bubble holds a field for what the learner heard (focused when the message starts). On submit (Enter or Check), the sent text appears with missed words marked and a summary ("You copied 7 of 8 words. Your copy: …"); words are aligned so one missed or extra word does not mark the rest wrong. The learner's turn (target and cue) opens on submit rather than after playback. Replay stays available, and its label no longer includes the message text. Until a message is copied, its bubble is labelled "Station" instead of the call sign, and conversation descriptions never name the station (enforced by the validator).

After a completed contact in Read along or Listen first, the completion card also offers "Again with {next mode}", which switches the Receiving setting and restarts the conversation.

## Practice mode

A Contact / Practice switch in the header selects the activity. Practice uses the same keying station, settings, decoder, Undo, and Clear, but has no script: everything the learner keys is decoded and shown, and K or SK sends nothing. The contact log and words chart are hidden. Switching either way resets the contact to its Start screen and clears the decoded text. The first key press enables audio, so the sidetone works in practice without pressing Start.

## Keying and decoding

- Straight key and paddles are both always available; there is no mode setting. Whichever starts first keeps the line until it is released, and input from the other is ignored meanwhile.
- Straight key: hold Arrow Down. A short hold produces a dit; a longer hold produces a dah.
- Paddles: Arrow Left sends dits and Arrow Right sends dahs. Holding a paddle repeats its element at the selected speed. Holding both alternates dit and dah, starting with whichever was pressed first (iambic mode A); releasing one continues with the other.
- Paddles follow the right-handed convention (left dit, right dah). A Swap paddles (left-handed) setting reverses Arrow Left and Arrow Right, the keycap labels, and the order of the touch Dit and Dah buttons. It is remembered on this device, and changing it releases any held key.
- Show the three keys as keycaps (← dit, ↓ key, → dah) that light up while held. On touch screens, show Dit, Key, and Dah buttons instead; press-and-hold behaves the same as the arrow keys.
- Decode the key timing into Morse elements, letters, spaces, and words. Show both the current elements and decoded text as the learner keys.
- Use standard timing as the starting rule: dit = one unit, dah = three units, gap within a character = one unit, gap between characters = three units, gap between words = seven units. One unit is 1,200 divided by words per minute, in milliseconds.
- Decoder thresholds, in units at the selected speed: a press of 2 units or longer is a dah, shorter is a dit; a pause of 2 units or longer ends a letter; a pause of 5 units or longer ends a word.
- Follow my speed (on by default): the decoder keeps running averages of the learner's dit and dah lengths (each new press weighted 0.25), splits dits from dahs midway between them, and scales the letter and word gaps from the resulting unit. Estimates stay within half to double the speed setting and restart when it changes. The settings show the speed being followed. Turning it off uses the speed setting exactly.
- Show a pause meter after each key release. It fills over a standard 7-unit word gap, with markers at the letter gap (2 units) and word gap (5 units), and stays full until the next key press, so the learner can see a space coming.
- Decode `...-.-` as the prosign SK. Accept either the prosign or separate S and K, and display both as SK.
- Make the keying speed adjustable. Start at 12 WPM; offer a beginner-friendly range of 5–20 WPM. Station audio uses the same speed. The - key slows down and = (or +) speeds up by 1 WPM, outside text fields.
- Listen at N WPM: plays the learner's current target message at the selected speed, or PARIS PARIS (the standard word for measuring speed) when there is no target, so the learner can hear the rhythm and spacing to imitate. It interrupts station playback, whose full text is then shown.
- Detect my speed (straight key, ↓): the learner keys SOS (··· −−− ···), as letters or as one run-together character. The app sets the whole WPM within 5–20 closest to the learner's average rhythm at which every dit, dah, and pause inside a letter falls on the right side of the decoder thresholds. Detection presses sound the sidetone but are not decoded. If no speed fits, explain why (dahs not longer than dits, pauses inside letters too long, or faster than 20 WPM) and let the learner try again; Escape cancels. Because every threshold is in units, the detected speed also sets the letter and word gaps.
- Provide an audible sidetone while keying, with a mute control. Station messages can be replayed as Morse audio. Request low-latency audio, and when the browser reports more than 60 ms of output delay (common with Bluetooth headphones), tell the learner that the tone will lag and that decoding is unaffected.
- Provide Undo and Clear controls. If a sequence is not a known Morse character, show it as a gray ? (same width as a letter, announced as "unrecognized character") and let the learner fix or clear it.
- Arrow keys key Morse whenever no form control has focus, and do not scroll the page. Backspace undoes and Escape clears under the same rule, except that while a message is playing (a station message, Replay, or Listen) Escape first stops it, counting it as cut off so the learner's turn opens at once; in Copy by ear this works from the copy field too, keeping what was typed; the buttons show these shortcuts. No shortcut fires while the learner is changing a form control.

## Sending and progression

- There is no Send button. The learner's message is sent when they key K, BK ("back to you", used in quick exchanges), or SK on the final turn, as its own word after at least one other word. A K inside a call sign does not send, and neither does a lone K, which is more likely the start of a call sign. After the closing K's word gap, wait 10 more units (about 1.5 seconds after releasing the K at 12 WPM) before sending, showing "Over… sending unless you keep keying." Keying again during the wait cancels the send and the message continues; Undo and Clear also cancel it.
- Compare the sent message with the current target case-insensitively, ignoring leading, trailing, or repeated spaces. Letters, numbers, word order, and word boundaries must match: a pause inside a word or a missing pause between words fails, and the feedback names the spacing mistake.
- On an incorrect message, show where the received text diverges, preserve the current attempt, and keep the station silent. The learner can undo or clear, correct the message, and end it with K again.
- On a correct message, add it to the transcript, then wait 700 ms before revealing the next station message, so the learner's message and the reply read as separate events (restarting or switching conversations during the pause cancels the reply). Each station message plays once automatically, its text revealed letter by letter in time with the audio, and can be replayed. When a station message plays to the end, wait 800 ms, then show the learner's target and play the cue together, so the station finishing and the learner's turn are distinct moments (the panel reads Receiving during the pause; a message cut off by Listen opens the turn at once). When a new message for the learner to send appears (after that pause, or at Start when the learner sends first), play a brief, quiet your-turn cue: two beeps, G5 then C6, 80 ms each. It plays once per new target, not on replays. After the final correct message, play a short, quiet rising chime (C5, E5, G5, then a longer B5) and show a completion state and a restart action. Before every station transmission, including replays, play the your-turn cue backwards (C6 then G5) and pause 300 ms, so the learner can tell when a message starts; the text reveal stays in step with the delayed audio. All app sounds, including the sidetone and station Morse, are radio-like: a single sine voice, keyed on and off instantly with no fade, one note at a time.
- Never advance because of a timer, partial match, or audio playback finishing. The word gap and short wait after a closing K are part of ending the learner's own transmission, not a progression timer.

## Interface

- Start: choosing a level begins the contact. This first interaction also enables browser audio.
- Morse code chart: a collapsible section (closed by default) under the words chart, grouped into letters, numbers, punctuation, and prosigns, with each character's dits and dahs. Selecting a character plays it at the current speed (SK run together). It stays available in Practice mode.
- Words chart ("Words in {conversation title}"): every term used in the selected conversation with a one-line meaning, updated when the selection changes, in two alphabetical columns, collapsible, above the contact log.
- Transcript: station and learner messages in order, each showing the sender's call sign and the text as sent, with a clear active turn and replay controls for station messages.
- Current task: titled Ready, Get ready, Your turn, Contact complete, or Practice to match the moment, showing the exact target text ("Send exactly:") on the learner's turn. Accepted messages appear only in the contact log, not as a separate status. While the target is showing and the learner has not started keying, the target box pulses with a slow, soft glow (a steady outline when reduced motion is preferred); keying stops it and Clear brings it back. While the station's latest message is still being sent for the first time, the panel keeps its previous state (the learner's last sent message, or an empty Get ready panel at the start) under a translucent, slightly blurred overlay labelled "Receiving…"; the new target appears after the message finishes. No intermediate status appears between the learner's closing K and the overlay. The panel keeps a minimum height that fits every state and a target wrapped onto two lines, so it changes height only in exceptional cases (a longer target or a mistake message). On the learner's turn, the keying area's dashed outline turns blue (the station's last message is not highlighted). Replaying a message does not hide the target again.
- Keying station: keycaps that show which key is held, live decoded text, current Morse elements, pause meter, speed control, audio control, Undo, Clear, and on-screen key buttons on touch screens.
- Settings: a collapsed Speed section (speed slider, Listen, Detect my speed, Follow my speed) whose heading shows the setting and any followed speed, and a collapsed Key and sound section (Mute key tone, Swap paddles). Mute is for delayed audio (such as Bluetooth), quiet places, or keying real hardware with its own tone.
- Responsive layout for desktop and mobile. Provide visible focus, labelled controls, keyboard access, and text feedback in addition to sound. Announce newly decoded characters to screen readers one at a time, and each station message once it has been fully sent.

## Technical decisions

- Stack: Vite and TypeScript with plain DOM (no UI framework). Vitest covers the decoder, keyer, and answer checking. Web Audio provides sidetone and station audio.
- Progress is not saved across page reloads; the custom call sign may be remembered locally.
- Undo removes the last decoded letter (or the pending elements if a letter is in progress). If that letter's word had already ended, the word stays ended, so the next letter starts a new word; inside a word still being keyed, the next letter continues it. Mute silences the sidetone only; station audio has its own replay control.
- The header shows only the learner's call sign and name. It does not show a frequency (unused) or the station's call sign, which would give it away when copying by ear.

## Acceptance criteria

- A learner can complete the full scripted contact using only keying, with the keyboard or the on-screen key.
- The straight key, the paddles (including both held), and the on-screen keys produce the expected dits and dahs at the selected speed without choosing a mode.
- Letter and word gaps decode at the stated thresholds. A closing K or SK sends after its word gap and the short wait; keying during the wait cancels it; a K inside a call sign or a lone K does not send.
- SK is accepted whether keyed as a prosign or as S then K.
- Station message text reveals letter by letter in time with its audio, at the current speed, and Replay reveals it again.
- A wrong message does not trigger any later station message; correcting it and ending with K again allows the conversation to continue.
- A custom call sign appears in target text and station messages; changing it mid-contact updates the current target and later messages without restarting.
- Replay, mute, clear, undo, restart, and completion work without losing transcript order.
- Practice mode decodes free keying without sending, and switching activities resets the contact.
- The app runs locally from a documented command and requires no account or external service.

## First-release boundary

This release uses scripted contacts, no frequency display, a fixed station identity per conversation, and one speed shared by keying and station audio. See the roadmap for tuning, multiple stations, noise, reference charts, free-form conversations, and adaptive difficulty.
