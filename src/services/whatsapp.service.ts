/**
 * Generic WhatsApp messaging service
 */

import { SystemSetting } from '../models/systemSetting.model.js';

export interface BookingConfirmationPayload {
  fullName: string;
  phone: string;
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

export async function sendWhatsappMessage(phone: string, message: string): Promise<void> {
  const { apiUrl, apiKey, sessionId } = await getWhatsappConfig();

  if (!apiUrl) {
    console.warn('[WhatsApp] WHATSAPP_API_URL not set — skipping message sending.');
    return;
  }

  const normalised = normalisePhoneForWhatsapp(phone);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['x-api-key'] = apiKey;
      headers['token'] = apiKey;
    }

    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/send-message`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        phone: normalised, 
        chat_id: normalised, 
        chatId: normalised, 
        text: message, 
        message,
        sessionId,
        session: sessionId
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[WhatsApp] HTTP ${res.status} → ${normalised}: ${text}`);
    } else {
      console.log(`[WhatsApp] Message sent to ${normalised}`);
    }
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
    `📞 *الهاتف:* ${payload.phone}\n` +
    `📲 *واتساب:* ${payload.whatsapp}\n` +
    `🌍 *الجنسية:* ${payload.nationality}\n` +
    `🏄 *النشاط:* ${payload.activityName}\n` +
    `✈️ *تاريخ الوصول:* ${payload.arrivalDate}\n` +
    `📅 *تاريخ النشاط:* ${payload.preferredDate}\n` +
    `👤 *البالغين:* ${payload.adults}   👶 *الأطفال:* ${payload.children}\n` +
    (payload.specialRequests ? `📝 *طلبات خاصة:* ${payload.specialRequests}\n` : '');

  await sendWhatsappMessage(adminPhone, msg);
}
