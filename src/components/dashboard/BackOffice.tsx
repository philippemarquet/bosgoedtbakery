import { Package } from "lucide-react";

const BackOffice = () => {
  return (
    <div className="space-y-6">
      <div className="bakery-card p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-serif font-semibold text-foreground mb-2">
          Back-office
        </h3>
        <p className="text-muted-foreground">
          Producten, recepten, en calculaties komen hier.
        </p>
      </div>
    </div>
  );
};

export default BackOffice;
