import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Search, Calendar, Check } from "lucide-react";
import { format, isWithinInterval, parseISO, startOfWeek, endOfWeek, addDays } from "date-fns";
import { nl } from "date-fns/locale";
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
import WeeklyMenuDialog from "./WeeklyMenuDialog";
import type { Database } from "@/integrations/supabase/types";

type WeeklyMenu = Database["public"]["Tables"]["weekly_menus"]["Row"];

interface WeeklyMenuWithDetails extends WeeklyMenu {
  productCount?: number;
  totalCost?: number;
  margin?: number;
  isActive?: boolean;
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

    const today = new Date();

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

        const isActive = isWithinInterval(today, {
          start: parseISO(menu.week_start_date),
          end: parseISO(menu.week_end_date),
        });

        return {
          ...menu,
          productCount,
          totalCost,
          margin: Number(menu.price) - totalCost,
          isActive,
        };
      })
    );

    setMenus(menusWithDetails);
    setLoading(false);
  };

  useEffect(() => {
    fetchMenus();
  }, []);

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

  const formatCurrency = (value: number) => {
    return `€${value.toFixed(2)}`;
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = parseISO(start);
    const endDate = parseISO(end);
    return `${format(startDate, "d MMM", { locale: nl })} - ${format(endDate, "d MMM yyyy", { locale: nl })}`;
  };

  const getMarginColor = (margin: number) => {
    if (margin < 0) return "text-destructive";
    if (margin < 5) return "text-yellow-600";
    return "text-green-600";
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
              <TableHead>Periode</TableHead>
              <TableHead className="text-center">Producten</TableHead>
              <TableHead className="text-right">Kostprijs</TableHead>
              <TableHead className="text-right">Verkoopprijs</TableHead>
              <TableHead className="text-right">Marge</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-[100px]">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Laden...
                </TableCell>
              </TableRow>
            ) : filteredMenus.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                  <TableCell className="text-center">{menu.productCount}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(menu.totalCost || 0)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(Number(menu.price))}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${getMarginColor(menu.margin || 0)}`}>
                    {formatCurrency(menu.margin || 0)}
                  </TableCell>
                  <TableCell className="text-center">
                    {menu.isActive ? (
                      <Badge className="bg-green-500 hover:bg-green-600">
                        <Check className="w-3 h-3 mr-1" />
                        Actief
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactief</Badge>
                    )}
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
