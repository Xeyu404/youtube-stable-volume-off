# YouTube Stable Volume Always Off

A userscript for compatible script managers that keeps YouTube's **Stable Volume** / **一定音量** setting off by default.

YouTube can re-enable Stable Volume after player reloads, SPA navigation, playlist autoplay, or player state restoration. This script keeps YouTube's internal DRC preference disabled while still allowing a deliberate manual override for the current video.

## Install

1. Install a compatible userscript manager such as [Violentmonkey](https://violentmonkey.github.io/) or [Tampermonkey](https://www.tampermonkey.net/).
2. Open the raw userscript URL:
   `https://raw.githubusercontent.com/Xeyu404/youtube-stable-volume-off/main/youtube-stable-volume-off.user.js`
3. Confirm the installation in your userscript manager.

## Behavior

- Keeps YouTube's internal `yt-player-drc-pref` preference off by default.
- Stores the preference in YouTube's wrapped storage format, not as a bare `0`.
- Avoids unnecessary storage writes when the stored value already matches the expected state.
- Uses YouTube's player DRC API when available to keep the player state aligned with storage.
- Re-checks during startup, YouTube SPA navigation, video reloads, player swaps, tab restore, and focus changes.
- Disables Stable Volume again when moving to another video, including playlist and ad-to-content transitions.
- If you manually enable Stable Volume from the player menu, the script allows it only for the current video.
- Reloading the page or navigating to another video clears the manual override.

## Scope

The script runs on:

- `https://www.youtube.com/*`
- `https://m.youtube.com/*`

It does not target YouTube Music. YouTube Music's volume normalization controls may use a different implementation.

## Compatibility

This script was originally developed and tested with Violentmonkey, but it does not use Violentmonkey runtime APIs.

It is intended for userscript managers that can run `@grant none` scripts at `document-start` in the page context, or provide equivalent page-context injection. That matters because the script needs to observe YouTube's early player and storage behavior.

Expected compatible managers include Violentmonkey and Tampermonkey. Managers that isolate all userscripts from the page context may not work reliably with this script.

## How It Works

The script treats YouTube's DRC state as several related layers instead of relying on a single UI toggle.

- **Storage:** keeps `yt-player-drc-pref` off using YouTube's current wrapped storage record format.
- **Storage guard:** intercepts writes to `yt-player-drc-pref` and blocks unexpected attempts to turn it on.
- **Player API:** calls `setDrcUserPreference(0)` when YouTube exposes the DRC API on the player.
- **Navigation detection:** watches YouTube SPA and video events so the manual override does not leak to the next video.
- **Manual intent detection:** uses the `.ytp-drc-menu-item` settings menu item only to detect a trusted user action.
- **Startup/transition burst:** retries briefly after loads and navigations because YouTube can initialize DRC and player APIs late.

## Troubleshooting

If the script stops working after a YouTube change, the most likely compatibility points are:

- `yt-player-drc-pref`
- `setDrcUserPreference()` / `getDrcUserPreference()`
- `.ytp-drc-menu-item`
- YouTube's wrapped storage record format
- YouTube SPA navigation and player update events

When reporting an issue, include the browser, userscript manager, video URL type (`watch`, `shorts`, playlist, autoplay), and whether the problem affects default-off behavior, manual-on behavior, or next-video reset behavior.

## License

MIT
