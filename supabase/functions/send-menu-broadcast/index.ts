import { corsHeaders, getServiceClient, sendEmail } from "../_shared/email-client.ts";
import { menuBroadcastTemplate, type BroadcastProductLine } from "../_shared/email-templates.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const summary = { recipients_count: 0, emails_sent: 0, emails_failed: 0 };

  try {
    const { popup_event_id, custom_intro } = await req.json().catch(() => ({}));
    if (!popup_event_id || typeof popup_event_id !== "string") {
      return new Response(JSON.stringify({ error: "popup_event_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: epRows } = await supabase
      .from("popup_event_products")
      .select("price_override, display_order, product:products(name, description, selling_price)")
      .eq("popup_event_id", popup_event_id)
      .order("display_order", { ascending: true });

    const products: BroadcastProductLine[] = (epRows ?? [])
      .filter((r: any) => r.product)
      .map((r: any) => ({
        name: r.product.name,
        description: r.product.description,
        price: Number(r.price_override ?? r.product.selling_price),
      }));

    const { data: subs } = await supabase
      .from("subscribers")
      .select("id, full_name, email, unsubscribe_token")
      .eq("is_active", true);

    summary.recipients_count = subs?.length ?? 0;

    const batchSize = 10;
    for (let i = 0; i < (subs?.length ?? 0); i += batchSize) {
      const batch = (subs ?? []).slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (s) => {
          const tpl = menuBroadcastTemplate({
            fullName: s.full_name,
            customIntro: custom_intro ?? null,
            products,
            eventDate: ev.event_date,
            pickupStart: ev.pickup_start_time,
            pickupEnd: ev.pickup_end_time,
            locationName: ev.location_name,
            locationAddress: ev.location_address,
            orderingClosesAt: ev.ordering_closes_at,
            popupSlug: ev.slug,
            unsubscribeToken: s.unsubscribe_token,
          });
          const result = await sendEmail({
            to: s.email,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
            emailType: "menu_broadcast",
            recipientName: s.full_name,
            relatedSubscriberId: s.id,
            relatedPopupEventId: ev.id,
          });
          if (result.success) summary.emails_sent += 1;
          else summary.emails_failed += 1;
        }),
      );
      // small delay between batches to respect Resend ~10/s
      await new Promise((r) => setTimeout(r, 1100));
    }

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("send-menu-broadcast error", msg);
    return new Response(JSON.stringify({ error: msg, ...summary }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
