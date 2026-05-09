import { corsHeaders, getServiceClient, sendEmail } from "../_shared/email-client.ts";
import { orderConfirmationTemplate, type OrderItemLine } from "../_shared/email-templates.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { order_id } = await req.json().catch(() => ({}));
    if (!order_id || typeof order_id !== "string") {
      return new Response(JSON.stringify({ error: "order_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getServiceClient();
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        `id, order_number, total, customer_name_snapshot, customer_email_snapshot, popup_event_id,
         popup_event:popup_events(event_date, pickup_start_time, pickup_end_time, location_name, location_address),
         order_items(quantity, unit_price, total, product:products(name))`,
      )
      .eq("id", order_id)
      .maybeSingle();

    if (error || !order) {
      return new Response(JSON.stringify({ error: "order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!order.customer_email_snapshot) {
      return new Response(JSON.stringify({ error: "no email on order" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ev = order.popup_event as any;
    if (!ev) {
      return new Response(JSON.stringify({ error: "order has no popup event" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const items: OrderItemLine[] = (order.order_items ?? []).map((it: any) => ({
      name: it.product?.name ?? "Product",
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      total: Number(it.total),
    }));

    const tpl = orderConfirmationTemplate({
      fullName: order.customer_name_snapshot ?? "klant",
      orderNumber: order.order_number,
      items,
      total: Number(order.total),
      eventDate: ev.event_date,
      pickupStart: ev.pickup_start_time,
      pickupEnd: ev.pickup_end_time,
      locationName: ev.location_name,
      locationAddress: ev.location_address,
    });

    const result = await sendEmail({
      to: order.customer_email_snapshot,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      emailType: "order_confirmation",
      recipientName: order.customer_name_snapshot,
      relatedOrderId: order.id,
      relatedPopupEventId: order.popup_event_id,
      metadata: { order_number: order.order_number },
    });

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("send-order-confirmation error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
