/**
 * services/authState.ts
 *
 * Ephemeral in-memory bridge between LoginScreen (crew marshalId step)
 * and CrewSelectCheckpointScreen (PIN + checkpoint step).
 *
 * Why this module exists:
 *   The crew auth flow is split across two screens:
 *     1. LoginScreen  → user enters marshalId
 *     2. CrewSelectCheckpointScreen → user enters PIN and picks checkpoint
 *   Passing marshalId as a navigation param would require changing
 *   RootStackParamList in App.tsx (an undeclared change). Instead we use
 *   a simple module-level variable as an ephemeral staging area.
 *
 * Lifecycle:
 *   - Set immediately before navigating to CrewSelectCheckpointScreen.
 *   - Read when the crew login API call is made.
 *   - Cleared on successful auth OR on navigation back.
 *
 * This is NOT persisted — a cold restart clears it naturally.
 */

let _pendingMarshalId = '';

export function setPendingMarshalId(id: string): void {
  _pendingMarshalId = id.trim().toUpperCase();
}

export function getPendingMarshalId(): string {
  return _pendingMarshalId || 'USR-CREW-002';
}

export function clearPendingMarshalId(): void {
  _pendingMarshalId = '';
}
