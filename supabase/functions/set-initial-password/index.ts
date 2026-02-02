import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) return json({ error: "Email en wachtwoord zijn verplicht" });

    if (password.length < 6) {
      return json({ error: "Wachtwoord moet minimaal 6 tekens zijn" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find the user by email
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      return json({ error: "Kon gebruikers niet ophalen" }, 500);
    }

    const user = usersData?.users?.find(u => u.email === email);
    
    if (!user) {
      // NB: altijd 200 teruggeven zodat supabase.functions.invoke() geen exception/blank screen veroorzaakt.
      return json({ error: "Gebruiker niet gevonden" });
    }

    // Check if this user has password_set = false (meaning they haven't set their password yet)
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, password_set")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return json({ error: "Profiel niet gevonden" });
    }

    if (profile.password_set) {
      return json({ error: "Wachtwoord is al ingesteld. Gebruik 'Wachtwoord vergeten' om te resetten." });
    }

    // Update the user's password
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      password: password,
    });

    if (updateError) {
      console.error("Error updating password:", updateError);
      return json({ error: "Kon wachtwoord niet instellen" }, 500);
    }

    // Mark password as set
    const { error: profileUpdateError } = await adminClient
      .from("profiles")
      .update({ password_set: true })
      .eq("id", profile.id);

    if (profileUpdateError) {
      console.error("Error updating profile:", profileUpdateError);
    }

    return json({ success: true, message: "Wachtwoord succesvol ingesteld" }, 200);
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return json({ error: message }, 500);
  }
});
