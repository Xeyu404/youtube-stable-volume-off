# AGENTS.md

## Project

This repository contains a single userscript:

- `youtube-stable-volume-off.user.js`

The script keeps YouTube's Stable Volume / DRC preference off by default while allowing a trusted manual ON action for the current video only.

There is no build step and no package manager dependency.

## Required Behavior

Preserve these user-visible behaviors unless the user explicitly asks to change them:

- Stable Volume is off by default on YouTube.
- YouTube attempts to restore or write Stable Volume ON are blocked by default.
- A trusted manual click or keyboard activation on the Stable Volume menu item may turn it ON.
- Manual ON is allowed only for the current video key.
- Reloading the page or moving to another video clears the manual ON allowance.
- Playlist next-video, autoplay, ad-to-content transitions, Shorts, and SPA navigation should return to OFF unless the new video is manually enabled.
- Storage writes should be skipped when the current stored value already matches the expected value.

## Important YouTube Internals

The implementation currently depends on these YouTube internals:

- Storage key: `yt-player-drc-pref`
- Stored values: `0` for OFF, `1` for ON
- YouTube storage record shape: `{ data, creation, expiration }`
- Player methods: `setDrcUserPreference()`, `getDrcUserPreference()`, and related DRC methods when available
- Manual intent UI selector: `.ytp-drc-menu-item`

Do not simplify the storage record to a bare `0` or `1` unless the current YouTube player code has been re-checked and confirmed to accept that format reliably.

Do not treat the visible settings menu toggle as the source of truth. The menu item is useful for detecting trusted manual intent, but the authoritative state is split across storage, player internals, audio track selection, and delayed YouTube initialization.

## Implementation Guidelines

- Keep the script dependency-free.
- Keep `@run-at document-start`, `@grant none`, and page-context execution behavior.
- Avoid synthetic clicks on YouTube UI. Prefer storage and player API enforcement.
- Keep changes localized to the userscript unless documentation or release metadata also needs updating.
- Keep the YouTube storage wrapper compatible with YouTube's current format.
- Preserve the `Storage.prototype.setItem/removeItem` guard unless replacing it with an equally early and reliable interception point.
- Preserve navigation and video-change detection unless replacing it with coverage for YouTube SPA transitions, playlist autoplay, Shorts, and ad-to-content transitions.
- Be conservative with MutationObserver scope. Broad DOM observers are more fragile than targeted storage, player, and navigation hooks.
- If changing manual override behavior, test both mouse and keyboard activation paths.

## Checks

For script changes, run the smallest available syntax check:

```bash
node --check youtube-stable-volume-off.user.js
```

Then manually verify in a browser with a compatible userscript manager:

- Fresh video load starts with Stable Volume OFF.
- Page reload keeps Stable Volume OFF.
- Manually turning Stable Volume ON keeps it ON for that video.
- Navigating to another video clears the manual ON allowance and returns to OFF.
- Playlist/autoplay next-video transitions return to OFF.
- Shorts navigation returns to OFF.
- No console errors appear from the userscript.

For documentation-only changes, no runtime check is required, but review the rendered Markdown if possible.

## Release Notes

When the userscript behavior changes:

- Bump `@version`.
- Keep `@downloadURL` and `@updateURL` pointed at the raw `main` userscript URL unless the release flow changes.
- Update `README.md` if install behavior, compatibility, scope, or user-visible behavior changes.
- Keep `AGENTS.md` updated when implementation assumptions or maintenance procedures change.

## Debugging Checklist

When the script stops working after a YouTube update, check these first:

- Does `yt-player-drc-pref` still exist?
- Does YouTube still use the wrapped storage record format?
- Are `setDrcUserPreference()` and `getDrcUserPreference()` still exposed on `movie_player`?
- Does `.ytp-drc-menu-item` still identify the Stable Volume menu item?
- Are YouTube SPA events such as `yt-navigate-start`, `yt-navigate-finish`, `yt-page-data-updated`, or `yt-player-updated` still firing?
- Is the script still running in the page context early enough to hook `Storage.prototype`?
