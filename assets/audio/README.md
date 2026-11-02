# Audio

The game ships no audio files. All music, ambience and sound effects are synthesised live by
`js/view/audio.js` (Web Audio API), so every sound is original and there is nothing to license.

## Replacing a music theme with a recorded track (optional)

Put a licensed or original loop in `assets/audio/music/` and point the theme at it in `js/view/audio.js`:

```js
TRACK_FILES: { menu: 'assets/audio/music/main-menu.ogg', select: null, city: null, battle: null, victory: null, defeat: null },
```

Themes left as `null` keep the synthesised score. Recorded tracks go through the same music volume,
mute and crossfade as the synthesised ones. `serve.js` serves `.ogg`, `.mp3` and `.wav`.
