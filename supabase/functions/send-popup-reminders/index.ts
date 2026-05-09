import { corsHeaders, getServiceClient, sendEmail } from "../_shared/email-client.ts";
import { popupReminderTemplate, type OrderItemLine } from "../_shared/email-templates.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = getServiceClient();
  const summary = { events_processed: 0, emails_sent: 0, emails_failed: 0, skipped_duplicates: 0 };

  try {
    // Find events for tomorrow (server date)
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const { data: events, error: evErr } = await supabase
      .from("popup_events")
      .select("id, event_date, pickup_start_time, pickup_end_time, location_name, location_address, is_published")
      .eq("event_date", tomorrowStr)
      .eq("is_published", true);

    if (evErr) throw evErr;
    summary.events_processed = events?.length ?? 0;

    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ ...summary, message: "No events tomorrow" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    for (const ev of events) {
      const { data: orders } = await supabase
        .from("orders")
        .select(
          `id, total, customer_name_snapshot, customer_email_snapshot, status,
           order_items(quantity, unit_price, total, product:products(name))`,
        )
        .eq("popup_event_id", ev.id)
        .neq("status", "cancelled");

      for (const o of orders ?? []) {
        if (!o.customer_email_snapshot) continue;

        // Idempotency: skip if a 'sent' popup_reminder exists for this order today
        const { data: existing } = await supabase
          .from("email_logs")
          .select("id")
          .eq("related_order_id", o.id)
          .eq("email_type", "popup_reminder")
          .eq("status", "sent")
          .gte("sent_at", todayStart.toISOString())
          .limit(1);

        if (existing && existing.length > 0) {
          summary.skipped_duplicates += 1;
          continue;
        }

        // Try to fetch matching active subscriber for unsubscribe token
        const { data: sub } = await supabase
          .from("subscribers")
          .select("unsubscribe_token")
          .ilike("email", o.customer_email_snapshot)
          .eq("is_active", true)
          .maybeSingle();

        const items: OrderItemLine[] = ((o.order_items as any[]) ?? []).map((it) => ({
          name: it.product?.name ?? "Product",
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          total: Number(it.total),
        }));

        const tpl = popupReminderTemplate({
          fullName: o.customer_name_snapshot ?? "klant",
          items,
          total: Number(o.total),
          eventDate: ev.event_date,
          pickupStart: ev.pickup_start_time,
          pickupEnd: ev.pickup_end_time,
          locationName: ev.location_name,
          locationAddress: ev.location_address,
          unsubscribeToken: sub?.unsubscribe_token ?? null,
        });

        const result = await sendEmail({
          to: o.customer_email_snapshot,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
          emailType: "popup_reminder",
          recipientName: o.customer_name_snapshot,
          relatedOrderId: o.id,
          relatedPopupEventId: ev.id,
        });

        if (result.success) summary.emails_sent += 1;
        else summary.emails_failed += 1;

        await new Promise((r) => setTimeout(r, 120));
      }
    }

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("send-popup-reminders error", msg);
    return new Response(JSON.stringify({ error: msg, ...summary }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
