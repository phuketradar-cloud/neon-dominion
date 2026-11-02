# Audio

## Recorded music (in use)

| File | Plays on |
|---|---|
| `music/opening.mp3` | Title menu, faction selection and New Game Setup (one continuous track) |
| `music/gameplay.mp3` | The city during play, including every full screen except Battles and the result screen |

Battles, victory and defeat keep the synthesised score. Tracks loop, crossfade, follow the Music volume and
resume where they were left. Their levels are trimmed in `TRACK_GAIN` (`js/view/audio.js`) to sit with the
rest of the mix; adjust those numbers if a track sounds too loud or too quiet.

## Synthesised audio

Everything else — the remaining themes, interface and gameplay effects, and city ambience — is synthesised
live by `js/view/audio.js` (Web Audio API).

## Replacing another theme

Put the file in `assets/audio/music/` and set it in `TRACK_FILES` (`menu`, `select`, `city`, `battle`,
`victory`, `defeat`); `null` keeps the synthesised theme. `serve.js` serves `.ogg`, `.mp3` and `.wav` with
byte ranges so tracks can resume mid-way.
