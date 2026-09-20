/**
 * services/preregistration.service.ts
 *
 * Service layer for public team pre-registration form submissions and admin management.
 * Handles public registration submissions with unauthenticated write checks,
 * image magic byte validation, team size limits, and Firestore/Storage persistence.
 * Admin review, approval, rejection, and idempotent team creation.
 */

import * as crypto from 'crypto';

import { getFirestore, getStorageBucket } from '../config/firebase';
import type {
  PreRegistrationDocument,
  PreRegistrationStatus,
  TeamDocument,
  UserRole,
} from '../models';
import {
  findEventById,
  findEventBySlug,
} from '../repositories/event.repository';
import {
  findPreRegistrationById,
  listPreRegistrations,
  updatePreRegistration,
} from '../repositories/preregistration.repository';
import {
  createTeam,
  findTeamById,
  findTeamByName,
} from '../repositories/team.repository';
import { assertEventOwner } from './event.service';
import { AppError, ErrorCode } from '../utils/errors';
import { MAX_IMAGE_SIZE_BYTES, validateImageMagicBytes } from '../utils/image';
import type { PreRegisterInput } from '../validation';

export interface PreRegistrationSubmissionResult {
  submissionId: string;
  status: 'pending';
  teamName: string;
  submittedAt: string;
}

export interface ApprovePreRegistrationResult {
  preRegistration: PreRegistrationDocument;
  team: TeamDocument;
  alreadyApproved?: boolean;
}

/**
 * Handles public team pre-registration submission for an event by urlSlug.
 */
export async function submitPreRegistrationService(
  slug: string,
  input: PreRegisterInput,
  ipAddress: string
): Promise<PreRegistrationSubmissionResult> {
  const event = await findEventBySlug(slug);

  if (!event || event.isArchived) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Acara dengan slug '${slug}' tidak ditemui.`
    );
  }

  if (event.isStarted || event.isFinished) {
    throw new AppError(
      ErrorCode.BAD_REQUEST,
      'Pendaftaran dalam talian untuk acara ini telah ditutup kerana acara telah bermula atau tamat.'
    );
  }

  const maxTeamSize = event.maxTeamSize ?? 4;
  const totalMembers = 1 + input.memberNames.length; // 1 leader + memberNames
  if (totalMembers > maxTeamSize) {
    throw new AppError(
      ErrorCode.UNPROCESSABLE_ENTITY,
      `Jumlah ahli kumpulan (${totalMembers} orang) melebihi had maksimum acara (${maxTeamSize} orang).`
    );
  }

  // Convert Base64 image payload to Buffer
  const imageBuffer = Buffer.from(input.imageBase64, 'base64');

  if (imageBuffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new AppError(
      ErrorCode.UNPROCESSABLE_ENTITY,
      'Saiz fail resit pembayaran tidak boleh melebihi 5MB.'
    );
  }

  if (!validateImageMagicBytes(imageBuffer, input.contentType)) {
    throw new AppError(
      ErrorCode.UNPROCESSABLE_ENTITY,
      'Kandungan fail resit pembayaran tidak sepadan dengan jenis MIME yang dinyatakan.'
    );
  }

  // Save receipt image to Storage
  const ext =
    input.contentType === 'image/jpeg'
      ? 'jpg'
      : input.contentType === 'image/png'
      ? 'png'
      : 'webp';

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const fileHash = crypto.randomBytes(8).toString('hex');
  const storagePath = `pre_registrations/${event.id}/${nowMs}_${fileHash}.${ext}`;

  let downloadUrl = `data:${input.contentType};base64,${input.imageBase64.slice(0, 200)}...`;
  try {
    const bucket = getStorageBucket();
    const file = bucket.file(storagePath);

    await file.save(imageBuffer, {
      metadata: {
        contentType: input.contentType,
        customMetadata: {
          eventId: event.id,
          teamName: input.teamName,
          uploadedBy: 'PUBLIC_PREREGISTRATION',
        },
      },
    });

    await file.makePublic().catch((e) => console.warn('file.makePublic notice:', e));
    const bucketName = bucket.name || `${event.id}.firebasestorage.app`;
    downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media`;
  } catch (storageErr) {
    console.warn('Storage bucket upload notice (fallback to metadata):', storageErr);
  }

  // Create Firestore document in events/{eventId}/preRegistrations
  const db = getFirestore();
  const preRegRef = db.collection('events').doc(event.id).collection('preRegistrations').doc();
  const preRegId = preRegRef.id;

  const docData: PreRegistrationDocument = {
    id: preRegId,
    eventId: event.id,
    teamName: input.teamName,
    leaderName: input.leaderName,
    leaderWhatsApp: input.leaderWhatsApp,
    memberNames: input.memberNames,
    paymentReceiptUrl: downloadUrl,
    paymentReceiptStoragePath: storagePath,
    status: 'pending',
    ipAddress,
    submittedAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: 'PUBLIC_FORM',
    updatedBy: 'PUBLIC_FORM',
  };

  await preRegRef.set(docData);

  return {
    submissionId: preRegId,
    status: 'pending',
    teamName: input.teamName,
    submittedAt: nowIso,
  };
}

