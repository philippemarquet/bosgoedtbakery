import { useState } from "react";
import { Calendar, ShoppingBag } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CustomerWeekMenuView from "./CustomerWeekMenuView";

const CustomerPlaceOrderTab = () => {
  const [activeSubTab, setActiveSubTab] = useState("weekmenu");

  return (
    <div className="space-y-6">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="weekmenu" className="gap-2">
            <Calendar className="w-4 h-4" />
            Weekmenu
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weekmenu" className="mt-6">
          <CustomerWeekMenuView />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CustomerPlaceOrderTab;
