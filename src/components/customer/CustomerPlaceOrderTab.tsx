import { Calendar, ShoppingBag } from "lucide-react";
import CustomerWeekMenuView from "./CustomerWeekMenuView";
import CustomerExtrasOrderView from "./CustomerExtrasOrderView";

type SubTab = "weekmenu" | "extras";

type Props = {
  activeSubTab?: SubTab;
  onSubTabChange?: (tab: SubTab) => void;
  onOrderCreated?: () => void;
};

const CustomerPlaceOrderTab = ({ activeSubTab, onSubTabChange, onOrderCreated }: Props) => {
  const tab = activeSubTab ?? "weekmenu";

  const setTab = (t: SubTab) => {
    onSubTabChange?.(t);
  };

  return (
    <div className="space-y-6">
      {/* Minimal, Japandi-ish segmented control */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="space-y-1">
          <h3 className="font-serif text-2xl text-foreground">Bestelling plaatsen</h3>
          <p className="text-sm text-muted-foreground">
            Kies een weekmenu of bestel enkel losse producten.
          </p>
        </div>

        <div className="sm:ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("weekmenu")}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors
              ${tab === "weekmenu" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-foreground hover:bg-muted"}
            `}
          >
            <Calendar className="w-4 h-4" />
            Weekmenu
          </button>

          <button
            type="button"
            onClick={() => setTab("extras")}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors
              ${tab === "extras" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-foreground hover:bg-muted"}
            `}
          >
            <ShoppingBag className="w-4 h-4" />
            Losse producten
          </button>
        </div>
      </div>

      {/* Content */}
      {tab === "weekmenu" ? (
        <CustomerWeekMenuView />
      ) : (
        <CustomerExtrasOrderView onOrderCreated={onOrderCreated} />
      )}
    </div>
  );
};

export default CustomerPlaceOrderTab;
