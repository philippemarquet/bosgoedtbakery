import { useState, useEffect, useCallback } from "react";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { Plus, Pencil, Trash2, Search, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const renderTiers = (tiers: { min_quantity: number; discount_percentage: number }[]) => {
    if (tiers.length === 0) {
      return <span className="text-xs text-muted-foreground italic">Geen staffels</span>;
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {tiers.map((t, idx) => (
          <span
            key={idx}
            className="inline-flex items-baseline gap-1 px-2 py-0.5 rounded-[calc(var(--radius)-4px)] bg-muted/60 text-[11px] text-foreground tabular-nums"
          >
            <span className="text-muted-foreground">{t.min_quantity}+</span>
            <span>·</span>
            <span className="font-medium">{t.discount_percentage}%</span>
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="bakery-eyebrow mb-2">Back-office</p>
          <h2
            className="font-serif text-3xl md:text-4xl font-medium text-foreground leading-tight"
            style={{ letterSpacing: "-0.02em" }}
          >
            Kortingsgroepen
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Staffelkortingen koppelen aan één of meer producten.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Zoek kortingsgroep..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Nieuwe kortingsgroep
          </Button>
        </div>
      </div>

      <div className="paper-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-10"></TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Naam
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Beschrijving
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground text-center">
                  Producten
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Staffelkorting
                </TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                    <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border border-foreground/20 border-t-foreground/70" />
                    <p className="text-sm">Laden…</p>
                  </TableCell>
                </TableRow>
              ) : filteredGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground text-sm">
                    {searchQuery ? "Geen kortingsgroepen gevonden." : "Nog geen kortingsgroepen. Maak er een aan."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredGroups.map((group) => (
                  <TableRow key={group.id} className="border-b border-border/40 hover:bg-muted/40">
                    <TableCell className="py-3 w-10 pl-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        onClick={() => openEditDialog(group)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm text-foreground">{group.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">
                      {group.description || "—"}
                    </TableCell>
                    <TableCell className="py-3 text-center">
                      <span className="text-sm text-foreground tabular-nums">{group.productCount}</span>
                    </TableCell>
                    <TableCell className="py-3 text-sm">
                      {renderTiers(group.tiers)}
                    </TableCell>
                    <TableCell className="py-3 w-10 pr-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                        onClick={() => handleDelete(group.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
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
