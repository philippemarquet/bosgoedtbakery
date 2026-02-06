import { useState, useEffect, useCallback, useMemo } from "react";
import { Calendar, Package, ShoppingCart, Loader2, MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

interface Product {
  id: string;
  name: string;
  selling_price: number;
  category_name?: string;
  image_url?: string | null;
}

type Props = {
  onOrderCreated?: () => void;
};

const CustomerPlaceOrderTab = ({ onOrderCreated }: Props) => {
  const [loading, setLoading] = useState(true);
  const [menus, setMenus] = useState<WeeklyMenu[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [menusRes, productsRes] = await Promise.all([
      supabase
        .from("weekly_menus")
        .select("*")
        .eq("status", "active")
        .order("delivery_date", { ascending: true }),
      supabase
        .from("products")
        .select("id, name, selling_price, image_url, category:categories(name)")
        .eq("is_orderable", true)
        .order("name"),
    ]);

    if (menusRes.error) {
      toast({ title: "Fout", description: "Kon weekmenu's niet laden", variant: "destructive" });
    }

    // Fetch products for each menu
    const menusWithProducts = await Promise.all(
      (menusRes.data || []).map(async (menu) => {
        const { data: menuProducts } = await supabase
          .from("weekly_menu_products")
          .select(`quantity, product:products(id, name)`)
          .eq("weekly_menu_id", menu.id);

        return {
          ...menu,
          products: (menuProducts || [])
            .filter((mp) => mp.product)
            .map((mp) => ({
              id: mp.product!.id,
              name: mp.product!.name,
              quantity: mp.quantity,
            })),
        };
      })
    );

    setMenus(menusWithProducts);
    setProducts(
      (productsRes.data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        selling_price: Number(p.selling_price),
        category_name: p.category?.name || "Zonder categorie",
        image_url: p.image_url,
      }))
    );
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useVisibilityRefresh(fetchData);

  // Group products by category
  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    products.forEach((product) => {
      const cat = product.category_name || "Zonder categorie";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(product);
    });
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "Zonder categorie") return 1;
      if (b === "Zonder categorie") return -1;
      return a.localeCompare(b);
    });
  }, [products]);

  const handleOrderSuccess = () => {
    setDialogOpen(false);
    onOrderCreated?.();
  };

  const formatCurrency = (value: number) => `€${value.toFixed(2)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with order button */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-serif text-2xl text-foreground">Bestelling plaatsen</h3>
          <p className="text-sm text-muted-foreground">
            Bekijk het aanbod en plaats je bestelling.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="sm:ml-auto shrink-0">
          <ShoppingCart className="w-4 h-4 mr-2" />
          Bestellen
        </Button>
      </div>

      {/* Weekly Menus Section */}
      {menus.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Weekmenu's
            </h4>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {menus.map((menu) => (
              <Card key={menu.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{menu.name}</CardTitle>
                      {menu.delivery_date && (
                        <CardDescription className="mt-1 text-xs">
                          Levering: {format(parseISO(menu.delivery_date), "EEEE d MMMM", { locale: nl })}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-sm font-semibold shrink-0">
                      {formatCurrency(menu.price)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex-1">
                  {menu.description && (
                    <p className="text-sm text-muted-foreground mb-3">{menu.description}</p>
                  )}
                  <ul className="space-y-1">
                    {menu.products.map((product) => (
                      <li key={product.id} className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
                        {product.quantity}x {product.name}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Extra Products Section */}
      {groupedProducts.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Losse producten
            </h4>
          </div>

          <div className="space-y-6">
            {groupedProducts.map(([categoryName, categoryProducts]) => (
              <div key={categoryName}>
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  {categoryName}
                </h5>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card"
                    >
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-10 h-10 rounded-md object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatCurrency(product.selling_price)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {menus.length === 0 && products.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">Geen producten beschikbaar</h3>
          <p className="text-muted-foreground">
            Er zijn momenteel geen producten of weekmenu's beschikbaar.
          </p>
        </div>
      )}

      <CustomerNewOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        weeklyMenu={null}
        onSuccess={handleOrderSuccess}
        availableMenus={menus}
      />
    </div>
  );
};

export default CustomerPlaceOrderTab;
