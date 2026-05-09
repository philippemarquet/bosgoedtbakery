// Shared Resend email client + email_logs persistence + baker failure alerts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM = 'Bosgoedt Bakery <bakery@bosgoedt.be>';
const REPLY_TO = 'bakery@bosgoedt.be';
const SITE = "https://bakery.bosgoedt.be";

export type EmailType =
  | "welcome"
  | "order_confirmation"
  | "popup_reminder"
  | "menu_broadcast"
  | "baker_alert";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  emailType: EmailType;
  recipientName?: string | null;
  relatedOrderId?: string | null;
  relatedSubscriberId?: string | null;
  relatedPopupEventId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SendEmailResult {
  success: boolean;
  resend_id?: string;
  log_id?: string;
  error?: string;
}

export function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

async function rawSendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY ontbreekt" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [opts.to],
        reply_to: REPLY_TO,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.message || body?.error || `HTTP ${res.status}`;
      return { ok: false, error: String(msg) };
    }
    return { ok: true, id: body?.id as string | undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout" };
  }
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const supabase = getServiceClient();

  const { data: logRow } = await supabase
    .from("email_logs")
    .insert({
      email_type: params.emailType,
      recipient_email: params.to,
      recipient_name: params.recipientName ?? null,
      subject: params.subject,
      status: "pending",
      related_order_id: params.relatedOrderId ?? null,
      related_subscriber_id: params.relatedSubscriberId ?? null,
      related_popup_event_id: params.relatedPopupEventId ?? null,
      metadata: params.metadata ?? null,
    })
    .select("id")
    .single();

  const logId = logRow?.id as string | undefined;

  const result = await rawSendViaResend({
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  if (!result.ok) {
    if (logId) {
      await supabase
        .from("email_logs")
        .update({ status: "failed", error_message: result.error })
        .eq("id", logId);
    }
    // Don't loop: if this IS a baker_alert that failed, just console.error.
    if (params.emailType !== "baker_alert") {
      // Fire-and-forget; don't await failures of the alert itself
      try {
        await notifyBakersOfFailure({
          aboutEmailType: params.emailType,
          recipientEmail: params.to,
          errorMessage: result.error,
        });
      } catch (e) {
        console.error("notifyBakersOfFailure threw", e);
      }
    } else {
      console.error("baker_alert send failed", result.error);
    }
    return { success: false, error: result.error, log_id: logId };
  }

  if (logId) {
    await supabase
      .from("email_logs")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        resend_id: result.id ?? null,
      })
      .eq("id", logId);
  }
  return { success: true, resend_id: result.id, log_id: logId };
}

// ---------- Baker failure alerts ----------

export interface BakerAlertInput {
  aboutEmailType: EmailType;
  recipientEmail: string;
  errorMessage: string;
  // For batch broadcasts: aggregated info instead of per-failure
  aggregated?: { failed_count: number; total: number };
}

function startOfTodayIso() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function notifyBakersOfFailure(input: BakerAlertInput): Promise<void> {
  const supabase = getServiceClient();

  // Idempotency: skip if a baker_alert was already sent today for this email_type
  const { data: existing } = await supabase
    .from("email_logs")
    .select("id")
    .eq("email_type", "baker_alert")
    .eq("status", "sent")
    .filter("metadata->>about_email_type", "eq", input.aboutEmailType)
    .gte("created_at", startOfTodayIso())
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`baker_alert already sent today for ${input.aboutEmailType} — skip`);
    return;
  }

  // Count today's failures for this email_type
  const { count: failuresToday } = await supabase
    .from("email_logs")
    .select("id", { count: "exact", head: true })
    .eq("email_type", input.aboutEmailType)
    .eq("status", "failed")
    .gte("created_at", startOfTodayIso());

  // Lookup baker emails — combine auth.users + user_roles
  const bakerEmails = await fetchBakerEmails(supabase);
  if (bakerEmails.length === 0) {
    console.warn("No bakers found to alert");
    return;
  }

  // Lazy import to avoid circular dependency
  const { renderEmail } = await import("./email-templates.ts");
  const failedAt = new Intl.DateTimeFormat("nl-NL", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  }).format(new Date());

  const logsUrl = `${SITE}/dashboard?tab=emails&logtype=${input.aboutEmailType}&logstatus=failed`;

  let rendered;
  try {
    rendered = await renderEmail("baker_alert", {
      email_type: input.aboutEmailType,
      failed_at: failedAt,
      recipient_email: input.aggregated
        ? `(batch) ${input.aggregated.failed_count}/${input.aggregated.total} gefaald`
        : input.recipientEmail,
      failures_today: failuresToday ?? 1,
      error_message: input.errorMessage,
      logs_url: logsUrl,
    });
  } catch (e) {
    console.error("Failed to render baker_alert template", e);
    // Hard fallback (template missing): plain text alert
    rendered = {
      subject: `⚠️ Mail-flow gefaald: ${input.aboutEmailType}`,
      html: `<p>Type: ${input.aboutEmailType}</p><p>Naar: ${input.recipientEmail}</p><p>Error: ${input.errorMessage}</p><p>Logs: ${logsUrl}</p>`,
      text: `Type: ${input.aboutEmailType}\nNaar: ${input.recipientEmail}\nError: ${input.errorMessage}\nLogs: ${logsUrl}`,
    };
  }

  for (const to of bakerEmails) {
    await sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      emailType: "baker_alert",
      metadata: {
        about_email_type: input.aboutEmailType,
        original_recipient: input.recipientEmail,
        original_error: input.errorMessage,
        ...(input.aggregated ? { aggregated: input.aggregated } : {}),
      },
    });
  }
}

async function fetchBakerEmails(supabase: ReturnType<typeof getServiceClient>): Promise<string[]> {
  // Get baker user_ids
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "baker");
  const ids = (roleRows ?? []).map((r) => r.user_id as string).filter(Boolean);
  if (ids.length === 0) return [];

  // Use auth admin to get emails
  const emails: string[] = [];
  for (const id of ids) {
    try {
      const { data, error } = await (supabase as any).auth.admin.getUserById(id);
      if (!error && data?.user?.email) emails.push(data.user.email);
    } catch (e) {
      console.error("getUserById failed", id, e);
    }
  }
  return Array.from(new Set(emails));
}
