import { useState, useEffect, useCallback } from "react";
import { Calendar, Package, ShoppingCart, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import CustomerNewOrderDialog from "./CustomerNewOrderDialog";

interface WeeklyMenu {
  id: string;
  name: string;
  description: string | null;
  price: number;
  delivery_date: string | null;
  week_start_date: string;
  week_end_date: string;
  products: { id: string; name: string; quantity: number }[];
}

const CustomerWeekMenuView = () => {
  const [loading, setLoading] = useState(true);
  const [menus, setMenus] = useState<WeeklyMenu[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<WeeklyMenu | null>(null);
  const { toast } = useToast();

  const fetchActiveMenus = async () => {
    setLoading(true);

    // Fetch only active weekly menus
    const { data: menusData, error } = await supabase
      .from("weekly_menus")
      .select("*")
      .eq("status", "active")
      .order("delivery_date", { ascending: true });

    if (error) {
      toast({ title: "Fout", description: "Kon weekmenu's niet laden", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch products for each menu
    const menusWithProducts = await Promise.all(
      (menusData || []).map(async (menu) => {
        const { data: menuProducts } = await supabase
          .from("weekly_menu_products")
          .select(`
            quantity,
            product:products(id, name)
          `)
          .eq("weekly_menu_id", menu.id);

        return {
          ...menu,
          products: (menuProducts || [])
            .filter(mp => mp.product)
            .map(mp => ({
              id: mp.product!.id,
              name: mp.product!.name,
              quantity: mp.quantity,
            })),
        };
      })
    );

    setMenus(menusWithProducts);
    setLoading(false);
  };

  const refreshMenus = useCallback(() => {
    fetchActiveMenus();
  }, []);

  useEffect(() => {
    fetchActiveMenus();
  }, []);

  useVisibilityRefresh(refreshMenus);

  const openOrderDialog = (menu: WeeklyMenu) => {
    setSelectedMenu(menu);
    setDialogOpen(true);
  };

  const handleOrderSuccess = () => {
    setDialogOpen(false);
    setSelectedMenu(null);
    // The toast is shown in the dialog
  };

  const formatCurrency = (value: number) => `€${value.toFixed(2)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (menus.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-medium mb-2">Geen weekmenu's beschikbaar</h3>
        <p className="text-muted-foreground">
          Er zijn momenteel geen actieve weekmenu's. Kijk later nog eens terug!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-serif font-medium">Beschikbare weekmenu's</h3>
        <p className="text-sm text-muted-foreground">
          Bekijk en bestel de weekmenu's die beschikbaar zijn
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {menus.map((menu) => (
          <Card key={menu.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{menu.name}</CardTitle>
                  {menu.delivery_date && (
                    <CardDescription className="mt-1">
                      Levering: {format(parseISO(menu.delivery_date), "EEEE d MMMM", { locale: nl })}
                    </CardDescription>
                  )}
                </div>
                <Badge variant="secondary" className="text-lg font-semibold">
                  {formatCurrency(menu.price)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {menu.description && (
                <p className="text-sm text-muted-foreground mb-4">{menu.description}</p>
              )}
              
              <div className="space-y-2 mb-4 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Package className="w-4 h-4" />
                  Inhoud:
                </div>
                <ul className="space-y-1">
                  {menu.products.map((product) => (
                    <li key={product.id} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                      {product.quantity}x {product.name}
                    </li>
                  ))}
                </ul>
              </div>

              <Button 
                className="w-full mt-auto"
                onClick={() => openOrderDialog(menu)}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Bestellen
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <CustomerNewOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        weeklyMenu={selectedMenu}
        onSuccess={handleOrderSuccess}
      />
    </div>
  );
};

export default CustomerWeekMenuView;
