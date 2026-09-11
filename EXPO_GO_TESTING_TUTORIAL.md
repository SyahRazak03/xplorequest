# 📱 XploreQuest — Expo Go Mobile Testing Tutorial

This step-by-step guide explains how to run both the **Firebase Backend** and **Expo Mobile App** on your local machine and test them live on your mobile phone using **Expo Go** over Wi-Fi.

---

## 📋 Prerequisites

1. **Expo Go Installed on Phone**:
   - **iOS**: Download from [Apple App Store](https://apps.apple.com/app/expo-go/id982107779).
   - **Android**: Download from [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent).
2. **Same Wi-Fi Network**: Ensure your mobile phone and laptop/desktop are connected to the **exact same Wi-Fi connection**.

---

## 🛠️ Step 1: Find Your Laptop's Local Wi-Fi IP Address

1. Open **PowerShell** or **Command Prompt** on your laptop.
2. Run the following command:
   ```powershell
   ipconfig
   ```
3. Look under your active Wi-Fi adapter for **IPv4 Address** (e.g. `192.168.1.50` or `10.0.0.12`).
4. Note down this IP address.

---

## ⚙️ Step 2: Configure Frontend Environment Variables (`.env`)

1. Open `c:\Users\User\Desktop\XploreQuest\ui-for-xplore-quest\.env` in your text editor.
2. Update `EXPO_PUBLIC_API_BASE_URL` with your laptop's IPv4 address:

   ```env
   # Replace 192.168.1.50 with your laptop's actual IPv4 address
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:5001/xplorequest-cab6c/asia-southeast1/api
   ```

---

## 🚀 Step 3: Run Backend Emulators (Terminal 1)

If you haven't installed Firebase CLI tools globally yet, install it once:
```powershell
npm install -g firebase-tools
```

Then open a terminal and run:

```powershell
cd c:\Users\User\Desktop\XploreQuest\backend\functions
npm run serve
```

*(Or without global install, run: `npx firebase-tools emulators:start --config ..\firebase.json`)*

### Expected Terminal Output:
* **Firebase Emulators Running**:
  - **Functions API**: `http://127.0.0.1:5001/xplorequest-cab6c/asia-southeast1/api`
  - **Firestore Emulator**: `127.0.0.1:8080`
  - **Auth Emulator**: `127.0.0.1:9099`
  - **Storage Emulator**: `127.0.0.1:9199`
  - **Emulator UI (Browser Dashboard)**: `http://localhost:4000`

---

## 📱 Step 4: Run Expo Frontend (Terminal 2)

Open a **second** PowerShell terminal and run:

```powershell
cd c:\Users\User\Desktop\XploreQuest\ui-for-xplore-quest
npx expo start --clear
```

### Expected Terminal Output:
A large QR code will display in the terminal.

---

## 📲 Step 5: Open App in Expo Go on Phone

### For Android:
1. Open the **Expo Go** app on your phone.
2. Tap **"Scan QR Code"**.
3. Scan the QR code displayed in **Terminal 2**.

### For iOS (iPhone):
1. Open the built-in **Camera app**.
2. Point your camera at the QR code in **Terminal 2**.
3. Tap the **"Open in Expo Go"** banner that appears at the top.

---

## 🧪 Features Ready for Live Testing

Once the app loads in Expo Go, you can test:

1. **Participant Registration & Event Join**:
   - Register a team using event join code.
2. **Checkpoint Map & List View**:
   - Interactive map and checkpoint list with distance calculations.
3. **Dynamic QR Code Scanner**:
   - Participant scan verification with HMAC and geofence checks.
4. **Crew Station Marshal Wizard**:
   - Photo proof upload with magic-byte checks.
   - Manual override with mandatory audit reasons.
   - Bounded point and time penalties.
5. **Live Leaderboard (FR-09)**:
   - Real-time ranked team standings (`onSnapshot` subscription).
6. **Admin Race Rules Configuration**:
   - Modify `maxRaceTime`, `taskTimeLimit`, penalty caps, and feature toggles.

---

## 💡 Troubleshooting Guide

* **Issue: "Network Request Failed" on Phone**:
  - Check Windows Firewall: Ensure Node.js is allowed through Windows Defender Firewall for both Private and Public networks.
  - Verify phone and laptop are on the same Wi-Fi.

* **Issue: Wi-Fi Router Blocks Local Peer Connections**:
  - If your Wi-Fi network isolates devices, run Expo in Tunnel mode:
    ```powershell
    npx expo start --tunnel
    ```
