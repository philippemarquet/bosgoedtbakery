import { useState, useEffect, useCallback } from "react";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { Plus, Pencil, Trash2, Search, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import DiscountGroupDialog from "./DiscountGroupDialog";

interface DiscountGroup {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface DiscountGroupWithDetails extends DiscountGroup {
  productCount: number;
  tiers: { min_quantity: number; discount_percentage: number }[];
}

const DiscountGroupsTab = () => {
  const [groups, setGroups] = useState<DiscountGroupWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<DiscountGroup | null>(null);
  const { toast } = useToast();

  const fetchGroups = async () => {
    setLoading(true);

    const { data: groupsData, error } = await supabase
      .from("discount_groups")
      .select("*")
      .order("name");

    if (error) {
      toast({ title: "Fout", description: "Kon kortingsgroepen niet laden", variant: "destructive" });
      setLoading(false);
      return;
    }

    const groupsWithDetails = await Promise.all(
      (groupsData || []).map(async (group) => {
        const { count } = await supabase
          .from("product_discount_groups")
          .select("*", { count: "exact", head: true })
          .eq("discount_group_id", group.id);

        const { data: tiersData } = await supabase
          .from("discount_group_tiers")
          .select("min_quantity, discount_percentage")
          .eq("discount_group_id", group.id)
          .order("min_quantity");

        return {
          ...group,
          productCount: count || 0,
          tiers: tiersData || [],
        };
      })
    );

    setGroups(groupsWithDetails);
    setLoading(false);
  };

  const refreshGroups = useCallback(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchGroups();
  }, []);

  useVisibilityRefresh(refreshGroups);

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCreateDialog = () => {
    setEditingGroup(null);
    setDialogOpen(true);
  };

  const openEditDialog = (group: DiscountGroup) => {
    setEditingGroup(group);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Weet je zeker dat je deze kortingsgroep wilt verwijderen?")) return;

    const { error } = await supabase.from("discount_groups").delete().eq("id", id);

    if (error) {
      toast({ title: "Fout", description: "Kon kortingsgroep niet verwijderen", variant: "destructive" });
      return;
    }
    toast({ title: "Verwijderd", description: "Kortingsgroep verwijderd" });
    fetchGroups();
  };

  const formatTiers = (tiers: { min_quantity: number; discount_percentage: number }[]) => {
    if (tiers.length === 0) return "Geen staffels";
    return tiers
      .map((t) => `${t.min_quantity}+ = ${t.discount_percentage}%`)
      .join(", ");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Zoek kortingsgroep..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary"
          />
        </div>
        <Button onClick={openCreateDialog} size="sm" className="font-normal">
          <Plus className="w-4 h-4 mr-2" />
          Nieuwe kortingsgroep
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Naam</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Beschrijving</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-center">Producten</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Staffelkorting</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  Laden...
                </TableCell>
              </TableRow>
            ) : filteredGroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  {searchQuery ? "Geen kortingsgroepen gevonden" : "Nog geen kortingsgroepen. Maak er een aan!"}
                </TableCell>
              </TableRow>
            ) : (
              filteredGroups.map((group) => (
                <TableRow key={group.id} className="border-0 hover:bg-muted/30">
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-normal">{group.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-muted-foreground">
                    {group.description || "-"}
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    <span className="text-sm tabular-nums">{group.productCount}</span>
                  </TableCell>
                  <TableCell className="py-3 text-sm text-muted-foreground">
                    {formatTiers(group.tiers)}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditDialog(group)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(group.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <DiscountGroupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingGroup={editingGroup}
        onSave={fetchGroups}
      />
    </div>
  );
};

export default DiscountGroupsTab;
