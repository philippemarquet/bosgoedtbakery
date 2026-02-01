import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { User, UserCheck, UserX, Plus, Archive, ArchiveRestore, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AddCustomerDialog from "./AddCustomerDialog";

interface UserWithRole {
  profile_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: "baker" | "customer" | null;
  is_archived: boolean;
  created_at: string;
  order_count: number;
}

const UserManagement = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [archiveDialog, setArchiveDialog] = useState<{ open: boolean; user: UserWithRole | null }>({
    open: false,
    user: null,
  });
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      // Fetch profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, phone, created_at, is_archived");

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Fetch order counts per customer
      const { data: orderCounts, error: orderError } = await supabase
        .from("orders")
        .select("customer_id");

      if (orderError) throw orderError;

      // Create maps
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      const orderCountMap = new Map<string, number>();
      
      orderCounts?.forEach(o => {
        const count = orderCountMap.get(o.customer_id) || 0;
        orderCountMap.set(o.customer_id, count + 1);
      });

      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => ({
        profile_id: profile.id,
        user_id: profile.user_id,
        email: `Gebruiker ${profile.user_id.slice(0, 8)}...`,
        full_name: profile.full_name,
        phone: profile.phone,
        role: roleMap.get(profile.user_id) as "baker" | "customer" | null,
        is_archived: profile.is_archived || false,
        created_at: profile.created_at,
        order_count: orderCountMap.get(profile.id) || 0,
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

  useVisibilityRefresh(refreshUsers);

  const updateUserRole = async (userId: string, newRole: "baker" | "customer") => {
    try {
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (existingRole) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role: newRole })
          .eq("user_id", userId);

        if (error) throw error;
      } else {
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

  const toggleArchiveUser = async (user: UserWithRole) => {
    // Check if user has orders and is being unarchived (no restriction) or archived (always allowed)
    if (!user.is_archived && user.order_count > 0) {
      // Archiving is always allowed
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_archived: !user.is_archived })
        .eq("id", user.profile_id);

      if (error) throw error;

      toast({
        title: "Succes",
        description: user.is_archived ? "Klant geactiveerd" : "Klant gearchiveerd",
      });

      fetchUsers();
    } catch (error) {
      console.error("Error archiving user:", error);
      toast({
        title: "Fout",
        description: "Kon klant niet archiveren",
        variant: "destructive",
      });
    }
    setArchiveDialog({ open: false, user: null });
  };

  const activeUsers = users.filter(u => !u.is_archived);
  const archivedUsers = users.filter(u => u.is_archived);

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
            Gebruikersbeheer
          </h3>
          <p className="text-sm text-muted-foreground">
            Beheer gebruikersrollen en toegang
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {activeUsers.length} actief, {archivedUsers.length} gearchiveerd
          </span>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nieuwe klant
          </Button>
        </div>
      </div>

      {/* Active users */}
      {activeUsers.length === 0 && archivedUsers.length === 0 ? (
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
        <>
          {/* Active users table */}
          <div className="bakery-card overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border">
              <h4 className="font-medium">Actieve gebruikers ({activeUsers.length})</h4>
            </div>
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
                      Bestellingen
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">
                      Rol
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">
                      Acties
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeUsers.map((user) => (
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
                        <Badge variant="secondary">{user.order_count}</Badge>
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
                          {user.role === "customer" && (
                            <button
                              onClick={() => setArchiveDialog({ open: true, user })}
                              className="px-3 py-1.5 text-xs font-medium rounded-md bg-muted hover:bg-yellow-500/10 text-muted-foreground hover:text-yellow-600 transition-colors"
                              title="Archiveren"
                            >
                              <Archive className="w-3 h-3" />
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

          {/* Archived users */}
          {archivedUsers.length > 0 && (
            <div className="bakery-card overflow-hidden opacity-75">
              <div className="px-4 py-3 bg-muted/30 border-b border-border">
                <h4 className="font-medium text-muted-foreground flex items-center gap-2">
                  <Archive className="w-4 h-4" />
                  Gearchiveerde gebruikers ({archivedUsers.length})
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <tbody>
                    {archivedUsers.map((user) => (
                      <tr key={user.user_id} className="border-b border-border last:border-0">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-muted-foreground">
                              {user.full_name || "Onbekend"}
                            </p>
                            <p className="text-sm text-muted-foreground/70">
                              {user.email}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {user.phone || "-"}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">{user.order_count} bestellingen</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleArchiveUser(user)}
                          >
                            <ArchiveRestore className="w-3 h-3 mr-1" />
                            Activeren
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <AddCustomerDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onCustomerAdded={fetchUsers}
      />

      {/* Archive confirmation dialog */}
      <AlertDialog open={archiveDialog.open} onOpenChange={(open) => setArchiveDialog({ open, user: archiveDialog.user })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Klant archiveren
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveDialog.user && (
                <>
                  Weet je zeker dat je <strong>{archiveDialog.user.full_name || "deze klant"}</strong> wilt archiveren?
                  <br /><br />
                  De klant kan niet meer inloggen, maar bestellingen en facturen blijven behouden.
                  {archiveDialog.user.order_count > 0 && (
                    <span className="block mt-2 text-sm">
                      Deze klant heeft {archiveDialog.user.order_count} bestelling(en).
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveDialog.user && toggleArchiveUser(archiveDialog.user)}>
              Archiveren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserManagement;
