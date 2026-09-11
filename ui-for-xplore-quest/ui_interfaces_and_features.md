# XploreQuest: UI Interfaces & Features Registry

This document lists all available interfaces (screens), layout structures, user roles, interactive features, and design tokens of the **XploreQuest** application. Its purpose is to facilitate automated and manual UI/UX analysis for design optimization.

---

## 🎨 Shared Design System & Branding Tokens
The UI implements a dynamic theme system (`theme.ts`) that adapts to the active user role (`participant`, `crew`, or `admin`) to shift visual context.

### 1. Color Palettes
*   **Base Neutrals:**
    *   Background: `#FAF9F6` (Off-white / cream - Malaysian natural heritage theme)
    *   Card Background: `#FFFFFF`
    *   Primary Text: `#1C2E24` (Dark forest charcoal)
    *   Muted Text: `#5C6E64` (Muted slate green)
    *   Border: `#E2E8E4`
    *   Shadow/Overlay: `#0A1810` (with varying alpha)
*   **Status Indicators:**
    *   Success: `#10B981` (Emerald Green)
    *   Warning / Pending / Skip: `#F59E0B` (Amber)
    *   Danger / DNF: `#EF4444` (Coral Red)
*   **Role-Specific Theme Colors:**
    | Role | Primary Color (Brand) | Accent Color | Visual Identity |
    | :--- | :--- | :--- | :--- |
    | **Participant** | `#0F4C3A` (Deep Forest Green) | `#E06A24` (Trail Orange) | Nature, adventure, exploration |
    | **Crew / Marshal** | `#E06A24` (Trail Orange) | `#0F4C3A` (Deep Forest Green) | High-visibility, action, warning |
    | **Admin / Organizer**| `#1A2E40` (Deep Navy) | `#E06A24` (Trail Orange) | Security, control, dashboard |

### 2. Spacing & Borders
*   **Spacing Scale:** `xs` (4px), `sm` (8px), `md` (16px), `lg` (24px), `xl` (32px), `xxl` (48px)
*   **Corner Radii:** `xs` (4px), `sm` (8px), `md` (12px), `lg` (16px), `xl` (24px), `full` (9999px)
*   **Shadow States:** `none`, `sm` (subtle elevation), `md` (card float), `lg` (modals & overlays)
*   **Typography:** Default `System` sans-serif, sizes ranging from `caption` (12px) to `h1` (28px).

---

## 👥 User Roles & Flow Access
The app divides permissions into three distinct user paths:
1.  **Participant (Ketua Pasukan):** Joins events, navigates checkpoints, views clues, handles geofences, skips congested checkpoints, scans marshal QR codes, and crosses the finish line.
2.  **Crew (Marshal):** Manages a specific checkpoint, monitors arrival queues, verifies team completions, uploads photos, and applies manual overrides/penalties.
3.  **Admin (Organizer):** Designs events, edits geofences, configures checkpoints, sets game rules, manages teams, tracks live leaderboards, and handles DNF/penalties.

---

## 📱 Screen-by-Screen Interface Directory

### 1. Initial Access & Authentication

#### 🗺️ SplashScreen.tsx
*   **Target User:** All users launching the application.
*   **Layout & Visuals:** Minimalist full-screen layout. Centered application logo, app name "XploreQuest", and a loading spinner. Deep Forest Green background transitioning to cream.
*   **Interactive Features:** Auto-redirects to `RoleSelect` after a 2-second simulation.

#### 👥 RoleSelectScreen.tsx
*   **Target User:** First-time users, organizers, marshals, and participants.
*   **Layout & Visuals:** Cream background, large clear greeting heading. Contains three large card components representing the user roles. Each card features unique icons (Ionicons), custom role descriptions, and colors matching the role's primary color token.
*   **Interactive Features:**
    *   **Role Cards:** Select role ('participant', 'crew', 'admin') which dynamically updates the application-wide theme state.
    *   **System Showcase Shortcut:** Action button to view the `DesignSystemShowcase` component.

