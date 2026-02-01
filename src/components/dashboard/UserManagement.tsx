import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { User, UserCheck, UserX, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import AddCustomerDialog from "./AddCustomerDialog";
interface UserWithRole {
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: "baker" | "customer" | null;
  created_at: string;
}

const UserManagement = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      // Fetch profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, created_at");

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Create a map of user_id to role
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      // For now, we'll use user_id as a placeholder for email since we can't access auth.users directly
      // In a real app, you'd store email in profiles or use a server-side function
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => ({
        user_id: profile.user_id,
        email: `Gebruiker ${profile.user_id.slice(0, 8)}...`,
        full_name: profile.full_name,
        phone: profile.phone,
        role: roleMap.get(profile.user_id) as "baker" | "customer" | null,
        created_at: profile.created_at,
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Fout",
        description: "Kon gebruikers niet laden",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUsers = useCallback(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, []);

  // Refresh data when tab becomes visible again
  useVisibilityRefresh(refreshUsers);

  const updateUserRole = async (userId: string, newRole: "baker" | "customer") => {
    try {
      // Check if user already has a role
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from("user_roles")
          .update({ role: newRole })
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: newRole });

        if (error) throw error;
      }

      toast({
        title: "Succes",
        description: `Rol bijgewerkt naar ${newRole === "baker" ? "Bakker" : "Klant"}`,
      });

      fetchUsers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast({
        title: "Fout",
        description: "Kon rol niet bijwerken",
        variant: "destructive",
      });
    }
  };

  const removeUserRole = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Succes",
        description: "Rol verwijderd",
      });

      fetchUsers();
    } catch (error) {
      console.error("Error removing role:", error);
      toast({
        title: "Fout",
        description: "Kon rol niet verwijderen",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="bakery-card p-12 text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Gebruikers laden...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-serif font-semibold text-foreground">
            Alle Gebruikers
          </h3>
          <p className="text-sm text-muted-foreground">
            Beheer gebruikersrollen en toegang
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {users.length} gebruiker{users.length !== 1 ? "s" : ""}
          </span>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nieuwe klant
          </Button>
        </div>
      </div>

      {/* Users list */}
      {users.length === 0 ? (
        <div className="bakery-card p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-serif font-semibold text-foreground mb-2">
            Geen gebruikers
          </h3>
          <p className="text-muted-foreground">
            Er zijn nog geen geregistreerde gebruikers.
          </p>
        </div>
      ) : (
        <div className="bakery-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">
                    Gebruiker
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">
                    Telefoon
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">
                    Huidige Rol
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.user_id} className="border-b border-border last:border-0">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-foreground">
                          {user.full_name || "Onbekend"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-muted-foreground">
                      {user.phone || "-"}
                    </td>
                    <td className="py-4 px-4">
                      {user.role ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          user.role === "baker" 
                            ? "bg-primary/10 text-primary" 
                            : "bg-secondary text-secondary-foreground"
                        }`}>
                          {user.role === "baker" ? (
                            <>
                              <UserCheck className="w-3 h-3" />
                              Bakker
                            </>
                          ) : (
                            <>
                              <User className="w-3 h-3" />
                              Klant
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                          <UserX className="w-3 h-3" />
                          Geen rol
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateUserRole(user.user_id, "baker")}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            user.role === "baker"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-primary/10 text-foreground"
                          }`}
                        >
                          Bakker
                        </button>
                        <button
                          onClick={() => updateUserRole(user.user_id, "customer")}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            user.role === "customer"
                              ? "bg-secondary text-secondary-foreground"
                              : "bg-muted hover:bg-secondary/50 text-foreground"
                          }`}
                        >
                          Klant
                        </button>
                        {user.role && (
                          <button
                            onClick={() => removeUserRole(user.user_id)}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-muted hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            Verwijder
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddCustomerDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onCustomerAdded={fetchUsers}
      />
    </div>
  );
};

export default UserManagement;
