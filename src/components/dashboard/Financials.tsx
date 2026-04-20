import { useState } from "react";
import { Users, Package, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CustomerAnalysis from "./financials/CustomerAnalysis";
import ProductAnalysis from "./financials/ProductAnalysis";
import FinancialOverview from "./financials/FinancialOverview";

const Financials = () => {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6">
      <div>
        <p className="bakery-eyebrow mb-2">Financieel</p>
        <h2
          className="font-serif text-3xl md:text-4xl font-medium text-foreground leading-tight"
          style={{ letterSpacing: "-0.02em" }}
        >
          Boekhouding
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Omzet, klanten en producten — in één oogopslag.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
          <TabsTrigger value="overview" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Overzicht</span>
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Klanten</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">Producten</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <FinancialOverview />
        </TabsContent>

        <TabsContent value="customers" className="mt-6">
          <CustomerAnalysis />
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <ProductAnalysis />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Financials;
