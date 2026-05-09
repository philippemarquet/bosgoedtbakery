// Email templates — inline CSS, mobile-first, Bosgoedt Bakery tone of voice
// All templates return { subject, html, text }

const BRAND = "#8B5E3C"; // warm amber/brown for header
const BG = "#FBF7F1"; // cream
const TEXT = "#2A2622";
const MUTED = "#6B645E";
const ACCENT = "#B5895E";
const SITE = "https://bakery.bosgoedt.be";

const eur = (n: number) =>
  new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(Number(n));

const escapeHtml = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const dateLong = (iso: string) => {
  // Format YYYY-MM-DD or ISO timestamp into Dutch long format
  const d = iso.length === 10 ? new Date(iso + "T00:00:00") : new Date(iso);
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
};

const time = (t: string) => (t || "").slice(0, 5);

function shell(opts: {
  preheader?: string;
  bodyHtml: string;
  unsubscribeToken?: string | null;
}): string {
  const unsub = opts.unsubscribeToken
    ? `<p style="margin:24px 0 0;font-size:12px;color:${MUTED};text-align:center;line-height:1.5;">
         Je ontvangt deze mail omdat je je hebt aangemeld voor Bosgoedt Bakery updates.<br/>
         <a href="${SITE}/unsubscribe?token=${opts.unsubscribeToken}" style="color:${MUTED};text-decoration:underline;">Uitschrijven</a>
       </p>`
    : "";

  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${BG};opacity:0;">${escapeHtml(
        opts.preheader,
      )}</div>`
    : "";

  return `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Bosgoedt Bakery</title>
  </head>
  <body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:${TEXT};">
    ${preheader}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #ECE4D7;">
            <tr>
              <td style="padding:28px 28px 4px;text-align:left;">
                <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:${BRAND};letter-spacing:-0.01em;">Bosgoedt Bakery</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 32px;font-size:15px;line-height:1.65;color:${TEXT};">
                ${opts.bodyHtml}
              </td>
            </tr>
          </table>
          ${unsub}
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// ============ WELCOME ============

export function welcomeTemplate(args: {
  fullName: string;
  unsubscribeToken: string;
}) {
  const subject = "Welkom bij Bosgoedt Bakery 🍞";
  const greeting = `Hi ${escapeHtml(args.fullName)},`;
  const body = `
    <p style="margin:0 0 14px;">${greeting}</p>
    <p style="margin:0 0 14px;">Leuk dat je je hebt aangemeld! Je staat nu op onze lijst en hoort als eerste wanneer we een nieuwe pop-up plannen — meestal twee weken van tevoren stuur ik het menu door, met een directe link om te bestellen.</p>
    <p style="margin:0 0 14px;">Wat we maken: zuurdesem brood met lange fermentatie en zoete lekkernijen die ik in onze keuken in Oud-Turnhout bak. Soms een seizoens-special, soms vaste favorieten.</p>
    <p style="margin:18px 0 4px;">Tot bij de volgende pop-up!</p>
    <p style="margin:0;color:${MUTED};">Nikki<br/>Bosgoedt Bakery</p>
  `;
  const text = `Hi ${args.fullName},

Leuk dat je je hebt aangemeld! Je staat nu op onze lijst en hoort als eerste wanneer we een nieuwe pop-up plannen — meestal twee weken van tevoren stuur ik het menu door, met een directe link om te bestellen.

Wat we maken: zuurdesem brood met lange fermentatie en zoete lekkernijen die ik in onze keuken in Oud-Turnhout bak. Soms een seizoens-special, soms vaste favorieten.

Tot bij de volgende pop-up!

Nikki
Bosgoedt Bakery

—
Uitschrijven: ${SITE}/unsubscribe?token=${args.unsubscribeToken}`;
  return {
    subject,
    html: shell({ preheader: "Welkom bij Bosgoedt Bakery", bodyHtml: body, unsubscribeToken: args.unsubscribeToken }),
    text,
  };
}

// ============ ORDER CONFIRMATION ============

export interface OrderItemLine {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export function orderConfirmationTemplate(args: {
  fullName: string;
  orderNumber: number;
  items: OrderItemLine[];
  total: number;
  eventDate: string;
  pickupStart: string;
  pickupEnd: string;
  locationName: string | null;
  locationAddress: string | null;
}) {
  const subject = `Je bestelling bij Bosgoedt Bakery — bestelnummer #${args.orderNumber}`;
  const itemRowsHtml = args.items
    .map(
      (i) => `
        <tr>
          <td style="padding:6px 0;font-size:14px;color:${TEXT};">${i.quantity} × ${escapeHtml(i.name)}</td>
          <td style="padding:6px 0;font-size:14px;color:${TEXT};text-align:right;font-variant-numeric:tabular-nums;">${eur(i.total)}</td>
        </tr>`,
    )
    .join("");

  const itemRowsText = args.items
    .map((i) => `  ${i.quantity} × ${i.name}  ${eur(i.total)}`)
    .join("\n");

  const body = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(args.fullName)},</p>
    <p style="margin:0 0 18px;">Bedankt voor je bestelling! Hieronder een overzicht zodat je het bij de hand hebt.</p>

