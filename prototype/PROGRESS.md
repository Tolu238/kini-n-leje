# Ki ni n leje — Progress Checklist

## Completed

- [x] Extracted 130 words from `Yoruba_words2.xlsx` into `game-data.js`, tagged with emoji, `hasBlood`, and `complexity`
- [x] Built 4-screen single-page app (Home, Level Select, Game, Result) matching the mockups' visual style
- [x] Implemented True/False answer buttons ("Léje léje" / "Iró nlá"); superseded by the rigid-match change below
- [x] Implemented complexity-based leveling (Very-common → Common → Not-common → Rare), each round drawing 12 words balanced on `hasBlood`
- [x] Implemented pass/fail flow (80% threshold) with an opt-in prompt to advance to the next tier
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

## Todo

- [ ] Add a timed game mode: see how many words can be answered within a set time
- [ ] Add multiplayer mode
- [ ] Add online and offline play capability
- [ ] Add a word-mastery mode: play the Yoruba pronunciation audio and have the player pick the matching word from a set of choices
- [ ] Add a lot more words to the dataset
- [ ] Add login/authentication (was skipped for this MVP)
- [ ] Save player progress (highest tier reached) per account once login is added; for now every Play starts at Very-common
- [ ] Add teacher mode
