# XploreQuest Frontend Mock Data Audit Report

**Date**: September 20, 2026  
**Auditor**: Antigravity Implementation Agent  
**Scope**: `SyahRazak03/xplorequest` Monorepo — Frontend (`ui-for-xplore-quest`)  
**Status**: AUDIT ONLY — Zero code modifications, deletions, or edits executed during this pass.

---

## 1. Executive Summary & Audit Methodology

### Objective
This audit provides an exhaustive, evidence-based inventory of all remaining mock, demo, simulated, hardcoded fallback, random generator, and fake network delay patterns in the `ui-for-xplore-quest` frontend. This inventory enables the human reviewer to verify all data paths before approving an implementation plan for full real-backend integration.

### Coverage & Methodology
- **File Enumeration**: 100% of frontend files under `ui-for-xplore-quest/` were inspected, including **27 Screen files** in `screens/`, **17 Component files** in `components/`, service layers in `services/`, state providers (`AppContext.tsx`), and static data layers (`mockData.ts`).
- **Search Patterns Covered**:
  - `mock`, `Mock`, `MOCK` (Imports, variable names, identifiers)
  - `dummy`, `sample`, `fake`, `placeholder`
  - `demo`, `Demo`, `simulate`, `Simulate`, `simulation`
  - `setTimeout` combined with fake network delays / async state updates
  - `Math.random()` used to generate IDs, fallback coordinates, or scores
  - Hardcoded domain data arrays/objects assigned as default state
  - Static local fallback coordinates and preset test credentials
  - `TODO`, `FIXME`, `HACK` comments
- **Backend Standard**: Proposed replacements strictly map to existing Cloud Functions endpoints (Asia Southeast 1 region: `asia-southeast1`) and Firestore document structures implemented in Stages 1–17 and Features 1–5.

---

## 2. Mock & Demo Data Inventory Table