    <p style="margin:18px 0 6px;font-weight:600;color:${TEXT};">Wat je hebt besteld</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ECE4D7;border-bottom:1px solid #ECE4D7;margin:0 0 8px;">
      ${itemRowsHtml}
    </table>
    <p style="margin:8px 0 18px;text-align:right;font-weight:600;font-variant-numeric:tabular-nums;">Totaal: ${eur(args.total)}</p>

    <p style="margin:18px 0 6px;font-weight:600;color:${TEXT};">Wanneer en waar</p>
    <p style="margin:0 0 4px;">${dateLong(args.eventDate)}</p>
    <p style="margin:0 0 4px;">Ophalen tussen ${time(args.pickupStart)} en ${time(args.pickupEnd)}</p>
    ${args.locationName ? `<p style="margin:0 0 2px;">${escapeHtml(args.locationName)}</p>` : ""}
    ${args.locationAddress ? `<p style="margin:0 0 0;color:${MUTED};">${escapeHtml(args.locationAddress)}</p>` : ""}

    <p style="margin:22px 0 14px;">Betalen kan ter plekke met overboeking of cash.</p>
    <p style="margin:0 0 18px;">Een dag van tevoren stuur ik je nog een herinnering met deze info, zodat je 'm niet hoeft op te zoeken.</p>

    <p style="margin:18px 0 4px;">Tot dan!</p>
    <p style="margin:0;color:${MUTED};">Nikki<br/>Bosgoedt Bakery</p>

    <p style="margin:24px 0 0;font-size:13px;color:${MUTED};">PS — vragen of allergische zorgen? Reply gewoon op deze mail.</p>
  `;

  const text = `Hi ${args.fullName},

Bedankt voor je bestelling! Hieronder een overzicht zodat je het bij de hand hebt.

Wat je hebt besteld:
${itemRowsText}

Totaal: ${eur(args.total)}

Wanneer en waar:
${dateLong(args.eventDate)}
Ophalen tussen ${time(args.pickupStart)} en ${time(args.pickupEnd)}
${args.locationName ?? ""}
${args.locationAddress ?? ""}

Betalen kan ter plekke met overboeking of cash.

Een dag van tevoren stuur ik je nog een herinnering met deze info.

Tot dan!

Nikki
Bosgoedt Bakery

PS — vragen of allergische zorgen? Reply gewoon op deze mail.`;

  return { subject, html: shell({ preheader: `Bestelling #${args.orderNumber} bevestigd`, bodyHtml: body }), text };
}

// ============ POPUP REMINDER ============

export function popupReminderTemplate(args: {
  fullName: string;
  items: OrderItemLine[];
  total: number;
  eventDate: string;
  pickupStart: string;
  pickupEnd: string;
  locationName: string | null;
  locationAddress: string | null;
  unsubscribeToken?: string | null;
}) {
  const subject = "Morgen is het zover — je Bosgoedt Bakery bestelling";
  const itemRowsHtml = args.items
    .map(
      (i) => `
        <tr>
          <td style="padding:5px 0;font-size:14px;color:${TEXT};">${i.quantity} × ${escapeHtml(i.name)}</td>
        </tr>`,
    )
    .join("");
  const itemRowsText = args.items.map((i) => `  ${i.quantity} × ${i.name}`).join("\n");

  const body = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(args.fullName)},</p>
    <p style="margin:0 0 18px;">Morgen mag je je bestelling komen ophalen! Hier alles op een rijtje:</p>

    <p style="margin:18px 0 6px;font-weight:600;">Wanneer</p>
    <p style="margin:0 0 4px;">${dateLong(args.eventDate)}</p>
    <p style="margin:0 0 14px;">Tussen ${time(args.pickupStart)} en ${time(args.pickupEnd)}</p>

    <p style="margin:14px 0 6px;font-weight:600;">Waar</p>
    ${args.locationName ? `<p style="margin:0 0 2px;">${escapeHtml(args.locationName)}</p>` : ""}
    ${args.locationAddress ? `<p style="margin:0 0 14px;color:${MUTED};">${escapeHtml(args.locationAddress)}</p>` : ""}

    <p style="margin:14px 0 6px;font-weight:600;">Wat je hebt besteld</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ECE4D7;border-bottom:1px solid #ECE4D7;margin:0 0 14px;">
      ${itemRowsHtml}
    </table>

    <p style="margin:14px 0 22px;">Totaal te betalen: <strong>${eur(args.total)}</strong><br/>Betalen kan met overboeking of cash.</p>

    <p style="margin:18px 0 4px;">Tot morgen!</p>
    <p style="margin:0;color:${MUTED};">Nikki<br/>Bosgoedt Bakery</p>

    <p style="margin:24px 0 0;font-size:13px;color:${MUTED};">PS — niet kunnen komen? Stuur me een berichtje, dan regel ik wat anders.</p>
  `;

  const text = `Hi ${args.fullName},