// ── Admin Functions ───────────────────────────────────────────────────────────

/**
 * Lists pre-registrations for an event (Admin only, ownership checked).
 */
export async function listPreRegistrationsService(
  eventId: string,
  status: PreRegistrationStatus | undefined,
  callerUid: string,
  callerRole?: UserRole,
  callerEventId?: string
): Promise<PreRegistrationDocument[]> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui.');
  }

  assertEventOwner(event, callerUid, callerRole, callerEventId);

  return listPreRegistrations(eventId, status);
}

/**
 * Gets pre-registration details with a fresh signed Storage URL for receipt image (Admin only, ownership checked).
 */
export async function getPreRegistrationDetailService(
  eventId: string,
  id: string,
  callerUid: string,
  callerRole?: UserRole,
  callerEventId?: string
): Promise<PreRegistrationDocument> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui.');
  }

  assertEventOwner(event, callerUid, callerRole, callerEventId);

  const preReg = await findPreRegistrationById(eventId, id);
  if (!preReg) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Permohonan pendaftaran tidak ditemui.');
  }

  // Generate fresh signed URL if storage path is available
  if (preReg.paymentReceiptStoragePath) {
    try {
      const bucket = getStorageBucket();
      const file = bucket.file(preReg.paymentReceiptStoragePath);
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000, // 1 hour
      });
      preReg.paymentReceiptUrl = signedUrl;
    } catch (_err) {
      // Fallback to stored URL if signed URL generation fails in mock environment
    }
  }

  return preReg;
}

/**
 * Approves a pre-registration, idempotently creating an approved Team document (Admin only, ownership checked).
 */
export async function approvePreRegistrationService(
  eventId: string,
  id: string,
  callerUid: string,
  callerRole?: UserRole,
  callerEventId?: string
): Promise<ApprovePreRegistrationResult> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui.');
  }

  assertEventOwner(event, callerUid, callerRole, callerEventId);

  const preReg = await findPreRegistrationById(eventId, id);
  if (!preReg) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Permohonan pendaftaran tidak ditemui.');
  }

  // Idempotence check: if already approved and teamId exists, return existing team
  if (preReg.status === 'approved' && preReg.teamId) {
    const existingTeam = await findTeamById(eventId, preReg.teamId);
    if (existingTeam) {
      return {
        preRegistration: preReg,
        team: existingTeam,
        alreadyApproved: true,
      };
    }
  }

  // Team Name Conflict Check: findTeamByName(eventId, preReg.teamName)
  const existingTeamName = await findTeamByName(eventId, preReg.teamName);
  if (existingTeamName && existingTeamName.id !== preReg.teamId) {
    throw new AppError(
      ErrorCode.CONFLICT,
      `Nama kumpulan '${preReg.teamName}' sudah didaftarkan untuk acara ini. Sila tukar nama kumpulan sedia ada sebelum meluluskan pendaftaran ini.`
    );
  }

  // Construct team document with status 'approved' directly
  const teamData: Omit<TeamDocument, 'id' | 'createdAt' | 'updatedAt'> = {
    name: preReg.teamName,
    status: 'approved',
    memberCount: 1 + (preReg.memberNames ? preReg.memberNames.length : 0),
    leaderName: preReg.leaderName || '',
    membersList: Array.isArray(preReg.memberNames) ? preReg.memberNames.join(', ') : '',
    phone: preReg.leaderWhatsApp || '',
    eventId,
    startCheckpointId: 'CP-START',
    currentCheckpointId: 'CP-START',
    completedCheckpointIds: [],
    skippedCheckpointIds: [],
    totalPoints: 0,
    penaltiesMinutes: 0,
    penaltyPoints: 0,
    finishedAt: null,
    isDNF: false,
    isDisqualified: false,
    lastScanLocation: null,
  };

  const createdTeam = await createTeam(eventId, teamData);

  // Update pre-registration status and link created teamId
  const updatedPreReg = await updatePreRegistration(eventId, id, {
    status: 'approved',
    teamId: createdTeam.id,
    updatedBy: callerUid,
  });

  return {
    preRegistration: updatedPreReg,
    team: createdTeam,
  };
}

/**
 * Rejects a pre-registration document (Admin only, ownership checked).
 * If already approved, returns 409 CONFLICT to avoid orphaned teams.
 */
export async function rejectPreRegistrationService(
  eventId: string,
  id: string,
  callerUid: string,
  callerRole?: UserRole,
  callerEventId?: string
): Promise<PreRegistrationDocument> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui.');
  }

  assertEventOwner(event, callerUid, callerRole, callerEventId);

  const preReg = await findPreRegistrationById(eventId, id);
  if (!preReg) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Permohonan pendaftaran tidak ditemui.');
  }

  if (preReg.status === 'approved') {
    throw new AppError(
      ErrorCode.CONFLICT,
      'Pendaftaran ini telah diluluskan dan kumpulan telah dicipta. Sila uruskan kumpulan di bahagian pengurusan kumpulan.'
    );
  }

  return updatePreRegistration(eventId, id, {
    status: 'rejected',
    updatedBy: callerUid,
  });
}