| File Path | Line(s) | Screen / Module | Mock Type | Proposed Real Source (Endpoint / Firestore Collection) | Confidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `mockData.ts` | 112–147 | Global Data Layer | Static exported mock arrays & objects (`mockEvent`, `mockTeams`, `mockCheckpoints`, `mockMarshals`, `mockLeaderboard`, `mockUserProfiles`) | Delete mock object exports; retain TypeScript type interfaces by renaming file to `types.ts`. | Certain |
| `AppContext.tsx` | 2 | Global State Provider | Import of mock types/objects from `./mockData` | Refactor import to `types.ts`. | Certain |
| `AppContext.tsx` | 65–76 | Global State Provider | Static fallback `defaultConfig` object (`tamatBonusPoints`, `maxTeamSize`, etc.) | Query `events/{eventId}/rules` via `GET /getEventRules` endpoint. | Certain |
| `AppContext.tsx` | 80, 151 | Global State Provider | Hardcoded fallback Crew PIN `'1234'` | Authenticate crew PIN dynamically against `events/{eventId}/marshals` via Firebase Auth token / Cloud Function. | Certain |
| `AppContext.tsx` | 36, 130, 207 | Global State Provider | `resetDemoState` state reset function | Remove demo reset logic; replace with authentic Firebase Auth session sign-out (`auth.signOut()`). | Certain |
| `AdminCheckpointManagerScreen.tsx` | 20 | Admin Checkpoint Manager | Import of `Checkpoint` from `../mockData` | Refactor import to `types.ts`. | Certain |
| `AdminCheckpointManagerScreen.tsx` | 36 | Admin Checkpoint Manager | `setTimeout` 1200ms delay simulating fake network fetch | Replace with direct `GET /listCheckpoints` (`events/{eventId}/checkpoints`). | Certain |
| `AdminCheckpointManagerScreen.tsx` | 108 | Admin Checkpoint Manager | Hardcoded fallback params (`EV-001` & `token-admin-casaria`) | Retrieve active `eventId` and `idToken` dynamically from `AppContext` and Firebase Auth. | Certain |
| `AdminCheckpointManagerScreen.tsx` | 156 | Admin Checkpoint Manager | `Math.floor(Math.random() * 900 + 100)` generating fallback ID `CP-xxx` | Firestore document ID automatically assigned by `POST /createCheckpoint` backend endpoint. | Certain |
| `AdminCreateEventScreen.tsx` | 28 | Admin Event Creator | Import of `EventConfig` from `../mockData` | Refactor import to `types.ts`. | Certain |
| `AdminCreateEventScreen.tsx` | 108, 303 | Admin Event Creator | `VENUE_SEARCH_DATABASE` hardcoded local venue search fallback array | Replace with Nominatim / Google Places API query via backend endpoint. | Certain |
| `AdminCreateEventScreen.tsx` | 138, 218, 253 | Admin Event Creator | `setTimeout` search debounces | Retain debouncing logic for live input fetching (Legitimate UI pattern). | Needs Review |
| `AdminCreateEventScreen.tsx` | 313 | Admin Event Creator | `Math.floor(Math.random() * 9000 + 1000)` generating random crew PIN | Backend endpoint `POST /createEvent` automatically generates secure crew PIN in Firestore. | Certain |
| `AdminCreateEventScreen.tsx` | 387, 391 | Admin Event Creator | `Math.floor(Math.random() * 900 + 100)` generating fallback `EV-xxx` ID | `POST /createEvent` returns generated Firestore `eventId`. | Certain |
| `AdminEventDetailScreen.tsx` | 36, 42 | Admin Event Detail | `Math.floor(Math.random() * 9000 + 1000)` generating Marshal ID `MSH-xxxx` | `POST /assignMarshal` assigns generated marshal ID in `events/{eventId}/marshals`. | Certain |
| `AdminEventDetailScreen.tsx` | 160, 177, 272 | Admin Event Detail | Hardcoded fallback strings (`MSH-8492`, `Maybank 564123456789`, `explorace-tasik-titiwangsa-2026`) | Display real properties fetched from `events/{eventId}` and `events/{eventId}/marshals`. | Certain |
| `AdminGeofenceDesignerScreen.tsx` | 29 | Geofence Designer | Import of `EventConfig` from `../mockData` | Refactor import to `types.ts`. | Certain |
| `AdminGeofenceDesignerScreen.tsx` | 128, 170, 253, 364 | Geofence Designer | `setTimeout` map animation and search debounces | Retain UI map animation timers; replace search fallback with live geocoding API. | Needs Review |
| `AdminGeofenceDesignerScreen.tsx` | 301, 303 | Geofence Designer | `demoVenues` hardcoded static location database array | Replace with live Nominatim geocoding search or Firestore `events/{eventId}/checkpoints`. | Certain |
| `AdminGeofenceDesignerScreen.tsx` | 509, 510 | Geofence Designer | Hardcoded fallback params (`EV-001`, `token-admin-casaria`) | Read active `eventId` from `AppContext` and Firebase Auth token. | Certain |
| `AdminLeaderboardScreen.tsx` | 57 | Admin Leaderboard | `setTimeout` 1200ms load delay timer | Replace with real `GET /getLeaderboard` (`events/{eventId}/leaderboard`). | Certain |
| `AdminLeaderboardScreen.tsx` | 124–195 | Admin Leaderboard | `setInterval` + `Math.random()` simulation loop fluctuating live scores | Replace with real-time Firestore `onSnapshot` listener on `events/{eventId}/teams`. | Certain |
| `AdminLeaderboardScreen.tsx` | 139, 140, 142, 147, 148 | Admin Leaderboard | `Math.random()` selecting random teams and shifting scores | Remove simulation logic completely; rely on server-calculated team scores. | Certain |
| `AdminPreRegistrationsScreen.tsx` | 95, 337 | Pre-Registrations Manager | Hardcoded event code fallback `'XT2026'` | Retrieve event code from active `events/{eventId}` Firestore document. | Certain |
| `AdminRulesConfigScreen.tsx` | 61 | Rules Configurator | Hardcoded fallback params (`EV-001`, `token-admin-casaria`) | Read active `eventId` from `AppContext` and Firebase Auth token. | Certain |
| `AdminRulesConfigScreen.tsx` | 68, 265, 266 | Rules Configurator | `SENARIO SIMULASI PEMARKAHAN` local scoring simulator card | Keep interactive preview logic, but save/load base rule values to `events/{eventId}/rules`. | Needs Review |
| `AdminTeamsManagerScreen.tsx` | 20 | Admin Teams Manager | Import of `Team` from `../mockData` | Refactor import to `types.ts`. | Certain |
| `AdminTeamsManagerScreen.tsx` | 121 | Admin Teams Manager | `Math.floor(Math.random() * 900 + 100)` generating fallback team ID `TEAM-xxx` | `POST /approvePreRegistration` or `POST /createTeam` returns Firestore `teamId`. | Certain |
| `AntiCheatExplainerScreen.tsx` | 44–111 | Anti-Cheat Explainer | Hardcoded educational slides array | Static UI content (educational guide). Keep slide text or move to static config file. | Needs Review |
| `AntiCheatExplainerScreen.tsx` | 151 | Anti-Cheat Explainer | `Simulasi Penipuan Kongsi Screenshot` simulation card & toggle | Remove interactive screenshot simulation toggle or isolate in dev tools. | Certain |
| `CelebrationModal.tsx` | 44–47, 78–79, 93, 99 | Celebration UI Modal | `Math.random()` particle physics and animation duration generator | Legitimate visual confetti animation physics (Not domain mock data). | Needs Review |
| `CheckpointDetailScreen.tsx` | 13 | Checkpoint Detail | Import of `Checkpoint` from `../mockData` | Refactor import to `types.ts`. | Certain |
| `CheckpointDetailScreen.tsx` | 135 | Checkpoint Detail | Static local image fallback `require('../assets/clue_landmark.png')` | Load `clueImageUrl` from `events/{eventId}/checkpoints/{checkpointId}` stored in Firebase Storage. | Certain |
| `CheckpointDetailScreen.tsx` | 202, 225 | Checkpoint Detail | `setTimeout` 300ms transition delays | Retain smooth transition timers (UI UX pattern). | Needs Review |
| `CrewDashboardScreen.tsx` | 27 | Crew Dashboard | Import of `Team`, `Checkpoint` from `../mockData` | Refactor import to `types.ts`. | Certain |
| `CrewDashboardScreen.tsx` | 65 | Crew Dashboard | Hardcoded event code fallback `EV-001` | Read active `eventId` from logged-in Marshal session in `AppContext`. | Certain |
| `CrewDashboardScreen.tsx` | 86, 182, 300 | Crew Dashboard | `setTimeout` 1500ms release timer & modal delays | Replace fake release timer with `POST /logCheckpointPass` (`events/{eventId}/logs`). | Certain |
| `CrewDashboardScreen.tsx` | 467 | Crew Dashboard | `Simulasi Scan Berjaya` button and simulated QR release trigger | Replace with authentic Expo Camera QR Scanner reading participant QR. | Certain |
| `CrewSelectCheckpointScreen.tsx` | 20 | Crew CP Selection | Import of `Checkpoint`, `EventConfig` from `../mockData` | Refactor import to `types.ts`. | Certain |
| `CrewSelectCheckpointScreen.tsx` | 54–59 | Crew CP Selection | Hardcoded `currentEvent` fallback object (`EV-001`, `Explorace Titiwangsa 2026`) | Query active event details from `events/{eventId}` via `GET /getEventDetails`. | Certain |
| `CrewVerificationWizard.tsx` | 21 | Crew Verification | Import of `Team`, `Checkpoint` from `../mockData` | Refactor import to `types.ts`. | Certain |
| `CrewVerificationWizard.tsx` | 266 | Crew Verification | Static local image fallback `require('../assets/team_photo_proof.png')` | Fetch `photoProofUrl` from `events/{eventId}/submissions/{submissionId}` in Firebase Storage. | Certain |
| `DashboardScreen.tsx` | 64–90 | Role Dashboard | `getRoadmapForRole` static demo progress roadmap array | Render dynamic participant stage fetched from `events/{eventId}/teams/{teamId}`. | Certain |
| `DashboardScreen.tsx` | 423–446 | Role Dashboard | `demoToggleCard` CSS styling classes | Remove demo styling rules upon removing demo cards. | Certain |
| `FinishLineScreen.tsx` | 19 | Finish Line | Import of `Checkpoint` from `../mockData` | Refactor import to `types.ts`. | Certain |
| `FinishLineScreen.tsx` | 24 | Finish Line | Import of `QRScanSimulationScreen` | Remove simulation screen import; integrate Expo Camera QR Scanner. | Certain |
| `FinishLineScreen.tsx` | 38 | Finish Line | Fallback component props (`points = 250, elapsedTime = 5075`) | Calculate points and elapsed time from Firestore finish record (`POST /finishRace`). | Certain |
| `FinishLineScreen.tsx` | 98, 252, 253 | Finish Line | Camera simulation launcher & `<QRScanSimulationScreen ... />` rendering | Replace modal with live Expo Camera scanner component. | Certain |
| `FinishLineScreen.tsx` | 108 | Finish Line | `setTimeout` 400ms delay | Replace with async response handler from `POST /finishRace`. | Certain |
| `LoginScreen.tsx` | 50–64 | Login Screen | `handleAutofill` demo credentials preset (`azman@xplorequest.com`) | Remove autofill helper function; authenticate via authentic Firebase Auth credentials. | Certain |
| `LoginScreen.tsx` | 266–283 | Login Screen | `Isi Auto Akaun Ujian` quick-autofill button | Remove demo autofill button from UI. | Certain |
| `MapScreen.tsx` | 21 | Interactive Map | Import of `Checkpoint` from `../mockData` | Refactor import to `types.ts`. | Certain |
| `MapScreen.tsx` | 37–43 | Interactive Map | Hardcoded `DEFAULT_BOUNDARY_POLYGON` fallback coordinate array | Fetch `boundaryPolygon` from `events/{eventId}` document in Firestore. | Certain |
| `MapScreen.tsx` | 166 | Interactive Map | Hardcoded fallback center coordinate `(3.1764, 101.7061)` | Center map dynamically on first checkpoint or event center coordinates. | Certain |
| `MapScreen.tsx` | 397 | Interactive Map | Simulated User Location Marker component | Replace simulated marker with live `expo-location` GPS tracking marker. | Certain |
| `OrganizerEntryScreen.tsx` | 7 | Organizer Portal Entry | Header comment noting mockdata-driven form logic | Update header comment after wiring form to authentic backend endpoints. | Certain |
| `OrganizerEntryScreen.tsx` | 134–145 | Organizer Portal Entry | `handleAutofill` hardcoded organizer test credentials | Remove autofill helper function; process real form submissions. | Certain |
| `ParticipantDashboardScreen.tsx` | 23 | Participant Dashboard | Import of `Checkpoint` from `../mockData` | Refactor import to `types.ts`. | Certain |
| `ParticipantDashboardScreen.tsx` | 29 | Participant Dashboard | Import of `QRScanSimulationScreen` | Remove simulation screen import; render live Expo Camera scanner. | Certain |
| `ParticipantDashboardScreen.tsx` | 46–48 | Participant Dashboard | Hardcoded initial completed checkpoint array (`['CP-START']`, `'CP-003'`) | Fetch team completed checkpoints dynamically from `events/{eventId}/teams/{teamId}`. | Certain |
| `ParticipantDashboardScreen.tsx` | 198, 461, 597, 618, 667, 875, 937, 993 | Participant Dashboard | `handleSimulateScan(...)` simulation trigger calls | Replace simulation triggers with authentic QR scan handler sending token to backend. | Certain |
| `ParticipantDashboardScreen.tsx` | 639, 1005 | Participant Dashboard | `<QRScanSimulationScreen ... />` & simulated camera viewfinder | Replace simulation modal with Expo Camera component. | Certain |
| `ParticipantDashboardScreen.tsx` | 843, 1538 | Participant Dashboard | `demoHintText` styling and display strings | Remove demo hint texts. | Certain |
| `ParticipantJoinScreen.tsx` | 22 | Event Join Screen | Import of `Team` type from `../mockData` | Refactor import to `types.ts`. Query `events/{eventId}/teams` via `POST /joinEvent`. | Certain |
| `PendingBlockedModal.tsx` | 12 | Status Modal | Import of `Checkpoint` from `../mockData` | Refactor import to `types.ts`. | Certain |
| `PersonalResultsScreen.tsx` | 49, 164 | Personal Results | `handleFinishDemo` demo reset handler and button | Replace demo button with authentic navigation back to `DashboardScreen`. | Certain |
| `QRScanSimulationScreen.tsx` | 15, 23, 32, 97, 129 | QR Scanner Simulator | Entire component (simulated camera viewport, laser animation, simulated scan completion buttons) | NO BACKEND REPLACEMENT (Entire file will be deleted / replaced by Expo Camera component). | Certain |
| `StaggeredStartScreen.tsx` | 25 | Staggered Start | `interface OtherTeamMock` interface declaration | Refactor interface to `OtherTeam`; fetch wave schedule from `events/{eventId}/teams`. | Certain |
| `StaggeredStartScreen.tsx` | 40, 197, 199 | Staggered Start | 10-second auto-start countdown timer for demo | Replace 10s demo countdown with real-time countdown to team's `assignedStartTime`. | Certain |
| `components/AdminDNFWatchPanel.tsx` | 1–150 | Admin DNF Panel | Fast-forward simulation timer ticks for team stall counters | Fetch actual team timestamps from Firestore and compute real stall durations. | Certain |
| `components/CheckpointFormModal.tsx` | 16 | Checkpoint Modal | Import of `Checkpoint` from `../mockData` | Refactor import to `types.ts`. | Certain |
| `components/CheckpointFormModal.tsx` | 132, 133 | Checkpoint Modal | `Math.random()` generating random fallback coordinates (`3.17 + Math.random() * 0.01`) | Use exact coordinates selected on Map Picker or device GPS coordinates. | Certain |
| `components/CheckpointListItem.tsx` | 4 | Checkpoint Item | Import of `Checkpoint` from `../mockData` | Refactor import to `types.ts`. | Certain |
| `components/ClueBottomSheet.tsx` | 13 | Clue Sheet | Import of `Checkpoint` from `../mockData` | Refactor import to `types.ts`. | Certain |
| `components/ClueBottomSheet.tsx` | 167, 191 | Clue Sheet | `setTimeout` fake submission delays | Replace fake delay timers with async response handling from `POST /submitAnswer`. | Certain |
| `components/DemoMenu.tsx` | 1–60 | Demo Role Switcher | Entire floating demo menu widget allowing role switching and state resets | Delete component completely or wrap in `__DEV__` environment check. | Certain |
| `components/DesignSystemDemo.demo.tsx` | 1–427 | Design Showcase | Entire design system showcase demo component | Exclude from production build navigation stack. | Certain |
| `services/checkpointService.ts` | 8 | Checkpoint Service | Import of `Checkpoint` from `../mockData` | Refactor import to `types.ts`. | Certain |
| `services/teamService.ts` | 10 | Team Service | Import of `Team` from `../mockData` | Refactor import to `types.ts`. | Certain |