Morgen mag je je bestelling komen ophalen! Hier alles op een rijtje:

Wanneer:
${dateLong(args.eventDate)}
Tussen ${time(args.pickupStart)} en ${time(args.pickupEnd)}

Waar:
${args.locationName ?? ""}
${args.locationAddress ?? ""}

Wat je hebt besteld:
${itemRowsText}

Totaal te betalen: ${eur(args.total)}
Betalen kan met overboeking of cash.

Tot morgen!

Nikki
Bosgoedt Bakery

PS — niet kunnen komen? Stuur me een berichtje, dan regel ik wat anders.${
    args.unsubscribeToken
      ? `\n\n—\nUitschrijven: ${SITE}/unsubscribe?token=${args.unsubscribeToken}`
      : ""
  }`;

  return { subject, html: shell({ preheader: "Morgen ophalen", bodyHtml: body, unsubscribeToken: args.unsubscribeToken ?? undefined }), text };
}

// ============ MENU BROADCAST ============

export interface BroadcastProductLine {
  name: string;
  description: string | null;
  price: number;
}

export function menuBroadcastTemplate(args: {
  fullName: string;
  customIntro?: string | null;
  products: BroadcastProductLine[];
  eventDate: string;
  pickupStart: string;
  pickupEnd: string;
  locationName: string | null;
  locationAddress: string | null;
  orderingClosesAt: string;
  popupSlug: string | null;
  unsubscribeToken: string;
}) {
  const subject = `Het menu voor onze pop-up op ${dateLong(args.eventDate)}`;
  const introHtml = args.customIntro?.trim()
    ? args.customIntro
        .trim()
        .split(/\n+/)
        .map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p)}</p>`)
        .join("")
    : `<p style="margin:0 0 14px;">Het is bijna zover! Hier is het menu voor onze pop-up van ${dateLong(args.eventDate)}.</p>`;

  const productsHtml = args.products
    .map(
      (p) => `
        <div style="padding:12px 0;border-top:1px solid #ECE4D7;">
          <p style="margin:0 0 4px;font-weight:600;color:${TEXT};">${escapeHtml(p.name)} <span style="color:${ACCENT};font-weight:500;">— ${eur(p.price)}</span></p>
          ${p.description ? `<p style="margin:0;color:${MUTED};font-size:14px;line-height:1.55;">${escapeHtml(p.description)}</p>` : ""}
        </div>`,
    )
    .join("");

  const productsText = args.products
    .map(
      (p) =>
        `${p.name.toUpperCase()} — ${eur(p.price)}${p.description ? `\n${p.description}` : ""}`,
    )
    .join("\n\n");

  const orderUrl = args.popupSlug ? `${SITE}/bestellen?event=${args.popupSlug}` : `${SITE}/bestellen`;
  const closesText = new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(args.orderingClosesAt));

  const body = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(args.fullName)},</p>
    ${introHtml}

    <p style="margin:18px 0 6px;font-weight:600;">Wat staat er op het menu</p>
    <div style="border-bottom:1px solid #ECE4D7;margin:0 0 18px;">${productsHtml}</div>

    <p style="margin:14px 0 6px;font-weight:600;">Wanneer</p>
    <p style="margin:0 0 4px;">${dateLong(args.eventDate)}</p>
    <p style="margin:0 0 14px;">Ophalen tussen ${time(args.pickupStart)} en ${time(args.pickupEnd)}</p>

    <p style="margin:14px 0 6px;font-weight:600;">Waar</p>
    ${args.locationName ? `<p style="margin:0 0 2px;">${escapeHtml(args.locationName)}</p>` : ""}
    ${args.locationAddress ? `<p style="margin:0 0 18px;color:${MUTED};">${escapeHtml(args.locationAddress)}</p>` : ""}

    <p style="margin:14px 0 18px;">Bestellen kan tot ${escapeHtml(closesText)}.</p>

    <p style="margin:0 0 24px;">
      <a href="${orderUrl}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;">Bestel hier</a>
    </p>

    <p style="margin:18px 0 4px;">Tot dan!</p>
    <p style="margin:0;color:${MUTED};">Nikki<br/>Bosgoedt Bakery</p>
  `;

  const text = `Hi ${args.fullName},

${args.customIntro?.trim() ?? `Het is bijna zover! Hier is het menu voor onze pop-up van ${dateLong(args.eventDate)}.`}

Wat staat er op het menu:

${productsText}

Wanneer:
${dateLong(args.eventDate)}
Ophalen tussen ${time(args.pickupStart)} en ${time(args.pickupEnd)}

Waar:
${args.locationName ?? ""}
${args.locationAddress ?? ""}

Bestellen kan tot ${closesText}.
Bestel hier: ${orderUrl}

Tot dan!

Nikki
Bosgoedt Bakery

—
Uitschrijven: ${SITE}/unsubscribe?token=${args.unsubscribeToken}`;

  return { subject, html: shell({ preheader: `Menu pop-up ${dateLong(args.eventDate)}`, bodyHtml: body, unsubscribeToken: args.unsubscribeToken }), text };
}
