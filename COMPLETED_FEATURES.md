# 🏆 XploreQuest — Summary of Completed Features (Stages 1–12)

This document provides a simple summary of all completed backend architectures, API endpoints, business logic rules, and test suites implemented in **XploreQuest**.

---

## 🔐 1. Authentication & Security (Stage 3 & 4)
- **Multi-Role RBAC**: Custom Firebase Auth claims for `admin`, `crew`, and `participant`.
- **Crew PIN Login**: 4-digit PIN authentication using constant-time comparison (`crypto.timingSafeEqual`) to prevent side-channel timing attacks.
- **Participant Event Join**: Event registration using 6-character event join codes (e.g. `XT2026`).
- **Encrypted Secrets**: Sensitive event credentials (Crew PIN & HMAC keys) stored in isolated Firestore subcollections (`allow read, write: if false`).

---

## 🚩 2. Event & Checkpoint Management (Stage 4 & 5)
- **Event CRUD**: Full lifecycle management (`/events`), join code generation, and race parameter setup.
- **Geofence Boundary Designer**: Polygon boundary configuration and circular geofence radius validation ($10\text{m} \dots 150\text{m}$).
- **Station Assignment**: Binding station marshals to specific checkpoints.

---

## 🏃 3. Team Registration & Attendance (Stage 6)
- **Team Registration**: Cap on team size ($2 \dots 6$ members), name collision checks, and pending/approved status flow.
- **Attendance Check-in**: Physical attendance tagging (`present`, `absent`, `late`) and automated exclusion of absent teams.

---

## 🚀 4. Staggered Race Start & Cyclical Route Assignment (Stage 7)
- **Cyclical Route Distribution**: Automatically assigns staggered starting checkpoints to teams to prevent bottlenecking at CP-001.
- **Staggered & Late Release**: Schedulable release times (`startedAt`) for teams arriving at different times.

---

## 🔑 5. Dynamic HMAC QR Security Engine (Stage 8)
- **Cryptographic QR Tokens**: Dynamic QR code generation signed with `HMAC-SHA256` keys.
- **Configurable TTL & Replay Protection**: Expiration timers ($10\text{s} \dots 120\text{s}$) and single-use redemption tracking to prevent QR screenshot sharing.

---

## 🛡️ 6. Participant QR Scanning & Anti-Cheat Guards (Stage 9)
- **Multi-Layer Validation**:
  1. Cryptographic HMAC signature check (detects tampering).
  2. Single-use replay attack guard.
  3. Strict sequence check & skipped checkpoint resolution.
  4. Circular geofence proximity check.
  5. Velocity anti-spoofing guard (detects unreasonable GPS jumps $>40\text{km/h}$).
  6. Single-device fingerprinting constraint (prevents multi-device login abuse).

---

## ⏭️ 7. Station Skip Logic & Finish Gatekeeper (Stage 10)
- **Checkpoint Skip (FR-02)**: Allows congested teams to skip up to 2 checkpoints (excluding CP-TAMAT).
- **Backtrack Resolution**: Allows teams to revisit and resolve previously skipped checkpoints out-of-order without resetting forward progress.
- **Finish Line Gatekeeper**: Rejects finish claims if incomplete checkpoints remain.

---

## 📷 8. Crew Verification Wizard (Stage 11)
- **Photo Proof Upload (FR-08)**: Server-side binary magic-byte inspection (JPEG, PNG, WebP) and 5MB size checks via Firebase Storage.
- **Manual Marshal Override**: Offline/manual override with mandatory geofence audit reasons.
- **Bounded Penalties**: Manual point and time penalties capped by event rules for crew members, with custom overrides for admins.

---

## 📊 9. Live Leaderboard & Race Rules Engine (Stage 12)
- **Zero-Contention Live Leaderboard (FR-09)**: Real-time ranked leaderboard (`GET /events/:eventId/leaderboard`) and Firestore `onSnapshot` real-time subscriptions with single-team isolated writes.
- **Dynamic Rank & Metric Formatting**: Dynamic rank calculation (`1..N`) and Malaysian time formatting (`1j 42m`).
- **Admin Race Rules Configuration (`PUT /events/:eventId/rules`)**: Dynamically adjust `maxRaceTime`, `taskTimeLimit`, penalty caps, and feature toggles.
- **Automated Scheduled DNF Evaluator (`evaluateRaceTimeouts`)**: Background Cloud Function (`onSchedule`) that automatically flags teams exceeding `maxRaceTime` as `isDNF: true`.

