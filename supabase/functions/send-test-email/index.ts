// Verzend een test-mail naar de ingelogde baker met dummy data uit example-velden van het template.
import { corsHeaders, getServiceClient, sendEmail } from "../_shared/email-client.ts";
import { loadTemplate, renderItems, renderString } from "../_shared/email-templates.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.email) {
      return new Response(JSON.stringify({ error: "Niet ingelogd" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify baker role
    const supabase = getServiceClient();
    const { data: roleRow } = await supabase
      .from("user_roles").select("id").eq("user_id", userData.user.id).eq("role", "baker").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Alleen bakers kunnen test-mails versturen" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { template_key, override } = await req.json().catch(() => ({}));
    if (!template_key) {
      return new Response(JSON.stringify({ error: "template_key is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load template, optionally with overrides (for "preview unsaved changes" test)
    const tpl = await loadTemplate(template_key);
    const subjectTpl = override?.subject ?? tpl.subject;
    const htmlTpl = override?.html_body ?? tpl.html_body;
    const textTpl = override?.text_body ?? tpl.text_body;
    const itemHtmlTpl = override?.item_html_template ?? tpl.item_html_template;
    const itemTextTpl = override?.item_text_template ?? tpl.item_text_template;

    // Build vars from example-fields
    const vars: Record<string, string | number> = {};
    (tpl.available_variables ?? []).forEach((v) => {
      vars[v.key] = v.example ?? `{{${v.key}}}`;
    });

    // Build 2-3 fictieve items
    const sampleItems: Array<Record<string, string | number>> = [];
    if (itemHtmlTpl || itemTextTpl) {
      const ivars = tpl.item_variables ?? [];
      for (let i = 0; i < 3; i++) {
        const it: Record<string, string | number> = {};
        ivars.forEach((v) => {
          it[v.key] = v.example ? `${v.example}${i > 0 ? ` (${i + 1})` : ""}` : `{{${v.key}}}`;
        });
        sampleItems.push(it);
      }
    }
    const { items_html, items_text } = renderItems(itemHtmlTpl, itemTextTpl, sampleItems);
    const allVars = { ...vars, items_html, items_text };

    const result = await sendEmail({
      to: userData.user.email,
      subject: `[TEST] ${renderString(subjectTpl, allVars)}`,
      html: renderString(htmlTpl, allVars),
      text: renderString(textTpl, allVars),
      emailType: template_key as any,
      recipientName: "Test",
      metadata: { test: true, template_key },
    });

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("send-test-email error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
