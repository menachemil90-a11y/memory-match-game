# Test-build signing key

`sideload.keystore` signs the **test APKs** built by `.github/workflows/android-apk.yml`
so that each new test build installs over the previous one on your phone.

- `test-signing-cert.sha256` is the SHA-256 of its certificate. `android-apk.yml` checks every
  test APK against it before publishing (`scripts/verify-apk.mjs`): an APK signed any other
  way could not install over the app on the phones. Never replace this keystore.
- It uses the standard debug credentials (`androiddebugkey` / `android`) and is
  **not secret** — never use it for Google Play.
- Google Play releases are signed by EAS-managed credentials (upload key) and
  Google Play App Signing — see `RELEASING.md`.
- Because the signatures differ, uninstall the test build before installing the
  Play Store version on the same phone.
