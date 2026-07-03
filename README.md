# YouTube Stable Volume Always Off

Violentmonkey userscript that keeps YouTube's **Stable Volume** / **一定音量** setting off by default.

YouTube can re-enable Stable Volume after player reloads or navigation. This script keeps the internal DRC preference disabled, while still allowing a manual per-video override when you intentionally turn Stable Volume on from the player menu.

## Install

1. Install [Violentmonkey](https://violentmonkey.github.io/).
2. Open the raw userscript URL:
   `https://raw.githubusercontent.com/Xeyu404/youtube-stable-volume-off/main/youtube-stable-volume-off.user.js`
3. Confirm the installation in Violentmonkey.

## Behavior

- Sets YouTube's internal `yt-player-drc-pref` preference to off by default.
- Avoids unnecessary storage writes when the stored value already matches the expected state.
- Re-checks during startup, YouTube SPA navigation, video reloads, player swaps, tab restore, and focus changes.
- Disables Stable Volume again when moving to another video, including playlist and ad-to-content transitions.
- If you manually enable Stable Volume from the player menu, the script allows it only for the current video.
- Reloading the page or navigating to another video clears the manual override.

## Scope

The script runs on:

- `https://www.youtube.com/*`
- `https://m.youtube.com/*`

It does not target YouTube Music. YouTube Music's volume normalization controls may use a different implementation.

## Notes

This relies on YouTube's current player implementation, including the `yt-player-drc-pref` key and the `.ytp-drc-menu-item` menu item class. If YouTube changes those internals, the script may need an update.

## License

MIT
