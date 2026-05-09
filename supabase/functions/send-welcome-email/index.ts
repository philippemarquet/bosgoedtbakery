import { corsHeaders, getServiceClient, sendEmail } from "../_shared/email-client.ts";
import { renderEmail, unsubscribeUrl } from "../_shared/email-templates.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { subscriber_id } = await req.json().catch(() => ({}));
    if (!subscriber_id || typeof subscriber_id !== "string") {
      return new Response(JSON.stringify({ error: "subscriber_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getServiceClient();
    const { data: sub, error } = await supabase
      .from("subscribers")
      .select("id, full_name, email, unsubscribe_token, is_active")
      .eq("id", subscriber_id)
      .maybeSingle();

    if (error || !sub) {
      return new Response(JSON.stringify({ error: "subscriber not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!sub.is_active) {
      return new Response(JSON.stringify({ skipped: "subscriber inactive" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tpl = await renderEmail("welcome", {
      full_name: sub.full_name,
      unsubscribe_url: unsubscribeUrl(sub.unsubscribe_token),
    });

    const result = await sendEmail({
      to: sub.email,
      subject: tpl.subject, html: tpl.html, text: tpl.text,
      emailType: "welcome",
      recipientName: sub.full_name,
      relatedSubscriberId: sub.id,
    });

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("send-welcome-email error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