---

## 3. Flagged Items & Items Needing Review

1. **`CelebrationModal.tsx` (Lines 44–47, 78–79, 93, 99)**:
   - Uses `Math.random()` to randomize confetti particle positions, colors, and fall speeds.
   - **Recommendation**: Retain as a purely aesthetic UI animation helper. It is not domain mock data.

2. **`AdminRulesConfigScreen.tsx` (Lines 68, 265–267)**:
   - Contains a live scoring simulator card ("Simulator Senario Pemarkahan Nyata").
   - **Recommendation**: Keep the client-side calculator UI as an interactive feature for organizers, but populate base rule parameters directly from `events/{eventId}/rules`.

3. **`AntiCheatExplainerScreen.tsx` (Lines 44–111)**:
   - Hardcoded educational content slides explaining anti-cheat rules to participants.
   - **Recommendation**: Retain as static UI content.

4. **`AdminCreateEventScreen.tsx` & `AdminGeofenceDesignerScreen.tsx` (Debounce `setTimeout` calls)**:
   - `setTimeout` timers are used to debounce location text search inputs.
   - **Recommendation**: Retain input debouncing logic, but replace the underlying search callback target from `demoVenues` to a live geocoding API.

---

## 4. Appendix: Raw Search Tool Output

### Appendix A: `git grep -n -i "mock"`
```text
AppContext.tsx:2:import { UserRole, UserProfile, EventConfig, Checkpoint, Team } from './mockData';
components/CheckpointFormModal.tsx:16:import { Checkpoint } from '../mockData';
components/CheckpointListItem.tsx:4:import { Checkpoint, CheckpointStatus } from '../mockData';
components/ClueBottomSheet.tsx:13:import { Checkpoint, CheckpointStatus } from '../mockData';
components/DemoMenu.tsx:6: * seamlessly jump between roles and mock screen states.
mockData.ts:2: * mockData.ts
mockData.ts:3: * Self-contained Mock Data Layer for XploreQuest
mockData.ts:112:export const mockEvent: EventConfig = {
mockData.ts:121:export const mockEventsList: EventConfig[] = [];
mockData.ts:123:export const mockTeams: Team[] = [];
mockData.ts:125:export const mockCheckpoints: Checkpoint[] = [];
mockData.ts:127:export const mockMarshals: Marshal[] = [];
mockData.ts:129:export const mockLeaderboard: LeaderboardEntry[] = [];
mockData.ts:131:export const mockUserProfiles: Record<UserRole, UserProfile> = {
screens/AdminCheckpointManagerScreen.tsx:20:import { Checkpoint } from '../mockData';
screens/AdminCreateEventScreen.tsx:28:import type { EventConfig } from '../mockData';
screens/AdminGeofenceDesignerScreen.tsx:29:import type { EventConfig } from '../mockData';
screens/AdminTeamsManagerScreen.tsx:20:import { Team } from '../mockData';
screens/CheckpointDetailScreen.tsx:13:import { Checkpoint, CheckpointStatus } from '../mockData';
screens/CrewDashboardScreen.tsx:27:import { Team, Checkpoint } from '../mockData';
screens/CrewSelectCheckpointScreen.tsx:20:import { Checkpoint, EventConfig } from '../mockData';
screens/CrewVerificationWizard.tsx:21:import { Team, Checkpoint } from '../mockData';
screens/FinishLineScreen.tsx:19:import { Checkpoint } from '../mockData';
screens/MapScreen.tsx:21:import { Checkpoint, CheckpointStatus } from '../mockData';
screens/OrganizerEntryScreen.tsx:7: * All form logic is mockdata-driven for demo purposes.
screens/ParticipantDashboardScreen.tsx:23:import { Checkpoint, CheckpointStatus } from '../mockData';
screens/ParticipantDashboardScreen.tsx:628:  // Tab 3: Mock QR Scan View Content
screens/ParticipantDashboardScreen.tsx:1220:  mapMockupContainer: {
screens/ParticipantJoinScreen.tsx:22:import type { Team } from '../mockData';
screens/PendingBlockedModal.tsx:12:import { Checkpoint } from '../mockData';
screens/QRScanSimulationScreen.tsx:15:import { Checkpoint } from '../mockData';
screens/StaggeredStartScreen.tsx:25:interface OtherTeamMock {
services/checkpointService.ts:8:import type { Checkpoint } from '../mockData';
services/teamService.ts:10:import type { Team } from '../mockData';
```