---

## 🔄 10. Offline Sync Queue Batch Ingestion Engine (Stage 13 — FR-06)
- **Batch Ingestion (`POST /events/:eventId/sync`)**: Ingests up to 100 queued offline items per request created while devices were disconnected.
- **High-Performance Per-Team Concurrency**: Groups items by `teamId` and executes team groups in parallel via `Promise.all`, maintaining strict `clientTimestamp` ASC order within each team group to hit $\le 5\text{s}$ total batch latency.
- **Idempotency & Deduplication Engine**: Tracks `idempotencyKey` in Firestore subcollection `/events/{eventId}/sync_idempotency/{key}` to prevent duplicate scoring or penalty applications.
- **Zero Logic Duplication**: Replays events through shared core validation pipelines (`processScanCore`, `processSkipCore`, `processFinishCore`, `processOverrideCore`, `processPenaltyCore`).
- **Granular Security Gates**: Re-enforces per-item role gates in core process functions, preventing participant privilege escalation (e.g. rejecting unauthorized `manual_override` or `apply_penalty` items with `status: 'rejected'` / `403 FORBIDDEN`).

---

## 🔔 12. Push Notifications Engine (Stage 15 — FR-15)
- **Expo Device Token Registration (`POST /users/me/push-token`)**: Validates Expo push tokens (`ExponentPushToken[...]`) using `Expo.isExpoPushToken` and stores `pushToken` and `pushTokenUpdatedAt` on `/users/{uid}`.
- **Thin Non-Blocking Side-Effect Service (`notification.service.ts`)**: Built on `expo-server-sdk`. Wraps notification dispatches in non-blocking fire-and-forget `.catch()` handlers so push network downtime or token errors never block or fail critical transactions (e.g. QR scans or race releases).
- **Event-Driven Triggers**:
  - **Pre-race Assignment**: Notifies team devices with their assigned starting checkpoint upon Stage 7 staggered-start completion.
  - **Checkpoint Completion**: Notifies team devices with next-clue unlocked confirmation upon Stage 9 successful QR scan.
- **Scheduled Attendance Reminder Job (`sendAttendanceReminders`)**: Cloud Function running every 15 minutes (`onSchedule`) that identifies un-checked-in teams (`isPresent != true`) in pre-race events and dispatches push reminders.
- **Leader & Team Resolution**: Looks up `team.leaderUid` from `events/{eventId}/teams/{teamId}` and fetches `/users/{leaderUid}` directly (and queries `/users` by `teamId`), deduplicating tokens via `Set<string>`.

---

## 🔒 13. Security Hardening & CIA Triad Audit (Stage 16)
- **Firebase App Check Verification Middleware (`middleware/appCheck.ts`)**: Enforces `X-Firebase-AppCheck` token verification across Express endpoints to block script/bot traffic. Explicitly exempts `GET /health` and `OPTIONS` CORS preflights for uptime monitors.
- **Admin HMAC Key Rotation Endpoint (`POST /events/:eventId/rotate-hmac`)**: Administrative trigger promoting current `hmacSecret` & `hmacKeyId` to `previousHmacSecret` & `previousHmacKeyId` on `events/{eventId}/secrets/config`, maintaining key rotation grace windows.
- **Automated Ephemeral GPS Data Purge Job (`purgeEphemeralGpsData`)**: Daily scheduled Cloud Function (`jobs/gpsPurgeJob.ts`) purging `lastScanLat`, `lastScanLng`, `lastScanAt`, `lastScanLocation` from completed event team documents (`admin.firestore.FieldValue.delete()`), enforcing Stage 2 PDPA minimization.

---

## 🧪 Verification & Test Suite Summary
- **TypeScript Compilation**: `0 errors` (`npm run build`).
- **Unit & Integration Test Suite**: **176 / 176 tests passing across 15 test suites** (`npm test`).
