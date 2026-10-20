# Ki ni n leje — Progress Checklist

## Completed

- [x] Extracted 130 words from `Yoruba_words2.xlsx` into `game-data.js`, tagged with emoji, `hasBlood`, and `complexity`
- [x] Built 4-screen single-page app (Home, Level Select, Game, Result) matching the mockups' visual style
- [x] Implemented True/False answer buttons ("Léje léje" / "Iró nlá"); superseded by the rigid-match change below
- [x] Implemented complexity-based leveling (Very-common → Common → Not-common → Rare), each round drawing 12 words balanced on `hasBlood`
- [x] Implemented pass/fail flow (80% threshold) with an opt-in prompt to advance to the next tier; superseded by the two-condition gameplay change below
- [x] Fixed card reveal to show the Yoruba word, emoji, and English word together (matches original mockups)
- [x] Verified via manual play-through and automated Puppeteer tests (pass/fail/advance paths, no console errors)
- [x] Fixed duplicate-emoji bug: Palm oil and Body cream both used 🧴 in the same tier
- [x] Fixed misleading Nail emoji (💅 fingernail polish → 🔩 hardware fastener)
- [x] Corrected `hasBlood` flag for Earthworm (false → true — earthworms do have hemoglobin/blood)

- [x] Replaced emoji with generated pictures (Recraft V3, transparent PNG, 512x512) from `yoruba_words_joined.csv`; emoji later removed entirely once pictures covered every word
- [x] Added Yoruba pronunciation audio per word (`Code_word_audio/`), auto-playing alongside the Yoruba word each round, with a 🔊 button to replay

- [x] Moved the ✔/✘ feedback marker into the card's English banner so it no longer overlaps the picture

- [x] Rigid match: Yoruba word, English word and picture always come from the same entry (no decoys). "Léje léje" is correct when the word has blood, "Iró nlá" when it does not

- [x] Removed the level/difficulty select screen: Play always starts at Very-common, and players advance only by passing (80%)

- [x] Replaced the 🔊 speaker button with an original mascot (a friendly Yoruba elder/griot wearing a fila, head-and-shoulders, generated via Recraft V3) whose mouth animates in real time from the pronunciation audio's amplitude (Web Audio API `AnalyserNode`); tapping the mascot replays the word
- [x] Swapped the timer and mascot positions: the countdown clock now sits in the card's top-left corner, the mascot sits in the HUD row center (between WORDS and SCORE)
- [x] Reworked level progression into two simultaneous conditions: (1) answer a tunable minimum number of words (default 15) within a tunable time window (default 60s), (2) hit at least 85% accuracy across the whole round. Rounds are now open-ended with a single round-level 60s countdown and a continuously reshuffling word queue per tier, replacing the old fixed-word-count/per-word-timer rounds and the 80% threshold
- [x] Added a star rating (1 star for 85-90% accuracy, 2 for 90-99%, 3 for exactly 100%) shown on the result screen only when both conditions pass
- [x] Repurposed the live HUD badges during play: WORDS badge now shows live `correct/15` progress, SCORE badge shows live accuracy %; added a green tick/red X pace indicator below the word card reflecting condition 1's live status
- [x] Added two condition rows (✔/✘) to the result screen showing exactly which of the two pass conditions were met
- [x] Verified the new gameplay via Playwright smoke tests: full pass run (3 stars, both conditions met), full fail run (both conditions unmet, stars hidden), and mid-round HUD/pace-icon check — no new console errors

## Todo

- [ ] Add multiplayer mode
- [ ] Add online and offline play capability
- [ ] Add a word-mastery mode: play the Yoruba pronunciation audio and have the player pick the matching word from a set of choices
- [ ] Add a lot more words to the dataset
- [ ] Add login/authentication (was skipped for this MVP)
- [ ] Save player progress (highest tier reached) per account once login is added; for now every Play starts at Very-common
- [ ] Add teacher mode
