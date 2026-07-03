// ==UserScript==
// @name         YouTube Stable Volume Always Off
// @namespace    https://github.com/Xeyu404/youtube-stable-volume-off
// @version      0.3.0
// @description  Keeps YouTube's Stable Volume / DRC preference disabled, with a per-video manual override.
// @author       Xeyu404
// @license      MIT
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @homepageURL  https://github.com/Xeyu404/youtube-stable-volume-off
// @supportURL   https://github.com/Xeyu404/youtube-stable-volume-off/issues
// @downloadURL  https://raw.githubusercontent.com/Xeyu404/youtube-stable-volume-off/main/youtube-stable-volume-off.user.js
// @updateURL    https://raw.githubusercontent.com/Xeyu404/youtube-stable-volume-off/main/youtube-stable-volume-off.user.js
// @run-at       document-start
// @inject-into  page
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const KEY = "yt-player-drc-pref";
  const OFF = 0;
  const ON = 1;
  const YEAR_MS = 31536e3 * 1000;
  const ENFORCE_BURST_MS = 500;
  const ENFORCE_BURST_COUNT = 40;
  const MANUAL_INTENT_MS = 3000;

  let manualIntentUntil = 0;
  let allowedOnVideoKey = null;
  let lastVideoKey = null;
  let enforceBurstTimer = null;
  let enforceBurstTicks = 0;
  let enforceQueued = false;
  let observedPlayer = null;
  let playerObserver = null;

  function storagePayload(preference) {
    const now = Date.now();
    return JSON.stringify({
      data: JSON.stringify(preference),
      creation: now,
      expiration: now + YEAR_MS,
    });
  }

  function parseStoredRecord(value) {
    try {
      const parsed = JSON.parse(String(value));
      if (parsed && typeof parsed === "object" && "data" in parsed) {
        const creation = Number(parsed.creation) || 0;
        const expiration = Number(parsed.expiration) || 0;
        return {
          expired:
            (expiration > 0 && expiration < Date.now()) ||
            (creation > 0 && creation > Date.now()),
          preference:
            typeof parsed.data === "string"
              ? JSON.parse(parsed.data)
              : parsed.data,
          validWrapper: true,
        };
      }
      return {
        expired: false,
        preference: parsed,
        validWrapper: false,
      };
    } catch (_) {
      return {
        expired: true,
        preference: null,
        validWrapper: false,
      };
    }
  }

  function parsePreference(value) {
    return parseStoredRecord(value).preference;
  }

  function storageAlreadyMatches(storage, preference) {
    const record = parseStoredRecord(storage.getItem(KEY));
    return (
      record.validWrapper &&
      !record.expired &&
      record.preference === preference
    );
  }

  function getPlayer() {
    return (
      document.getElementById("movie_player") ||
      document.querySelector(".html5-video-player")
    );
  }

  function getVideoKey() {
    try {
      const url = new URL(window.location.href);
      const videoId = url.searchParams.get("v");
      if (videoId) return "watch:" + videoId;

      const shortsMatch = url.pathname.match(/^\/shorts\/([^/?#]+)/);
      if (shortsMatch) return "shorts:" + shortsMatch[1];
    } catch (_) {
      // Fall through to the player API.
    }

    try {
      const player = getPlayer();
      const videoData =
        player && typeof player.getVideoData === "function"
          ? player.getVideoData()
          : null;
      const videoId = videoData && (videoData.video_id || videoData.videoId);
      if (videoId) return "player:" + videoId;
    } catch (_) {
      // Fall through to the URL fallback.
    }

    return window.location.pathname + window.location.search;
  }

  function resetManualAllowance() {
    manualIntentUntil = 0;
    allowedOnVideoKey = null;
  }

  function syncVideoKey() {
    const videoKey = getVideoKey();
    if (lastVideoKey === null) {
      lastVideoKey = videoKey;
    } else if (videoKey !== lastVideoKey) {
      lastVideoKey = videoKey;
      resetManualAllowance();
    }
    return videoKey;
  }

  function hasManualIntent() {
    return Date.now() <= manualIntentUntil;
  }

  function allowOnForCurrentVideo() {
    allowedOnVideoKey = syncVideoKey();
  }

  function isOnAllowedForCurrentVideo() {
    return allowedOnVideoKey !== null && allowedOnVideoKey === syncVideoKey();
  }

  function desiredPreference() {
    return isOnAllowedForCurrentVideo() ? ON : OFF;
  }

  function writeStorage(storage, preference) {
    if (!storage) return;
    try {
      if (storageAlreadyMatches(storage, preference)) return;
      storage.setItem(KEY, storagePayload(preference));
    } catch (_) {
      // Storage can be unavailable in private windows or blocked frames.
    }
  }

  function forceStoredPreference() {
    const preference = desiredPreference();
    writeStorage(window.localStorage, preference);
    writeStorage(window.sessionStorage, preference);
  }

  function installStorageGuard() {
    const proto = window.Storage && window.Storage.prototype;
    if (!proto || proto.__ytStableVolumeOffGuard) return;

    const originalSetItem = proto.setItem;
    const originalRemoveItem = proto.removeItem;

    Object.defineProperty(proto, "__ytStableVolumeOffGuard", {
      value: true,
      configurable: false,
    });

    Object.defineProperty(proto, "setItem", {
      configurable: true,
      writable: true,
      value: function setItem(name, value) {
        if (String(name) === KEY) {
          const requestedPreference = parsePreference(value);
          if (
            requestedPreference === ON &&
            (hasManualIntent() || isOnAllowedForCurrentVideo())
          ) {
            allowOnForCurrentVideo();
            value = storagePayload(ON);
          } else {
            if (requestedPreference === OFF) {
              resetManualAllowance();
            }
            value = storagePayload(OFF);
          }
        }
        return originalSetItem.call(this, name, value);
      },
    });

    Object.defineProperty(proto, "removeItem", {
      configurable: true,
      writable: true,
      value: function removeItem(name) {
        if (String(name) === KEY) {
          return originalSetItem.call(this, name, storagePayload(desiredPreference()));
        }
        return originalRemoveItem.call(this, name);
      },
    });
  }

  function pathContainsDrcMenuItem(event) {
    const path =
      typeof event.composedPath === "function" ? event.composedPath() : [];
    for (const target of path) {
      if (
        target &&
        target.classList &&
        target.classList.contains("ytp-drc-menu-item")
      ) {
        return true;
      }
    }
    return false;
  }

  function markManualDrcIntent(event) {
    if (!event.isTrusted || !pathContainsDrcMenuItem(event)) return;
    manualIntentUntil = Date.now() + MANUAL_INTENT_MS;
  }

  function installManualIntentListeners() {
    document.addEventListener("pointerdown", markManualDrcIntent, true);
    document.addEventListener("click", markManualDrcIntent, true);
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        markManualDrcIntent(event);
      },
      true
    );
  }

  function forcePlayerPreference() {
    const player = getPlayer();
    if (!player || typeof player.setDrcUserPreference !== "function") return;

    try {
      const current =
        typeof player.getDrcUserPreference === "function"
          ? Number(player.getDrcUserPreference())
          : NaN;

      if (current === ON && hasManualIntent()) {
        allowOnForCurrentVideo();
        forceStoredPreference();
        return;
      }

      if (current === ON && isOnAllowedForCurrentVideo()) {
        return;
      }

      if (current !== OFF) {
        player.setDrcUserPreference(OFF);
      }
    } catch (_) {
      if (hasManualIntent()) {
        allowOnForCurrentVideo();
        forceStoredPreference();
        return;
      }

      if (isOnAllowedForCurrentVideo()) {
        return;
      }

      try {
        player.setDrcUserPreference(OFF);
      } catch (__) {
        // The API may exist before its backing module is fully ready.
      }
    }
  }

  function installPlayerObserver() {
    const player = getPlayer();
    if (!player || player === observedPlayer) return;

    if (playerObserver) {
      playerObserver.disconnect();
    }

    observedPlayer = player;
    playerObserver = new MutationObserver(requestEnforce);
    playerObserver.observe(player, {
      attributeFilter: ["class"],
      attributes: true,
    });
  }

  function enforce() {
    syncVideoKey();
    installPlayerObserver();
    forceStoredPreference();
    forcePlayerPreference();
  }

  function requestEnforce() {
    if (enforceQueued) return;
    enforceQueued = true;
    window.setTimeout(() => {
      enforceQueued = false;
      enforce();
    }, 0);
  }

  function startEnforceBurst() {
    enforce();
    enforceBurstTicks = 0;

    if (enforceBurstTimer !== null) return;

    enforceBurstTimer = window.setInterval(() => {
      enforce();
      enforceBurstTicks += 1;

      if (enforceBurstTicks >= ENFORCE_BURST_COUNT) {
        window.clearInterval(enforceBurstTimer);
        enforceBurstTimer = null;
      }
    }, ENFORCE_BURST_MS);
  }

  function resetAndStartEnforceBurst() {
    resetManualAllowance();
    startEnforceBurst();
  }

  function installHistoryHooks() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    function wrapHistoryMethod(original) {
      return function wrappedHistoryMethod() {
        const previousVideoKey = getVideoKey();
        const result = original.apply(this, arguments);
        if (getVideoKey() !== previousVideoKey) {
          resetManualAllowance();
          startEnforceBurst();
        } else {
          requestEnforce();
        }
        return result;
      };
    }

    history.pushState = wrapHistoryMethod(originalPushState);
    history.replaceState = wrapHistoryMethod(originalReplaceState);
    window.addEventListener("popstate", resetAndStartEnforceBurst, true);
  }

  function schedule() {
    startEnforceBurst();

    document.addEventListener("yt-navigate-start", resetAndStartEnforceBurst, true);
    document.addEventListener("yt-navigate-finish", startEnforceBurst, true);
    document.addEventListener("yt-page-data-updated", startEnforceBurst, true);
    document.addEventListener("yt-player-updated", startEnforceBurst, true);

    document.addEventListener("loadstart", startEnforceBurst, true);
    document.addEventListener("loadedmetadata", startEnforceBurst, true);
    document.addEventListener("durationchange", requestEnforce, true);
    document.addEventListener("emptied", requestEnforce, true);

    document.addEventListener("visibilitychange", requestEnforce, true);
    window.addEventListener("focus", requestEnforce, true);
    window.addEventListener("load", startEnforceBurst, true);
    window.addEventListener("pageshow", startEnforceBurst, true);
  }

  installStorageGuard();
  installManualIntentListeners();
  installHistoryHooks();
  schedule();
})();
