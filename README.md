# Memory Match — downloads

Play in the browser: **https://memorymatch-online.pages.dev**

This repository holds no code. It only serves:

- the Android test APK (Releases; `releases/latest/download/memory-match.apk`), used by the
  web game's "Download the app" button and by the app's in-app update check;
- the game's old web address (GitHub Pages), which forwards to the new one.

Releases are created by `.github/workflows/publish.yml` from what the game's build pushes
to the `incoming-apk` branch.
