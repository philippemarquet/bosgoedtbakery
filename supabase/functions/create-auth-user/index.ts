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

  try {
    // Verify the request is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with user's token to verify they're a baker
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the current user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is a baker
    const { data: roleData } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || roleData.role !== "baker") {
      return new Response(JSON.stringify({ error: "Only bakers can create users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { email, full_name, profile_id } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // First, check if a user with this email already exists
    const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers();
    
    let existingUser = null;
    if (!listError && existingUsers?.users) {
      existingUser = existingUsers.users.find(u => u.email === email);
    }

    let newUserId: string;

    if (existingUser) {
      // User already exists, use their ID
      newUserId = existingUser.id;
      console.log("User already exists, linking to existing auth user:", newUserId);
    } else {
      // Generate a secure random password (user will reset it on first login)
      const tempPassword = crypto.randomUUID() + crypto.randomUUID();

      // Create the user with email_confirm: true so they're pre-approved
      const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true, // Auto-confirm the email
        user_metadata: { full_name },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      newUserId = authData.user.id;
    }

    // If profile_id is provided, we need to:
    // 1. Delete the auto-created profile (from the handle_new_user trigger)
    // 2. Update the existing profile with the new user_id
    if (profile_id) {
      // First, delete the auto-created profile
      const { error: deleteError } = await adminClient
        .from("profiles")
        .delete()
        .eq("user_id", newUserId);

      if (deleteError) {
        console.error("Error deleting auto-created profile:", deleteError);
      }

      // Then update the existing profile with the new user_id
      const { error: updateError } = await adminClient
        .from("profiles")
        .update({ user_id: newUserId })
        .eq("id", profile_id);

      if (updateError) {
        console.error("Error updating existing profile:", updateError);
      }
    }

    // If we linked to an existing profile, also set password_set to false
    if (profile_id) {
      const { error: pwSetError } = await adminClient
        .from("profiles")
        .update({ password_set: false })
        .eq("id", profile_id);

      if (pwSetError) {
        console.error("Error setting password_set to false:", pwSetError);
      }
    }

    // Create customer role for the new user (only if not already exists)
    const { data: existingRole } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", newUserId)
      .single();

    if (!existingRole) {
      const { error: roleError } = await adminClient.from("user_roles").insert({
        user_id: newUserId,
        role: "customer",
      });

      if (roleError) {
        console.error("Error creating role:", roleError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: newUserId,
        message: "User created successfully" 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