### Appendix B: `git grep -n -i "demo"`
```text
App.tsx:8:import { DesignSystemDemo } from './components/DesignSystemDemo.demo';
App.tsx:34:import { DemoMenu, navigationRef } from './components';
App.tsx:130:            component={DesignSystemDemo}
AppContext.tsx:36:  resetDemoState: () => void;
AppContext.tsx:130:  const resetDemoState = () => {
AppContext.tsx:207:        resetDemoState,
components/DemoMenu.tsx:4: * This component (DemoMenu.tsx) is a presentation/storytelling aid designed 
components/DemoMenu.tsx:35:export const DemoMenu = () => {
components/DemoMenu.tsx:46:    resetDemoState,
components/DemoMenu.tsx:71:            resetDemoState();
components/DesignSystemDemo.demo.tsx:23:export const DesignSystemDemo: React.FC = () => {
components/DesignSystemDemo.demo.tsx:31:  const triggerLoadingDemo = () => {
components/DesignSystemDemo.demo.tsx:60:            Dapo Awoknyee Resources (KL Event Crew) Demo
components/DesignSystemDemo.demo.tsx:110:          title="Perincian Mod Demo"
components/DesignSystemDemo.demo.tsx:189:              onPress={triggerLoadingDemo}
components/DesignSystemDemo.demo.tsx:427:export default DesignSystemDemo;
components/index.ts:15:export * from './DemoMenu';
mockData.ts:4: * Created for Dapo Awoknyee Resources (KL Event Crew) client demo.
mockData.ts:62:  latitude: number; // For geofencing demo mapping
screens/AdminGeofenceDesignerScreen.tsx:301:        // Fallback search database for popular Malaysian event venues (works offline / demo)
screens/AdminGeofenceDesignerScreen.tsx:303:        const demoVenues: PlaceSearchResult[] = [
screens/AdminGeofenceDesignerScreen.tsx:341:        const matched = demoVenues.filter(
screens/DashboardScreen.tsx:64:  // Roadmap details to show progress during demo
screens/DashboardScreen.tsx:423:  demoToggleCard: {
screens/DashboardScreen.tsx:427:  demoToggleRow: {
screens/DashboardScreen.tsx:433:  demoToggleText: {
screens/DashboardScreen.tsx:436:  demoToggleTitle: {
screens/DashboardScreen.tsx:441:  demoToggleSubtitle: {
screens/LoginScreen.tsx:50:    // Demo credentials autofill is strictly restricted to non-production development builds
screens/LoginScreen.tsx:53:      Alert.alert('Not Available', 'Demo autofill is disabled in production builds.');
screens/LoginScreen.tsx:61:      setAdminEmail(process.env['EXPO_PUBLIC_DEMO_ADMIN_EMAIL'] ?? 'azman@xplorequest.com');
screens/LoginScreen.tsx:62:      setAdminPassword(process.env['EXPO_PUBLIC_DEMO_ADMIN_PASSWORD'] ?? '');
screens/OrganizerEntryScreen.tsx:7: * All form logic is mockdata-driven for demo purposes.
screens/OrganizerEntryScreen.tsx:136:      setLoginEmail(process.env['EXPO_PUBLIC_DEMO_ADMIN_EMAIL'] || 'azman@xplorequest.com');
screens/ParticipantDashboardScreen.tsx:42:  // 1. Race States (Dynamic for demo interaction)
screens/ParticipantDashboardScreen.tsx:843:                <Text style={styles.demoHintText}>
screens/ParticipantDashboardScreen.tsx:1538:  demoHintText: {
screens/PersonalResultsScreen.tsx:49:  const handleFinishDemo = () => {
screens/PersonalResultsScreen.tsx:164:            onPress={handleFinishDemo}
screens/StaggeredStartScreen.tsx:40:  // 10-second auto-start countdown timer for demo
screens/StaggeredStartScreen.tsx:197:        {/* Action Button & Auto Start Demo Countdown */}
screens/StaggeredStartScreen.tsx:199:          {/* Live 10s Demo Auto Start Indicator */}
```

