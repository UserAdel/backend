/**
 * Generic WhatsApp messaging service
 */

import { SystemSetting } from '../models/systemSetting.model.js';

export interface BookingConfirmationPayload {
  fullName: string;
  whatsapp: string;
  activityName: string;
  arrivalDate: string;
  preferredDate: string;
  adults: number;
  children: number;
  language: string;
  nationality: string;
  specialRequests?: string;
}

export async function getWhatsappConfig() {
  let dbSetting = null;
  try {
    dbSetting = await SystemSetting.findOne({ key: 'default' }).lean();
  } catch {
    // Fall back to environment variables
  }

  const apiUrl = (dbSetting?.whatsappApiUrl || process.env.WHATSAPP_API_URL || '').trim();
  const apiKey = (dbSetting?.whatsappApiKey || process.env.WHATSAPP_API_KEY || '').trim();
  const sessionId = (dbSetting?.whatsappSessionId || process.env.WHATSAPP_SESSION_ID || 'main').trim();
  const adminPhone = (dbSetting?.adminPhone || process.env.ADMIN_PHONE || '').trim();

  return { apiUrl, apiKey, sessionId, adminPhone };
}

function buildCustomerMessage(payload: BookingConfirmationPayload): string {
  const isFr = payload.language === 'fr';

  if (isFr) {
    return (
      `✅ *Demande de réservation reçue !*\n\n` +
      `Bonjour *${payload.fullName}*,\n\n` +
      `Merci pour votre réservation. Voici le résumé :\n\n` +
      `🏄 *Activité :* ${payload.activityName}\n` +
      `✈️ *Date d'arrivée :* ${payload.arrivalDate}\n` +
      `📅 *Date souhaitée :* ${payload.preferredDate}\n` +
      `👤 *Adultes :* ${payload.adults}\n` +
      `👶 *Enfants :* ${payload.children}\n` +
      `🌍 *Nationalité :* ${payload.nationality}\n` +
      (payload.specialRequests ? `📝 *Demandes spéciales :* ${payload.specialRequests}\n` : '') +
      `\nNous vous contacterons très bientôt pour confirmer les détails. À bientôt ! 🌊`
    );
  }

  return (
    `✅ *Booking Request Received!*\n\n` +
    `Hello *${payload.fullName}*,\n\n` +
    `Thank you for your booking request. Here's your summary:\n\n` +
    `🏄 *Activity:* ${payload.activityName}\n` +
    `✈️ *Arrival Date:* ${payload.arrivalDate}\n` +
    `📅 *Preferred Date:* ${payload.preferredDate}\n` +
    `👤 *Adults:* ${payload.adults}\n` +
    `👶 *Children:* ${payload.children}\n` +
    `🌍 *Nationality:* ${payload.nationality}\n` +
    (payload.specialRequests ? `📝 *Special Requests:* ${payload.specialRequests}\n` : '') +
    `\nWe will contact you shortly to confirm the details. See you soon! 🌊`
  );
}

// ─── Shared low-level sender ───────────────────────────────────────────────

interface OpenWaSession {
  id: string | undefined;
  name: string | undefined;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function normaliseApiKey(apiKey: string): string {
  return apiKey.replace(/^Bearer\s+/i, '').trim();
}

function buildWhatsappHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const normalisedApiKey = normaliseApiKey(apiKey);
  if (normalisedApiKey) {
    headers.Authorization = `Bearer ${normalisedApiKey}`;
    headers['x-api-key'] = normalisedApiKey;
    headers.token = normalisedApiKey;
  }

  return headers;
}

async function readResponseText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

async function readResponseJson(res: Response): Promise<unknown> {
  const text = await readResponseText(res);
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function extractSessionArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (Array.isArray(payload.sessions)) {
    return payload.sessions;
  }

  if (isRecord(payload.data)) {
    if (Array.isArray(payload.data.sessions)) {
      return payload.data.sessions;
    }

    if (Array.isArray(payload.data.data)) {
      return payload.data.data;
    }
  }

  return [];
}

function parseOpenWaSessions(payload: unknown): OpenWaSession[] {
  return extractSessionArray(payload)
    .filter(isRecord)
    .map((session) => ({
      id: getString(session.id),
      name: getString(session.name),
    }));
}

async function resolveOpenWaSessionId(
  baseUrl: string,
  headers: Record<string, string>,
  configuredSessionId: string,
): Promise<string> {
  const fallbackSessionId = configuredSessionId || 'main';

  try {
    const res = await fetch(`${baseUrl}/sessions`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      return fallbackSessionId;
    }

    const sessions = parseOpenWaSessions(await readResponseJson(res));
    const matchedSession = sessions.find(
      (session) => session.id === fallbackSessionId || session.name === fallbackSessionId,
    );

    return matchedSession?.id || fallbackSessionId;
  } catch {
    return fallbackSessionId;
  }
}

