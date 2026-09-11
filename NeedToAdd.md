# 📋 XploreQuest — Feature Enhancements & Feature Backlog

This document serves as the official specification and backlog of UI improvements, security enhancements, and new feature modules identified during project workflow reviews.

---

## 🔑 1. Marshal Login Screen (`CrewSelectCheckpointScreen.tsx`)

### Clarified Business Logic:
- **Start Checkpoint (`CP-START`):** Assigned exclusively to **one single primary Marshal** (e.g. *Ali*) who manages attendance check-in & initial wave release. Requires **BOTH** the specific **Marshal ID** and the **4-digit PIN Code**.
- **Intermediate & Finish Checkpoints (`CP-002` to `CP-TAMAT`):** Can be logged into by **multiple crew members** simultaneously to handle station congestion. Requires **ONLY the 4-digit PIN Code** (no Marshal ID required).

### Requirements to Add / Update:
1. **Dynamic Conditional Marshal ID Input:**
   - In `CrewSelectCheckpointScreen.tsx`, conditionally display the **"ID Krew / Marshal"** text input field **ONLY when `CP-START` (Start Checkpoint) is selected**.
   - If an intermediate or finish checkpoint is selected (e.g. `CP-002`, `CP-TAMAT`), **hide the Marshal ID input text field** and show **ONLY the 4-digit PIN Code input field**.
2. **Authentication Payload Update:**
   - For `CP-START`: Pass the user-entered `marshalId` + `pinCode`.
   - For Other Checkpoints: Auto-assign default crew ID (e.g. `CREW-SHARED-STATION`) + `pinCode`.

---

## 🛠️ 2. Admin / Organizer Dashboard Screens

### Requirements to Add / Update:
1. **Start Marshal & Crew PIN Display:**
   - In `AdminCheckpointManagerScreen.tsx` or `AdminEventDetailScreen.tsx`, add a **"Krew & Marshal Credentials"** card/section.
2. **Information to Display:**
   - **Start Checkpoint Primary Marshal ID** (e.g., `START-MARSHAL-ALI`).
   - **General Crew PIN Code** (shared across all checkpoint marshals).
   - Easy one-tap copy button to share credentials via WhatsApp.

---

## 🗺️ 3. Geofence Boundary Designer (`AdminGeofenceDesignerScreen.tsx`)

### Missing Feature:
- Currently, the map camera defaults to **Taman Tasik Titiwangsa** (`latitude: 3.1764, longitude: 101.7061`).
- Organizers hosting events at other locations (e.g., *Taman Pudu Ulu*, *Taman Botani Putrajaya*, etc.) must manually drag across the map to locate their venue.

### Requirements to Add:
1. **Location Search Bar (Geocoding / Location Finder):**
   - Add a search input floating at the top of the map view in `AdminGeofenceDesignerScreen.tsx`.
   - Allow organizers to type location names (e.g., *"Taman Pudu Ulu"*).
2. **Map Camera Repositioning:**
   - When a location is selected from search results or submitted, fetch its coordinates and trigger `mapRef.current?.animateToRegion(...)` to smoothly pan and zoom the map camera directly over the searched venue.
3. **Reset / Clear Boundary Action:**
   - Provide an option to reset/center the boundary polygon vertices around the newly searched location.

---

## 🌐 4. Web Pre-Registration Form & WhatsApp Approval Flow (`Firebase Hosting`)

### Concept & Objective:
- Prevent spam registrations by hosting a public web registration form on **Firebase Hosting** (100% free).
- The public registration link **must NOT contain or leak the secret Event Join Code** in the URL (to stop unverified users from downloading the app and bypassing payment/approval).

### URL Structure Requirement:
- **Public Form URL Format:** `xplorequest.web.app/registration-form/EventName` (e.g. `xplorequest.web.app/registration-form/ExploraceTasikTitiwangsa2026`).
- **Event Name Slug:** Automatically generated from the event name created by the organizer when setting up the event.

### Workflow & Features to Implement:
1. **Public Web Form (`Firebase Hosting`):**
   - Displays event name, banner, entry fee, payment bank details / DuitNow QR, and allowed team size.
   - Collects:
     - Team Name
     - Team Leader Name & WhatsApp Phone Number
     - Team Members' Names (dynamic fields based on `maxTeamSize`)
     - Payment Receipt Photo Upload (stored in Firebase Storage).
2. **Secret Event Join Code Isolation:**
   - The 6-character Event Join Code (e.g., `XT2026`) is **never exposed** on the web form or public URL.
3. **Organizer In-App Verification Panel (`AdminTeamsManagerScreen`):**
   - Pending form submissions land directly in the organizer's app under a **"Pre-Registration Queue"**.
   - Organizer reviews team details and payment receipt image.
4. **WhatsApp Auto-Broadcast Action:**
   - Upon clicking **"Approve & Send WhatsApp Code"**, the app opens WhatsApp to chat with the Team Leader, pre-filling a message with their unique/approved **Event Join Code**.
   - Team Leader enters the code into `ParticipantJoinScreen` in the XploreQuest mobile app to finalize their team entry.