#### 🔑 LoginScreen.tsx
*   **Target User:** Registered participants, marshals, and organizers.
*   **Layout & Visuals:** Floating input card with a clean header. The card changes its accent borders and button colors depending on the selected role (e.g., Deep Forest Green for Participant, Trail Orange for Crew, Navy for Admin).
*   **Interactive Features:**
    *   **Email Input:** Interactive text field with clear placeholders.
    *   **Password Input:** Password mask field.
    *   **Demo Quick-Login:** Quick-selection tags to immediately populate credentials for `Ketua Pasukan`, `Pos Kawalan 3 Marshal`, or `Urus Setia Admin`.
    *   **Submit Button:** Triggers validation, context updates, and routes to respective dashboards.

---

### 2. Participant Interface System

#### 🏁 ParticipantJoinScreen.tsx
*   **Target User:** Participants (Team Leaders).
*   **Layout & Visuals:** Simple layout with step indicators. Contains input fields and action buttons.
*   **Interactive Features:**
    *   **Join Code Field:** Inputs event join code (e.g., `XT2026`).
    *   **Team Name Field:** Inputs the custom team name.
    *   **Members Count Select:** Adjusts number of members.
    *   **Dynamic Validation:** Validates active events in the local context.

#### 📊 ParticipantDashboardScreen.tsx
*   **Target User:** Active event participants.
*   **Layout & Visuals:** Multi-tab layout navigated through a bottom bar. Built-in elements include a live race timer, team point indicator, progress bar showing completion rate, and active toast message notifications.
*   **Sub-Tabs & Features:**
    *   **Dashboard Tab:**
        *   *Stopwatch Timer:* Dynamic hh:mm:ss tick timer representing elapsed race time.
        *   *Points Card:* Shows accumulated points.
        *   *Checkpoint Progress List:* A vertical lists of checkpoints with colored status badges (`locked`, `active`, `pending/skipped`, `completed`).
        *   *Skip Logic Action:* Allows skipping/postponing congested checkpoints, advancing the active target checkpoint.
    *   **Map Tab (embedded MapScreen.tsx):**
        *   *Geofencing Visualizer:* Map displaying geofence boundaries (circles) and markers for checkpoints.
        *   *Live Tracking Indicator:* Simulates the participant's location.
    *   **Scan Tab (embedded QRScanSimulationScreen.tsx):**
        *   *QR Scanner Overlay:* Displays a simulated camera view-finder with a moving horizontal scanning line.
        *   *Scan Simulation Buttons:* Simulates successful QR scans at checkpoints.
        *   *Manual Entry option:* Allows inputting 6-digit marshal pin codes in case of camera failure.
    *   **Profile Tab:**
        *   *Offline Toggle Switch:* Simulates offline capability and displays an `OfflineStatusChip` status bar.
        *   *App Rules:* Quick access card to read game policies.

#### 📍 CheckpointDetailScreen.tsx (Modal)
*   **Target User:** Participants requesting clue information.
*   **Layout & Visuals:** Bottom sheet or modal overlay containing details of a selected checkpoint.
*   **Interactive Features:**
    *   **Clue Box:** Displays text clues and task descriptions.
    *   **Reward Info:** Shows points awarded.
    *   **Geofence Verification Status:** Confirms if the team is inside the required geofence boundary.
    *   **Langkau Checkpoint (Skip):** Button to bypass the checkpoint if it is congested.

#### 🏁 FinishLineScreen.tsx & PersonalResultsScreen.tsx
*   **Target User:** Participants completing all checkpoints.
*   **Layout & Visuals:** Celebration cards with green/amber overlays, stat summaries, and result breakdowns.
*   **Interactive Features:**
    *   **Results Grid:** Displays final elapsed time, total points, completed checkpoints count, and skipped checkpoints count.
    *   **Save/Share Button:** Action to return to the landing dashboard.

---

### 3. Crew / Marshal Interface System

#### 🚨 CrewSelectCheckpointScreen.tsx
*   **Target User:** Crew members arriving at their assigned pos kawalan.
*   **Layout & Visuals:** Grid selection of available checkpoints.
*   **Interactive Features:**
    *   **Checkpoint Dropdown/Grid:** Selects which checkpoint the marshal is managing.
    *   **Confirm Station Button:** Binds the marshal's profile to that checkpoint and opens the Crew Dashboard.