function normalisePhoneForWhatsapp(phone: string): string {
  let normalised = phone.trim().replace(/[^\d+]/g, '');

  if (normalised.startsWith('+')) {
    normalised = normalised.substring(1);
  }

  if (normalised.startsWith('00')) {
    normalised = normalised.substring(2);
  }

  normalised = normalised.replace(/\D/g, '');

  // If it's an Egyptian local number (starts with 01), add 20.
  if (normalised.startsWith('01') && normalised.length === 11) {
    normalised = `20${normalised.substring(1)}`;
  }

  return normalised;
}

function normaliseChatIdForOpenWa(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.includes('@')) {
    return trimmed;
  }

  return `${normalisePhoneForWhatsapp(trimmed)}@c.us`;
}

async function sendOpenWaTextMessage(
  baseUrl: string,
  headers: Record<string, string>,
  sessionId: string,
  phone: string,
  message: string,
): Promise<{ sent: boolean; status?: number; error?: string }> {
  const resolvedSessionId = await resolveOpenWaSessionId(baseUrl, headers, sessionId);
  const chatId = normaliseChatIdForOpenWa(phone);
  const res = await fetch(`${baseUrl}/sessions/${encodeURIComponent(resolvedSessionId)}/messages/send-text`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ chatId, text: message }),
  });

  if (res.ok) {
    console.log(`[WhatsApp] Message sent to ${normalisePhoneForWhatsapp(phone)}`);
    return { sent: true };
  }

  return {
    sent: false,
    status: res.status,
    error: await readResponseText(res),
  };
}

async function sendLegacyWhatsappMessage(
  baseUrl: string,
  headers: Record<string, string>,
  sessionId: string,
  normalisedPhone: string,
  message: string,
): Promise<{ sent: boolean; status?: number; error?: string }> {
  const res = await fetch(`${baseUrl}/send-message`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      phone: normalisedPhone,
      chat_id: normalisedPhone,
      chatId: normalisedPhone,
      text: message,
      message,
      sessionId,
      session: sessionId,
    }),
  });

  if (res.ok) {
    console.log(`[WhatsApp] Message sent to ${normalisedPhone}`);
    return { sent: true };
  }

  return {
    sent: false,
    status: res.status,
    error: await readResponseText(res),
  };
}

export async function sendWhatsappMessage(phone: string, message: string): Promise<void> {
  const { apiUrl, apiKey, sessionId } = await getWhatsappConfig();

  if (!apiUrl) {
    console.warn('[WhatsApp] WHATSAPP_API_URL not set — skipping message sending.');
    return;
  }

  const normalised = normalisePhoneForWhatsapp(phone);

  try {
    const baseUrl = trimTrailingSlash(apiUrl);
    const headers = buildWhatsappHeaders(apiKey);
    const openWaResult = await sendOpenWaTextMessage(baseUrl, headers, sessionId, normalised, message);

    if (openWaResult.sent) {
      return;
    }

    if (openWaResult.status === 404) {
      const legacyResult = await sendLegacyWhatsappMessage(baseUrl, headers, sessionId, normalised, message);
      if (legacyResult.sent) {
        return;
      }

      console.error(`[WhatsApp] HTTP ${legacyResult.status} -> ${normalised}: ${legacyResult.error || ''}`);
      return;
    }

    console.error(`[WhatsApp] HTTP ${openWaResult.status} -> ${normalised}: ${openWaResult.error || ''}`);
  } catch (err) {
    console.error('[WhatsApp] Failed to send message:', err);
  }
}

// ─── Customer: booking confirmation ───────────────────────────────────────

/**
 * Sends a WhatsApp confirmation to the customer.
 * Non-blocking — failures are logged, booking is never affected.
 */
export async function sendBookingConfirmation(payload: BookingConfirmationPayload): Promise<void> {
  await sendWhatsappMessage(payload.whatsapp, buildCustomerMessage(payload));
}

// ─── Admin: instant new-booking alert ─────────────────────────────────────

/**
 * Notifies the admin immediately when a new booking arrives.
 */
export async function sendAdminNewBookingAlert(payload: BookingConfirmationPayload): Promise<void> {
  const { adminPhone } = await getWhatsappConfig();
  if (!adminPhone) {
    console.warn('[WhatsApp] ADMIN_PHONE not set — skipping admin alert.');
    return;
  }

  const msg =
    `🔔 *حجز جديد!*\n\n` +
    `👤 *الاسم:* ${payload.fullName}\n` +
    `📲 *واتساب:* ${payload.whatsapp}\n` +
    `🌍 *الجنسية:* ${payload.nationality}\n` +
    `🏄 *النشاط:* ${payload.activityName}\n` +
    `✈️ *تاريخ الوصول:* ${payload.arrivalDate}\n` +
    `📅 *تاريخ النشاط:* ${payload.preferredDate}\n` +
    `👤 *البالغين:* ${payload.adults}   👶 *الأطفال:* ${payload.children}\n` +
    (payload.specialRequests ? `📝 *طلبات خاصة:* ${payload.specialRequests}\n` : '');

  await sendWhatsappMessage(adminPhone, msg);
}
