/**
 * services/teamService.ts
 *
 * Frontend service for Team Registration and Management.
 */

import { Team } from '../mockData';

const API_BASE = (process.env['EXPO_PUBLIC_API_BASE_URL'] ?? '').replace(/\/$/, '');

export interface RegisterTeamPayload {
  name: string;
  leaderName?: string;
  memberCount: number;
  membersList?: string;
  phone?: string;
  joinCode?: string;
}

/**
 * Registers a new team under an event.
 * Unauthenticated endpoint — team registration occurs before the team leader has an account.
 */
export async function registerTeam(
  eventIdOrJoinCode: string,
  payload: RegisterTeamPayload
): Promise<Team> {
  const resp = await fetch(`${API_BASE}/events/${encodeURIComponent(eventIdOrJoinCode)}/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = (await resp.json()) as {
    success: boolean;
    data?: Team;
    error?: { code: string; message: string };
  };

  if (!resp.ok || !json.success || !json.data) {
    const msg = json.error?.message ?? 'Gagal mendaftar kumpulan. Sila cuba lagi.';
    throw new Error(msg);
  }

  return json.data;
}

/**
 * Fetches all teams for an event (Admin / Crew / Participant).
 */
export async function getTeams(
  eventId: string,
  idToken: string
): Promise<Team[]> {
  const resp = await fetch(`${API_BASE}/events/${encodeURIComponent(eventId)}/teams`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
  });

  const json = (await resp.json()) as {
    success: boolean;
    data?: Team[];
    error?: { code: string; message: string };
  };

  if (!resp.ok || !json.success || !json.data) {
    const msg = json.error?.message ?? 'Gagal memuat turun senarai kumpulan.';
    throw new Error(msg);
  }

  return json.data;
}

/**
 * Updates a team's status (Admin only).
 */
export async function updateTeamStatus(
  eventId: string,
  teamId: string,
  status: 'pending' | 'approved' | 'rejected',
  idToken: string
): Promise<Team> {
  const resp = await fetch(
    `${API_BASE}/events/${encodeURIComponent(eventId)}/teams/${encodeURIComponent(teamId)}/status`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ status }),
    }
  );

  const json = (await resp.json()) as {
    success: boolean;
    data?: Team;
    error?: { code: string; message: string };
  };

  if (!resp.ok || !json.success || !json.data) {
    const msg = json.error?.message ?? 'Gagal mengemaskini status kumpulan.';
    throw new Error(msg);
  }

  return json.data;
}