#### 📋 CrewDashboardScreen.tsx
*   **Target User:** Checkpoint Marshals.
*   **Layout & Visuals:** Clean list view prioritizing team queues and checkpoint metrics. Includes a header card displaying the marshal's active checkpoint name (e.g. "CP-03: Taman Refleksi").
*   **Interactive Features:**
    *   **Active Queue List:** Lists teams currently waiting or checked-in at the station.
    *   **QR Code Generator:** Displays a dynamic QR code that updates every 30 seconds (simulated) to prevent participants from cheating by sharing screenshots.
    *   **Scan Participant Button:** Initiates crew camera to scan the participant team's ID.
    *   **Manual Verification Trigger:** Selection button to trigger verification wizard.

#### 🧙‍♂️ CrewVerificationWizard.tsx
*   **Target User:** Marshals verifying a team's completion.
*   **Layout & Visuals:** Multi-step wizard screen with dark slate panels and amber action steps.
*   **Interactive Features:**
    *   **Upload Photo Proof:** Simulation button representing camera snapshot validation.
    *   **Team Performance Rules Info:** Summarizes expected points.
    *   **Penalty Toggle/Sliders:** Adjusts manual penalty points or adds penalty minutes for rule violations.
    *   **Manual Override Button:** Permits manual sign-off in offline environments.

---

### 4. Admin / Organizer Interface System

#### 🛠️ OrganizerEntryScreen.tsx
*   **Target User:** Event organizers.
*   **Layout & Visuals:** Passcode entry overlay.
*   **Interactive Features:** Passcode verification inputs.

#### 🏗️ AdminCreateEventScreen.tsx
*   **Target User:** Admins setting up an event.
*   **Layout & Visuals:** Structured scrollable form.
*   **Interactive Features:**
    *   **Input Fields:** Event Name, Location Name, Join Code.
    *   **Sliders/Pickers:** Max Duration, Number of Checkpoints.
    *   **Create Button:** Initializes event in global storage.

#### 🗺️ AdminGeofenceDesignerScreen.tsx
*   **Target User:** Admins defining geofences.
*   **Layout & Visuals:** Full-screen interactive map with overlay control sliders.
*   **Interactive Features:**
    *   **Checkpoint Selection Panel:** Toggle between different checkpoints to edit their positions.
    *   **Geofence Radius Slider:** Slider adjusting geofence radius dynamically from 10 meters to 150 meters.
    *   **Map Coordinate Markers:** Tap-to-drop marker configuration.

#### 📋 AdminCheckpointManagerScreen.tsx
*   **Target User:** Admins managing checkpoint details.
*   **Layout & Visuals:** Interactive table/list showing coordinate states, clues, and tasks.
*   **Interactive Features:**
    *   **Edit Checkpoint Cards:** Form inputs to change clue text, points, coordinates, and task descriptions.
    *   **Re-order List:** Adjusts checkpoint index ordering.

#### ⚙️ AdminRulesConfigScreen.tsx
*   **Target User:** Admins adjusting security parameters.
*   **Layout & Visuals:** Toggle lists and slider settings cards.
*   **Interactive Features:**
    *   **Anti-Cheat Switches:** Enforce geofencing boundary verification before scanning.
    *   **Timer Limits:** Dynamic QR code refresh interval controls (e.g. 10s, 30s, 60s).
    *   **Skip Logic Limits:** Adjusts maximum allowed skipped checkpoints per team.

#### 🏆 AdminLeaderboardScreen.tsx
*   **Target User:** Organizers and public spectators.
*   **Layout & Visuals:** Premium real-time scoreboard. Rows highlight ranks, team names, completion counts, total elapsed times, and penalties.
*   **Interactive Features:**
    *   **Filter Tabs:** View all, view finished, view DNF.
    *   **Manual Penalty Panel:** Click on any team row to add/remove custom point penalties.

---

## 🔒 Modals & Edge Case Overlays

*   **CelebrationModal.tsx:** Triggered upon successful QR validation. Displays green success checkmarks, point animations, and congratulatory text.
*   **PendingBlockedModal.tsx:** Displays when a team attempts to bypass a checkpoint geofence or is flagged for manual audit by the backend. Blocks user dashboard access until resolved.
*   **AntiCheatExplainerScreen.tsx:** Viewable by participants. Educational panel that details the system's security features:
    *   *Geofence matching*
    *   *Dynamic QR rotation*
    *   *Offline cryptographic signatures*
    *   *Audit logging*
