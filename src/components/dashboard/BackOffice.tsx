import { useState } from "react";
import { Package, Wheat, Receipt, Tag, Percent, Calendar } from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import ProductsTab from "@/components/backoffice/ProductsTab";
import IngredientsTab from "@/components/backoffice/IngredientsTab";
import FixedCostsTab from "@/components/backoffice/FixedCostsTab";
import CategoriesTab from "@/components/backoffice/CategoriesTab";
import WeeklyOfferingsTab from "@/components/backoffice/WeeklyOfferingsTab";
import DiscountGroupsTab from "@/components/backoffice/DiscountGroupsTab";

type TabValue =
  | "products"
  | "ingredients"
  | "fixed-costs"
  | "categories"
  | "discount-groups"
  | "weekly-offerings";

const productSubItems = [
  { value: "products" as const, label: "Producten", icon: Package, description: "Recepten & verkoopeenheden" },
  { value: "ingredients" as const, label: "Ingrediënten", icon: Wheat, description: "Grondstoffen en inkoopprijzen" },
  { value: "categories" as const, label: "Categorieën", icon: Tag, description: "Groepen voor je producten" },
  { value: "fixed-costs" as const, label: "Vaste kosten", icon: Receipt, description: "Verpakking, energie, arbeid" },
];

const BackOffice = () => {
  const [activeTab, setActiveTab] = useState<TabValue>("products");

  const renderContent = () => {
    switch (activeTab) {
      case "products":
        return <ProductsTab />;
      case "ingredients":
        return <IngredientsTab />;
      case "fixed-costs":
        return <FixedCostsTab />;
      case "categories":
        return <CategoriesTab />;
      case "discount-groups":
        return <DiscountGroupsTab />;
      case "weekly-offerings":
        return <WeeklyOfferingsTab />;
      default:
        return <ProductsTab />;
    }
  };

  const isProductSection = ["products", "ingredients", "fixed-costs", "categories"].includes(activeTab);

  const directBtn = (isActive: boolean) =>
    cn(
      "group inline-flex h-10 w-max items-center justify-center rounded-[calc(var(--radius)-4px)] px-3.5 py-2 text-sm transition-colors",
      "border border-transparent",
      "hover:bg-muted/60 hover:text-foreground focus:bg-muted/60 focus:text-foreground focus:outline-none",
      "disabled:pointer-events-none disabled:opacity-50",
      isActive
        ? "bg-foreground text-background hover:bg-foreground hover:text-background focus:bg-foreground focus:text-background"
        : "text-muted-foreground"
    );

  return (
    <div className="space-y-6">
      <NavigationMenu className="max-w-none w-full justify-start">
        <NavigationMenuList className="gap-1.5">
          <NavigationMenuItem>
            <NavigationMenuTrigger
              className={cn(
                "gap-2 h-10 rounded-[calc(var(--radius)-4px)] text-sm border border-transparent",
                "hover:bg-muted/60 focus:bg-muted/60",
                isProductSection
                  ? "bg-foreground text-background hover:bg-foreground hover:text-background focus:bg-foreground focus:text-background data-[state=open]:bg-foreground data-[state=open]:text-background"
                  : "text-muted-foreground"
              )}
            >
              <Package className="w-4 h-4" />
              Producten
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-[420px] gap-1 p-2">
                {productSubItems.map((item) => (
                  <li key={item.value}>
                    <button
                      onClick={() => setActiveTab(item.value)}
                      className={cn(
                        "block w-full select-none rounded-[calc(var(--radius)-4px)] p-3 leading-none outline-none transition-colors text-left",
                        "hover:bg-muted/60 focus:bg-muted/60",
                        activeTab === item.value && "bg-muted/70"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 h-9 w-9 rounded-[calc(var(--radius)-4px)] bg-muted/60 flex items-center justify-center">
                          <item.icon className="w-4 h-4 text-foreground/80" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground leading-none">{item.label}</div>
                          <p className="line-clamp-1 text-xs leading-snug text-muted-foreground mt-1.5">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <button
              onClick={() => setActiveTab("discount-groups")}
              className={directBtn(activeTab === "discount-groups")}
            >
              <Percent className="w-4 h-4 mr-2" />
              Kortingen
            </button>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <button
              onClick={() => setActiveTab("weekly-offerings")}
              className={directBtn(activeTab === "weekly-offerings")}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Weekaanbod
            </button>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>

      <div className="mt-2">{renderContent()}</div>
    </div>
  );
};

export default BackOffice;