### Appendix C: `git grep -n -i "simulat"`
```text
mockData.ts:82:  activeQueueCount: number; // Simulated pending team arrivals
screens/AdminLeaderboardScreen.tsx:124:  // 2. Simulated real-time sorting/ticking updates (only when race has started)
screens/AdminRulesConfigScreen.tsx:68:  // Simulated: 10 minutes late, 1 task skipped
screens/AdminRulesConfigScreen.tsx:265:        {/* Live Simulator Summary Card */}
screens/AdminRulesConfigScreen.tsx:266:        <Card role="admin" style={styles.simulatorCard} title="Simulator Senario Pemarkahan Nyata" borderAccent="left">
screens/AdminRulesConfigScreen.tsx:267:          <Text style={styles.simulatorDescription}>
screens/AdminRulesConfigScreen.tsx:464:  simulatorCard: {
screens/AdminRulesConfigScreen.tsx:467:  simulatorDescription: {
screens/AntiCheatExplainerScreen.tsx:151:        {/* Cheat Simulation Trigger Card */}
screens/AntiCheatExplainerScreen.tsx:209:                    {/* Explainer graphics simulation (e.g. locks or ticks representation) */}
screens/CrewDashboardScreen.tsx:467:              {/* Simulated QR Code Wrapper */}
screens/FinishLineScreen.tsx:24:import QRScanSimulationScreen from './QRScanSimulationScreen';
screens/FinishLineScreen.tsx:98:      // Allowed: Launch camera simulation for CP-TAMAT
screens/FinishLineScreen.tsx:252:      {/* Camera/QR Scanner Simulation screen */}
screens/FinishLineScreen.tsx:253:      <QRScanSimulationScreen
screens/MapScreen.tsx:397:          {/* User Location Simulated Marker (if standalone/testing) */}
screens/ParticipantDashboardScreen.tsx:29:import QRScanSimulationScreen from './QRScanSimulationScreen';
screens/ParticipantDashboardScreen.tsx:67:  // QR Scan simulation modal states
screens/ParticipantDashboardScreen.tsx:198:  const handleSimulateScan = (targetCpId?: string) => {
screens/ParticipantDashboardScreen.tsx:461:                    onPress={() => handleSimulateScan(currentCp.id)}
screens/ParticipantDashboardScreen.tsx:597:                onPressScan={() => handleSimulateScan(cp.id)}
screens/ParticipantDashboardScreen.tsx:618:        onPressScan={handleSimulateScan}
screens/ParticipantDashboardScreen.tsx:639:        {/* Simulated Camera Viewfinder */}
screens/ParticipantDashboardScreen.tsx:667:            onPress={() => handleSimulateScan()}
screens/ParticipantDashboardScreen.tsx:875:          onPress={() => handleSimulateScan()}
screens/ParticipantDashboardScreen.tsx:937:            handleSimulateScan();
screens/ParticipantDashboardScreen.tsx:993:        onScanQR={handleSimulateScan}
screens/ParticipantDashboardScreen.tsx:1004:      {/* QR Scan Simulator Modal */}
screens/ParticipantDashboardScreen.tsx:1005:      <QRScanSimulationScreen
screens/QRScanSimulationScreen.tsx:23:interface QRScanSimulationScreenProps {
screens/QRScanSimulationScreen.tsx:32:export default function QRScanSimulationScreen({
screens/QRScanSimulationScreen.tsx:37:}: QRScanSimulationScreenProps) {
```

