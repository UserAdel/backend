/**
 * Wapilot WhatsApp messaging service
 * Docs: https://wapilot.io
 */

const WAPILOT_API = 'https://app.wapilot.io/api/send-message';

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

export async function sendWapilotMessage(phone: string, message: string): Promise<void> {
  const instance = process.env.WAPILOT_INSTANCE;
  const token = process.env.WAPILOT_TOKEN;

  if (!instance || !token) {
    console.warn('[Wapilot] WAPILOT_INSTANCE or WAPILOT_TOKEN not set — skipping.');
    return;
  }

  // Normalise: strip spaces/dashes, ensure leading +
  let normalised = phone.replace(/[\s\-().]/g, '');
  if (!normalised.startsWith('+')) normalised = `+${normalised}`;

  try {
    const res = await fetch(WAPILOT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance, token, phone: normalised, message }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Wapilot] HTTP ${res.status} → ${normalised}: ${text}`);
    } else {
      console.log(`[Wapilot] Message sent to ${normalised}`);
    }
  } catch (err) {
    console.error('[Wapilot] Failed to send message:', err);
  }
}

// ─── Customer: booking confirmation ───────────────────────────────────────

/**
 * Sends a WhatsApp confirmation to the customer.
 * Non-blocking — failures are logged, booking is never affected.
 */
export async function sendBookingConfirmation(payload: BookingConfirmationPayload): Promise<void> {
  await sendWapilotMessage(payload.whatsapp, buildCustomerMessage(payload));
}

// ─── Admin: instant new-booking alert ─────────────────────────────────────

/**
 * Notifies the admin immediately when a new booking arrives.
 */
export async function sendAdminNewBookingAlert(payload: BookingConfirmationPayload): Promise<void> {
  const adminPhone = process.env.ADMIN_PHONE;
  if (!adminPhone) {
    console.warn('[Wapilot] ADMIN_PHONE not set — skipping admin alert.');
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

  await sendWapilotMessage(adminPhone, msg);
}
