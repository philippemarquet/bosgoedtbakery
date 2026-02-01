import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { 
  User, 
  UserCheck, 
  Plus, 
  Archive, 
  ArchiveRestore, 
  AlertTriangle, 
  Trash2, 
  Edit, 
  Mail, 
  KeyRound,
  ChefHat,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import CustomerDialog from "./CustomerDialog";

interface UserWithRole {
  profile_id: string;
  user_id: string | null;
  full_name: string | null;
  phone: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  role: "baker" | "customer" | null;
  is_archived: boolean;
  created_at: string;
  order_count: number;
}

const UserManagement = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<UserWithRole | null>(null);
  const [archiveDialog, setArchiveDialog] = useState<{ open: boolean; user: UserWithRole | null }>({
    open: false,
    user: null,
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: UserWithRole | null }>({
    open: false,
    user: null,
  });
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      // Fetch profiles with their data
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, phone, street, house_number, postal_code, city, created_at, is_archived");

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
        full_name: profile.full_name,
        phone: profile.phone,
        street: profile.street,
        house_number: profile.house_number,
        postal_code: profile.postal_code,
        city: profile.city,
        role: profile.user_id ? (roleMap.get(profile.user_id) as "baker" | "customer" | null) : "customer",
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

  const toggleArchiveUser = async (user: UserWithRole) => {
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

  const deleteUser = async (user: UserWithRole) => {
    if (user.order_count > 0) {
      toast({
        title: "Niet toegestaan",
        description: "Klanten met bestellingen kunnen niet worden verwijderd.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Delete user role first if exists
      if (user.user_id) {
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", user.user_id);
      }

      // Delete profile
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", user.profile_id);

      if (profileError) throw profileError;

      toast({
        title: "Succes",
        description: "Klant is verwijderd",
      });

      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Fout",
        description: "Kon klant niet verwijderen",
        variant: "destructive",
      });
    }
    setDeleteDialog({ open: false, user: null });
  };

  const handleEditCustomer = (user: UserWithRole) => {
    setEditingCustomer(user);
    setCustomerDialogOpen(true);
  };

  const handleAddCustomer = () => {
    setEditingCustomer(null);
    setCustomerDialogOpen(true);
  };

  // Split users into bakers and customers
  const bakers = users.filter(u => u.role === "baker" && !u.is_archived);
  const activeCustomers = users.filter(u => u.role !== "baker" && !u.is_archived);
  const archivedCustomers = users.filter(u => u.role !== "baker" && u.is_archived);

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
            Beheer bakkers en klanten
          </p>
        </div>
      </div>

      <Tabs defaultValue="customers" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="customers" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Klanten ({activeCustomers.length})
          </TabsTrigger>
          <TabsTrigger value="bakers" className="flex items-center gap-2">
            <ChefHat className="w-4 h-4" />
            Bakkers ({bakers.length})
          </TabsTrigger>
        </TabsList>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleAddCustomer}>
              <Plus className="w-4 h-4 mr-2" />
              Nieuwe klant
            </Button>
          </div>

          {activeCustomers.length === 0 ? (
            <div className="bakery-card p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-serif font-semibold text-foreground mb-2">
                Geen klanten
              </h3>
              <p className="text-muted-foreground mb-4">
                Voeg je eerste klant toe.
              </p>
              <Button onClick={handleAddCustomer}>
                <Plus className="w-4 h-4 mr-2" />
                Nieuwe klant
              </Button>
            </div>
          ) : (
            <div className="bakery-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Naam</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Telefoon</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Adres</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Inlog</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Bestellingen</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Acties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCustomers.map((user) => (
                      <tr key={user.profile_id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="py-4 px-4">
                          <p className="font-medium text-foreground">
                            {user.full_name || "Onbekend"}
                          </p>
                        </td>
                        <td className="py-4 px-4 text-muted-foreground">
                          {user.phone || "-"}
                        </td>
                        <td className="py-4 px-4 text-muted-foreground text-sm">
                          {user.street ? (
                            <>
                              {user.street} {user.house_number}
                              {user.postal_code && <>, {user.postal_code}</>}
                              {user.city && <> {user.city}</>}
                            </>
                          ) : "-"}
                        </td>
                        <td className="py-4 px-4">
                          {user.user_id ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                              <Mail className="w-3 h-3" />
                              Ja
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                              <KeyRound className="w-3 h-3" />
                              Nee
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="secondary">{user.order_count}</Badge>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditCustomer(user)}
                              className="px-3 py-1.5 text-xs font-medium rounded-md bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                              title="Bewerken"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setArchiveDialog({ open: true, user })}
                              className="px-3 py-1.5 text-xs font-medium rounded-md bg-muted hover:bg-yellow-500/10 text-muted-foreground hover:text-yellow-600 transition-colors"
                              title="Archiveren"
                            >
                              <Archive className="w-3 h-3" />
                            </button>
                            {user.order_count === 0 && (
                              <button
                                onClick={() => setDeleteDialog({ open: true, user })}
                                className="px-3 py-1.5 text-xs font-medium rounded-md bg-muted hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                title="Verwijderen"
                              >
                                <Trash2 className="w-3 h-3" />
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

          {/* Archived customers */}
          {archivedCustomers.length > 0 && (
            <div className="bakery-card overflow-hidden opacity-75">
              <div className="px-4 py-3 bg-muted/30 border-b border-border">
                <h4 className="font-medium text-muted-foreground flex items-center gap-2">
                  <Archive className="w-4 h-4" />
                  Gearchiveerde klanten ({archivedCustomers.length})
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <tbody>
                    {archivedCustomers.map((user) => (
                      <tr key={user.profile_id} className="border-b border-border last:border-0">
                        <td className="py-3 px-4">
                          <p className="font-medium text-muted-foreground">
                            {user.full_name || "Onbekend"}
                          </p>
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
        </TabsContent>

        {/* Bakers Tab */}
        <TabsContent value="bakers" className="space-y-4">
          {bakers.length === 0 ? (
            <div className="bakery-card p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <ChefHat className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-serif font-semibold text-foreground mb-2">
                Geen bakkers
              </h3>
              <p className="text-muted-foreground">
                Er zijn nog geen bakkers geregistreerd.
              </p>
            </div>
          ) : (
            <div className="bakery-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Naam</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Telefoon</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bakers.map((user) => (
                      <tr key={user.profile_id} className="border-b border-border last:border-0">
                        <td className="py-4 px-4">
                          <p className="font-medium text-foreground">
                            {user.full_name || "Onbekend"}
                          </p>
                        </td>
                        <td className="py-4 px-4 text-muted-foreground">
                          {user.phone || "-"}
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            <UserCheck className="w-3 h-3" />
                            Bakker
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CustomerDialog
        open={customerDialogOpen}
        onOpenChange={setCustomerDialogOpen}
        onCustomerSaved={fetchUsers}
        customer={editingCustomer}
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
                  {archiveDialog.user.user_id 
                    ? "De klant kan niet meer inloggen, maar bestellingen blijven behouden."
                    : "De klant wordt verborgen, maar bestellingen blijven behouden."
                  }
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, user: deleteDialog.user })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Klant verwijderen
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.user && (
                <>
                  Weet je zeker dat je <strong>{deleteDialog.user.full_name || "deze klant"}</strong> definitief wilt verwijderen?
                  <br /><br />
                  <span className="text-destructive font-medium">
                    Dit kan niet ongedaan worden gemaakt!
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteDialog.user && deleteUser(deleteDialog.user)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Definitief verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserManagement;
