import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Validate webhook secret
    const authHeader = req.headers.get("Authorization");
    const expectedSecret = Deno.env.get("PAYMENT_WEBHOOK_SECRET");
    
    if (!authHeader || !expectedSecret) {
      console.error("Missing authorization header or webhook secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract token from "Bearer <token>" format
    const token = authHeader.replace("Bearer ", "").trim();
    if (token !== expectedSecret) {
      console.error("Invalid webhook secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const payload = await req.json();
    console.log("Received payment webhook:", JSON.stringify(payload));

    const { amount, description, counterparty_name, date } = payload;

    // Validate required fields
    if (amount === undefined || amount === null) {
      return new Response(JSON.stringify({ error: "Amount is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse amount - handle both string and number formats
    const parsedAmount = typeof amount === "string" 
      ? parseFloat(amount.replace(",", ".")) 
      : amount;

    if (isNaN(parsedAmount)) {
      return new Response(JSON.stringify({ error: "Invalid amount format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse date if provided (expects YYYY-MM-DD or ISO format)
    let transactionDate: string | null = null;
    if (date) {
      // Try to parse the date - accept various formats
      const dateStr = typeof date === "string" ? date : String(date);
      // Extract just the date part (YYYY-MM-DD) if it's a full ISO string
      const dateMatch = dateStr.match(/^\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        transactionDate = dateMatch[0];
      } else {
        // Try to parse other formats (e.g., DD-MM-YYYY)
        const dmyMatch = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})/);
        if (dmyMatch) {
          transactionDate = `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
        }
      }
      console.log(`Parsed transaction date: ${transactionDate}`);
    }

    // Create admin client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Try to extract order number from description
    // Order numbers are 8 digits starting with 202 (e.g., 20260001, 20260190)
    const orderNumberMatch = description?.match(/\b(202\d{5})\b/);
    const orderNumber = orderNumberMatch ? parseInt(orderNumberMatch[1], 10) : null;

    let matchedOrder = null;
    let logStatus = "unmatched";

    if (orderNumber) {
      console.log(`Found order number in description: ${orderNumber}`);

      // Look for matching order with status 'ready' (ready for payment)
      const { data: orders, error: orderError } = await supabase
        .from("orders")
        .select("id, order_number, total, status")
        .eq("order_number", orderNumber)
        .in("status", ["ready", "confirmed"]) // Accept both ready and confirmed orders
        .limit(1);

      if (orderError) {
        console.error("Error querying orders:", orderError);
      } else if (orders && orders.length > 0) {
        const order = orders[0];
        console.log(`Found order: ${order.id}, total: ${order.total}, status: ${order.status}`);

        // Check if amount matches (with 0.10 tolerance for rounding)
        const amountDiff = Math.abs(parsedAmount - order.total);
        if (amountDiff <= 0.10) {
          // Match! Update order status to paid
          const { error: updateError } = await supabase
            .from("orders")
            .update({ status: "paid" })
            .eq("id", order.id);

          if (updateError) {
            console.error("Error updating order status:", updateError);
            logStatus = "update_failed";
          } else {
            console.log(`Order ${orderNumber} marked as paid`);
            matchedOrder = order;
            logStatus = "matched";
          }
        } else {
          console.log(`Amount mismatch: expected ${order.total}, got ${parsedAmount}`);
          logStatus = "amount_mismatch";
        }
      } else {
        console.log(`No matching order found for order number ${orderNumber}`);
      }
    } else {
      console.log("No order number found in description");
    }

    // Log the payment with transaction date
    const { error: logError } = await supabase.from("payment_logs").insert({
      order_id: matchedOrder?.id || null,
      amount: parsedAmount,
      description: description || null,
      counterparty_name: counterparty_name || null,
      status: logStatus,
      raw_payload: payload,
      transaction_date: transactionDate,
    });

    if (logError) {
      console.error("Error logging payment:", logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        matched: logStatus === "matched",
        order_number: orderNumber,
        status: logStatus,
        message: logStatus === "matched" 
          ? `Order ${orderNumber} marked as paid` 
          : logStatus === "amount_mismatch"
          ? `Order found but amount doesn't match`
          : orderNumber 
          ? `No matching order found for ${orderNumber}`
          : `No order number found in description`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing payment webhook:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