### Appendix D: `git grep -n -i "setTimeout"`
```text
components/ClueBottomSheet.tsx:167:                        setTimeout(() => {
components/ClueBottomSheet.tsx:191:                        setTimeout(() => {
components/DesignSystemDemo.demo.tsx:33:    setTimeout(() => {
components/OfflineStatusChip.tsx:46:      const timer = setTimeout(() => {
components/ToastNotification.tsx:39:      const timer = setTimeout(() => {
screens/AdminCheckpointManagerScreen.tsx:36:    const timer = setTimeout(() => {
screens/AdminCreateEventScreen.tsx:138:    searchDebounceRef.current = setTimeout(async () => {
screens/AdminEventDetailScreen.tsx:90:    setTimeout(() => setCopiedField(null), 2000);
screens/AdminGeofenceDesignerScreen.tsx:128:      setTimeout(() => {
screens/AdminGeofenceDesignerScreen.tsx:170:      setTimeout(() => {
screens/AdminGeofenceDesignerScreen.tsx:253:    searchTimeoutRef.current = setTimeout(async () => {
screens/AdminLeaderboardScreen.tsx:57:    const timer = setTimeout(() => {
screens/AdminLeaderboardScreen.tsx:191:      setTimeout(() => {
screens/CheckpointDetailScreen.tsx:202:                setTimeout(() => {
screens/CheckpointDetailScreen.tsx:225:                setTimeout(() => {
screens/CrewDashboardScreen.tsx:86:    const fallbackTimer = setTimeout(() => {
screens/CrewDashboardScreen.tsx:182:    setTimeout(() => {
screens/CrewDashboardScreen.tsx:300:                setTimeout(() => setSuccessModalVisible(true), 300);
screens/FinishLineScreen.tsx:108:    setTimeout(() => {
screens/QRScanSimulationScreen.tsx:97:      timerRef.current = setTimeout(() => {
screens/QRScanSimulationScreen.tsx:129:    exitTimerRef.current = setTimeout(() => {
screens/SplashScreen.tsx:44:    const timer = setTimeout(() => {
```

