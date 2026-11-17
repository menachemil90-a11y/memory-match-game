# `src/features`

Feature modules. Each folder owns its screens' logic, stores and data access;
route files in `src/app` stay thin and import from here.

- `boards/` — built-in board catalog, custom photo boards, crop pipeline, SQLite storage (Phases 3–4)
- `online/` — Supabase client, lobby, realtime room sync, timers (Phase 5)
- `settings/` — persisted user settings (sound, music, haptics, flip-back speed)
