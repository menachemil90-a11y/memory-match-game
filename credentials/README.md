# Test-build signing key

`sideload.keystore` signs the **test APKs** built by `.github/workflows/android-apk.yml`
so that each new test build installs over the previous one on your phone.

- It uses the standard debug credentials (`androiddebugkey` / `android`) and is
  **not secret** — never use it for Google Play.
- Google Play releases are signed by EAS-managed credentials (upload key) and
  Google Play App Signing — see `RELEASING.md`.
- Because the signatures differ, uninstall the test build before installing the
  Play Store version on the same phone.
