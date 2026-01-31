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
import WeeklyMenusTab from "@/components/backoffice/WeeklyMenusTab";
import DiscountGroupsTab from "@/components/backoffice/DiscountGroupsTab";

type TabValue = 
  | "products" 
  | "ingredients" 
  | "fixed-costs" 
  | "categories" 
  | "discount-groups" 
  | "weekly-menus";

const productSubItems = [
  { value: "products" as const, label: "Producten", icon: Package, description: "Beheer je producten en recepten" },
  { value: "ingredients" as const, label: "Ingrediënten", icon: Wheat, description: "Grondstoffen en hun prijzen" },
  { value: "categories" as const, label: "Categorieën", icon: Tag, description: "Productcategorieën beheren" },
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
      case "weekly-menus":
        return <WeeklyMenusTab />;
      default:
        return <ProductsTab />;
    }
  };

  const isProductSection = ["products", "ingredients", "fixed-costs", "categories"].includes(activeTab);

  return (
    <div className="space-y-6">
      <NavigationMenu className="max-w-none w-full justify-start">
        <NavigationMenuList className="gap-2">
          {/* Producten dropdown */}
          <NavigationMenuItem>
            <NavigationMenuTrigger 
              className={cn(
                "gap-2 h-10",
                isProductSection && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
              )}
            >
              <Package className="w-4 h-4" />
              Producten
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-[400px] gap-1 p-2">
                {productSubItems.map((item) => (
                  <li key={item.value}>
                    <button
                      onClick={() => setActiveTab(item.value)}
                      className={cn(
                        "block w-full select-none rounded-md p-3 leading-none no-underline outline-none transition-colors text-left",
                        "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                        activeTab === item.value && "bg-accent"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium leading-none">{item.label}</div>
                          <p className="line-clamp-1 text-sm leading-snug text-muted-foreground mt-1">
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

          {/* Kortingen - direct button */}
          <NavigationMenuItem>
            <button
              onClick={() => setActiveTab("discount-groups")}
              className={cn(
                "group inline-flex h-10 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors",
                "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none",
                "disabled:pointer-events-none disabled:opacity-50",
                activeTab === "discount-groups" && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
              )}
            >
              <Percent className="w-4 h-4 mr-2" />
              Kortingen
            </button>
          </NavigationMenuItem>

          {/* Weekmenu's - direct button */}
          <NavigationMenuItem>
            <button
              onClick={() => setActiveTab("weekly-menus")}
              className={cn(
                "group inline-flex h-10 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors",
                "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none",
                "disabled:pointer-events-none disabled:opacity-50",
                activeTab === "weekly-menus" && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
              )}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Weekmenu's
            </button>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>

      <div className="mt-6">
        {renderContent()}
      </div>
    </div>
  );
};

export default BackOffice;
