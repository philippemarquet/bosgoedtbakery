import { corsHeaders, getServiceClient, notifyBakersOfFailure, sendEmail } from "../_shared/email-client.ts";
import { renderEmail, eur, dateLong, dateTimeLong, time, unsubscribeUrl, orderUrlForEvent } from "../_shared/email-templates.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const summary = { recipients_count: 0, emails_sent: 0, emails_failed: 0 };

  try {
    const { popup_event_id, custom_intro } = await req.json().catch(() => ({}));
    if (!popup_event_id || typeof popup_event_id !== "string") {
      return new Response(JSON.stringify({ error: "popup_event_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getServiceClient();

    const { data: ev, error: evErr } = await supabase
      .from("popup_events")
      .select("id, slug, event_date, pickup_start_time, pickup_end_time, location_name, location_address, ordering_closes_at")
      .eq("id", popup_event_id)
      .maybeSingle();
    if (evErr || !ev) {
      return new Response(JSON.stringify({ error: "popup event not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: epRows } = await supabase
      .from("popup_event_products")
      .select("price_override, display_order, product:products(name, description, selling_price)")
      .eq("popup_event_id", popup_event_id)
      .order("display_order", { ascending: true });

    const items = (epRows ?? [])
      .filter((r: any) => r.product)
      .map((r: any) => ({
        product_name: r.product.name,
        description: r.product.description ?? "",
        price: eur(Number(r.price_override ?? r.product.selling_price)),
      }));

    const { data: subs } = await supabase
      .from("subscribers")
      .select("id, full_name, email, unsubscribe_token")
      .eq("is_active", true);

    summary.recipients_count = subs?.length ?? 0;

    const intro = custom_intro?.trim()
      ? custom_intro.trim()
      : `Het is bijna zover! Hier is het menu voor onze pop-up van ${dateLong(ev.event_date)}.`;

    const baseVars = {
      intro,
      event_date_long: dateLong(ev.event_date),
      pickup_start: time(ev.pickup_start_time),
      pickup_end: time(ev.pickup_end_time),
      location_name: ev.location_name ?? "",
      location_address: ev.location_address ?? "",
      ordering_closes_long: dateTimeLong(ev.ordering_closes_at),
      order_url: orderUrlForEvent(ev.slug),
    };

    const batchSize = 10;
    for (let i = 0; i < (subs?.length ?? 0); i += batchSize) {
      const batch = (subs ?? []).slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (s) => {
          const tpl = await renderEmail("menu_broadcast", {
            ...baseVars,
            full_name: s.full_name,
            unsubscribe_url: unsubscribeUrl(s.unsubscribe_token),
          }, items);
          const result = await sendEmail({
            to: s.email,
            subject: tpl.subject, html: tpl.html, text: tpl.text,
            emailType: "menu_broadcast",
            recipientName: s.full_name,
            relatedSubscriberId: s.id,
            relatedPopupEventId: ev.id,
          });
          if (result.success) summary.emails_sent += 1;
          else summary.emails_failed += 1;
        }),
      );
      await new Promise((r) => setTimeout(r, 1100));
    }

    // Aggregated alert for batch failures
    if (summary.emails_failed > 0) {
      try {
        await notifyBakersOfFailure({
          aboutEmailType: "menu_broadcast",
          recipientEmail: `${summary.emails_failed} ontvangers`,
          errorMessage: `${summary.emails_failed} van ${summary.recipients_count} broadcast-mails gefaald (zie logs voor details)`,
          aggregated: { failed_count: summary.emails_failed, total: summary.recipients_count },
        });
      } catch (e) {
        console.error("aggregated baker alert failed", e);
      }
    }

    return new Response(JSON.stringify(summary), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("send-menu-broadcast error", msg);
    return new Response(JSON.stringify({ error: msg, ...summary }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