### Appendix E: `git grep -n -i "Math.random"`
```text
components/CheckpointFormModal.tsx:132:      latitude: checkpoint?.latitude || 3.17 + Math.random() * 0.01,
components/CheckpointFormModal.tsx:133:      longitude: checkpoint?.longitude || 101.7 + Math.random() * 0.01,
screens/AdminCheckpointManagerScreen.tsx:156:      const newCpId = data.id || `CP-${Math.floor(Math.random() * 900 + 100)}`;
screens/AdminCreateEventScreen.tsx:313:    return Math.floor(Math.random() * 9000 + 1000).toString();
screens/AdminCreateEventScreen.tsx:387:    const finalSlug = effectiveSlug || `event-${Math.floor(Math.random() * 900 + 100)}`;
screens/AdminCreateEventScreen.tsx:391:      id: `EV-${Math.floor(Math.random() * 900 + 100)}`,
screens/AdminEventDetailScreen.tsx:36:      const generatedId = `MSH-${Math.floor(Math.random() * 9000 + 1000)}`;
screens/AdminEventDetailScreen.tsx:42:    const newId = `MSH-${Math.floor(Math.random() * 9000 + 1000)}`;
screens/AdminLeaderboardScreen.tsx:139:      const idx1 = nonDnfIndices[Math.floor(Math.random() * nonDnfIndices.length)];
screens/AdminLeaderboardScreen.tsx:140:      let idx2 = nonDnfIndices[Math.floor(Math.random() * nonDnfIndices.length)];
screens/AdminLeaderboardScreen.tsx:142:        idx2 = nonDnfIndices[Math.floor(Math.random() * nonDnfIndices.length)];
screens/AdminLeaderboardScreen.tsx:147:      const change1 = changeOptions[Math.floor(Math.random() * changeOptions.length)];
screens/AdminLeaderboardScreen.tsx:148:      const change2 = changeOptions[Math.floor(Math.random() * changeOptions.length)];
screens/AdminTeamsManagerScreen.tsx:121:        id: `TEAM-${Math.floor(Math.random() * 900 + 100)}`,
screens/CelebrationModal.tsx:44:      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
screens/CelebrationModal.tsx:45:      size: Math.random() * 8 + 6,
screens/CelebrationModal.tsx:46:      left: Math.random() * width,
screens/CelebrationModal.tsx:47:      shape: Math.random() > 0.5 ? 'circle' : 'square',
screens/CelebrationModal.tsx:78:        const delay = Math.random() * 2000;
screens/CelebrationModal.tsx:79:        const duration = Math.random() * 3000 + 2500;
screens/CelebrationModal.tsx:93:                toValue: (Math.random() - 0.5) * 160,
screens/CelebrationModal.tsx:99:                toValue: Math.random() * 360 * 3,
```
