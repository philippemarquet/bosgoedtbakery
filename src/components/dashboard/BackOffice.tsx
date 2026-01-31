import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Wheat, Receipt, Calendar, Tag } from "lucide-react";
import ProductsTab from "@/components/backoffice/ProductsTab";
import IngredientsTab from "@/components/backoffice/IngredientsTab";
import FixedCostsTab from "@/components/backoffice/FixedCostsTab";
import CategoriesTab from "@/components/backoffice/CategoriesTab";
import WeeklyMenusTab from "@/components/backoffice/WeeklyMenusTab";

const BackOffice = () => {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
          <TabsTrigger value="products" className="gap-2">
            <Package className="w-4 h-4 hidden sm:block" />
            Producten
          </TabsTrigger>
          <TabsTrigger value="ingredients" className="gap-2">
            <Wheat className="w-4 h-4 hidden sm:block" />
            Ingrediënten
          </TabsTrigger>
          <TabsTrigger value="fixed-costs" className="gap-2">
            <Receipt className="w-4 h-4 hidden sm:block" />
            Vaste kosten
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <Tag className="w-4 h-4 hidden sm:block" />
            Categorieën
          </TabsTrigger>
          <TabsTrigger value="weekly-menus" className="gap-2">
            <Calendar className="w-4 h-4 hidden sm:block" />
            Weekmenu's
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-6">
          <ProductsTab />
        </TabsContent>

        <TabsContent value="ingredients" className="mt-6">
          <IngredientsTab />
        </TabsContent>

        <TabsContent value="fixed-costs" className="mt-6">
          <FixedCostsTab />
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <CategoriesTab />
        </TabsContent>

        <TabsContent value="weekly-menus" className="mt-6">
          <WeeklyMenusTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BackOffice;
