import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { ArrowUpRight, ArrowDownLeft, Link2, Search, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";

interface PaymentLog {
  id: string;
  amount: number;
  description: string | null;
  counterparty_name: string | null;
  status: string;
  order_id: string | null;
  created_at: string;
  transaction_date: string | null;
}

const TransactionsTab = () => {
  const [transactions, setTransactions] = useState<PaymentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTransactions(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useVisibilityRefresh(fetchTransactions);

  const filteredTransactions = transactions.filter((t) => {
    const query = searchQuery.toLowerCase();
    const name = t.counterparty_name?.toLowerCase() || "";
    const desc = t.description?.toLowerCase() || "";
    return name.includes(query) || desc.includes(query);
  });

  const formatCurrency = (value: number) => {
    const formatted = `€${Math.abs(value).toFixed(2)}`;
    return value < 0 ? `-${formatted}` : formatted;
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      matched: { label: "Gematcht", className: "bg-emerald-600 text-white" },
      unmatched: { label: "Niet gematcht", className: "bg-muted text-muted-foreground" },
      amount_mismatch: { label: "Bedrag afwijkend", className: "bg-amber-500 text-white" },
      update_failed: { label: "Update mislukt", className: "bg-destructive text-destructive-foreground" },
    };
    const config = configs[status] || { label: status, className: "" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Zoek op naam of omschrijving..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={fetchTransactions} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Vernieuwen
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-0 text-xs font-medium text-muted-foreground uppercase tracking-wider w-8"></th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Datum</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Naam</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Omschrijving</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Bedrag</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  Laden...
                </td>
              </tr>
            ) : filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  {searchQuery ? "Geen transacties gevonden" : "Nog geen transacties"}
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => (
                <tr 
                  key={tx.id} 
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-4 px-0">
                    {tx.amount >= 0 ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                        </TooltipTrigger>
                        <TooltipContent>Inkomend</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger>
                          <ArrowUpRight className="w-4 h-4 text-destructive" />
                        </TooltipTrigger>
                        <TooltipContent>Uitgaand</TooltipContent>
                      </Tooltip>
                    )}
                  </td>
                  <td className="py-4 px-4 text-muted-foreground tabular-nums text-sm font-light whitespace-nowrap">
                    {tx.transaction_date 
                      ? format(parseISO(tx.transaction_date), "d MMM yyyy", { locale: nl })
                      : format(parseISO(tx.created_at), "d MMM yyyy", { locale: nl })
                    }
                  </td>
                  <td className="py-4 px-4 text-foreground text-sm font-light">
                    {tx.counterparty_name || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-4 px-4 text-muted-foreground text-sm font-light max-w-xs truncate">
                    {tx.description || <span>—</span>}
                  </td>
                  <td className={`py-4 px-4 text-right tabular-nums font-medium text-sm ${tx.amount >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {formatCurrency(tx.amount)}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(tx.status)}
                      {tx.order_id && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Link2 className="w-4 h-4 text-primary" />
                          </TooltipTrigger>
                          <TooltipContent>Gekoppeld aan bestelling</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionsTab;
