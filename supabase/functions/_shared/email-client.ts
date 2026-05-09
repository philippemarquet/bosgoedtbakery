// Shared Resend email client + email_logs persistence
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM = 'Bosgoedt Bakery <bakery@bosgoedt.be>';
const REPLY_TO = 'bakery@bosgoedt.be';

export type EmailType =
  | "welcome"
  | "order_confirmation"
  | "popup_reminder"
  | "menu_broadcast";

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

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const supabase = getServiceClient();
  const apiKey = Deno.env.get("RESEND_API_KEY");

  // Pre-create log row (status: pending)
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

  if (!apiKey) {
    const errorMsg = "RESEND_API_KEY ontbreekt";
    if (logId) {
      await supabase
        .from("email_logs")
        .update({ status: "failed", error_message: errorMsg })
        .eq("id", logId);
    }
    return { success: false, error: errorMsg, log_id: logId };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [params.to],
        reply_to: REPLY_TO,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = body?.message || body?.error || `HTTP ${res.status}`;
      console.error("Resend error", res.status, errorMsg, body);
      if (logId) {
        await supabase
          .from("email_logs")
          .update({ status: "failed", error_message: String(errorMsg) })
          .eq("id", logId);
      }
      return { success: false, error: String(errorMsg), log_id: logId };
    }

    const resendId = body?.id as string | undefined;
    if (logId) {
      await supabase
        .from("email_logs")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          resend_id: resendId ?? null,
        })
        .eq("id", logId);
    }
    return { success: true, resend_id: resendId, log_id: logId };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Onbekende fout";
    console.error("sendEmail exception", errorMsg);
    if (logId) {
      await supabase
        .from("email_logs")
        .update({ status: "failed", error_message: errorMsg })
        .eq("id", logId);
    }
    return { success: false, error: errorMsg, log_id: logId };
  }
}
