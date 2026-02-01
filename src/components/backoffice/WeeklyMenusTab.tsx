import { useState, useEffect, useCallback } from "react";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { Plus, Pencil, Trash2, Search, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import WeeklyMenuDialog from "./WeeklyMenuDialog";
import type { Database } from "@/integrations/supabase/types";

type WeeklyMenu = Database["public"]["Tables"]["weekly_menus"]["Row"];

type MenuStatus = "upcoming" | "active" | "expired";

const STATUS_OPTIONS: { value: MenuStatus; label: string; color: string }[] = [
  { value: "upcoming", label: "Toekomstig", color: "bg-blue-500" },
  { value: "active", label: "Actief", color: "bg-green-500" },
  { value: "expired", label: "Verlopen", color: "bg-muted text-muted-foreground" },
];

interface WeeklyMenuWithDetails extends WeeklyMenu {
  productCount?: number;
  totalCost?: number;
  margin?: number;
}

const WeeklyMenusTab = () => {
  const [menus, setMenus] = useState<WeeklyMenuWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<WeeklyMenu | null>(null);
  const { toast } = useToast();

  const fetchMenus = async () => {
    setLoading(true);
    
    const { data: menusData, error } = await supabase
      .from("weekly_menus")
      .select("*")
      .order("week_start_date", { ascending: false });

    if (error) {
      toast({ title: "Fout", description: "Kon weekmenu's niet laden", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch product counts and calculate costs
    const menusWithDetails = await Promise.all(
      (menusData || []).map(async (menu) => {
        const { data: menuProducts } = await supabase
          .from("weekly_menu_products")
          .select(`
            quantity,
            product:products(
              id,
              selling_price,
              yield_quantity
            )
          `)
          .eq("weekly_menu_id", menu.id);

        let totalCost = 0;
        const productCount = menuProducts?.length || 0;

        // Calculate total cost based on product costs
        for (const mp of menuProducts || []) {
          if (!mp.product) continue;

          // Get ingredient costs
          const { data: ingredients } = await supabase
            .from("recipe_ingredients")
            .select(`quantity, ingredient:ingredients(price_per_unit)`)
            .eq("product_id", mp.product.id);

          // Get fixed costs
          const { data: fixedCosts } = await supabase
            .from("recipe_fixed_costs")
            .select(`quantity, fixed_cost:fixed_costs(price_per_unit)`)
            .eq("product_id", mp.product.id);

          let productCost = 0;
          ingredients?.forEach((i) => {
            if (i.ingredient) {
              productCost += Number(i.quantity) * Number(i.ingredient.price_per_unit);
            }
          });
          fixedCosts?.forEach((f) => {
            if (f.fixed_cost) {
              productCost += Number(f.quantity) * Number(f.fixed_cost.price_per_unit);
            }
          });

          const costPerUnit = mp.product.yield_quantity > 0 
            ? productCost / Number(mp.product.yield_quantity) 
            : productCost;

          totalCost += costPerUnit * mp.quantity;
        }

        return {
          ...menu,
          productCount,
          totalCost,
          margin: Number(menu.price) - totalCost,
        };
      })
    );

    setMenus(menusWithDetails);
    setLoading(false);
  };

  const refreshMenus = useCallback(() => {
    fetchMenus();
  }, []);

  useEffect(() => {
    fetchMenus();
  }, []);

  useVisibilityRefresh(refreshMenus);

  const filteredMenus = menus.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCreateDialog = () => {
    setEditingMenu(null);
    setDialogOpen(true);
  };

  const openEditDialog = (menu: WeeklyMenu) => {
    setEditingMenu(menu);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Weet je zeker dat je dit weekmenu wilt verwijderen?")) return;

    const { error } = await supabase.from("weekly_menus").delete().eq("id", id);

    if (error) {
      toast({ title: "Fout", description: "Kon weekmenu niet verwijderen", variant: "destructive" });
      return;
    }
    toast({ title: "Verwijderd", description: "Weekmenu verwijderd" });
    fetchMenus();
  };

  const handleStatusChange = async (menuId: string, newStatus: MenuStatus) => {
    const { error } = await supabase
      .from("weekly_menus")
      .update({ status: newStatus })
      .eq("id", menuId);

    if (error) {
      toast({ title: "Fout", description: "Kon status niet bijwerken", variant: "destructive" });
      return;
    }
    
    // Update local state immediately
    setMenus(prev => prev.map(m => 
      m.id === menuId ? { ...m, status: newStatus } : m
    ));
    
    toast({ title: "Opgeslagen", description: "Status bijgewerkt" });
  };

  const formatCurrency = (value: number) => {
    return `€${value.toFixed(2)}`;
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = parseISO(start);
    const endDate = parseISO(end);
    return `${format(startDate, "d MMM", { locale: nl })} - ${format(endDate, "d MMM yyyy", { locale: nl })}`;
  };

  const formatDeliveryDate = (date: string | null) => {
    if (!date) return "-";
    return format(parseISO(date), "EEEE d MMM", { locale: nl });
  };

  const getMarginColor = (costPrice: number, sellingPrice: number) => {
    if (sellingPrice <= 0) return "text-muted-foreground";
    const marginPercent = ((sellingPrice - costPrice) / sellingPrice) * 100;
    if (marginPercent < 30) return "text-destructive";
    if (marginPercent < 60) return "text-yellow-600";
    return "text-green-600";
  };

  const formatMarginPercent = (costPrice: number, sellingPrice: number) => {
    if (sellingPrice <= 0) return "0%";
    const marginPercent = ((sellingPrice - costPrice) / sellingPrice) * 100;
    return `${marginPercent.toFixed(0)}%`;
  };

  const getStatusBadge = (status: string) => {
    const option = STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0];
    return (
      <Badge className={`${option.color} hover:${option.color}`}>
        {option.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Zoek weekmenu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Nieuw weekmenu
        </Button>
      </div>

      <div className="bakery-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naam</TableHead>
              <TableHead>Week</TableHead>
              <TableHead>Leverdag</TableHead>
              <TableHead className="text-center">Producten</TableHead>
              <TableHead className="text-right">Kostprijs</TableHead>
              <TableHead className="text-right">Verkoopprijs</TableHead>
              <TableHead className="text-right">Marge</TableHead>
              <TableHead className="text-center w-[150px]">Status</TableHead>
              <TableHead className="w-[100px]">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Laden...
                </TableCell>
              </TableRow>
            ) : filteredMenus.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "Geen weekmenu's gevonden" : "Nog geen weekmenu's. Maak er een aan!"}
                </TableCell>
              </TableRow>
            ) : (
              filteredMenus.map((menu) => (
                <TableRow key={menu.id}>
                  <TableCell className="font-medium">{menu.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {formatDateRange(menu.week_start_date, menu.week_end_date)}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatDeliveryDate(menu.delivery_date)}
                  </TableCell>
                  <TableCell className="text-center">{menu.productCount}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(menu.totalCost || 0)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(Number(menu.price))}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${getMarginColor(menu.totalCost || 0, Number(menu.price))}`}>
                    {formatCurrency(menu.margin || 0)} ({formatMarginPercent(menu.totalCost || 0, Number(menu.price))})
                  </TableCell>
                  <TableCell className="text-center">
                    <Select
                      value={(menu as any).status || "upcoming"}
                      onValueChange={(value) => handleStatusChange(menu.id, value as MenuStatus)}
                    >
                      <SelectTrigger className="w-[130px] h-8">
                        <SelectValue>
                          {getStatusBadge((menu as any).status || "upcoming")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <Badge className={`${option.color} hover:${option.color}`}>
                              {option.label}
                            </Badge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(menu)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(menu.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <WeeklyMenuDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingMenu={editingMenu}
        onSave={fetchMenus}
      />
    </div>
  );
};

export default WeeklyMenusTab;
