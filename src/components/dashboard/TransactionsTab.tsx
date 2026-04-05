import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { ArrowDownLeft, Link2, Search, RefreshCw, LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { toast } from "sonner";

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

interface UnmatchedOrder {
  id: string;
  order_number: number;
  total: number;
  status: string;
  customer_name: string | null;
  invoice_date: string;
}

const TransactionsTab = () => {
  const [transactions, setTransactions] = useState<PaymentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<PaymentLog | null>(null);
  const [unmatchedOrders, setUnmatchedOrders] = useState<UnmatchedOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [matching, setMatching] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_logs")
      .select("*")
      .gte("amount", 0)
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

  const fetchUnmatchedOrders = async () => {
    setLoadingOrders(true);
    
    // Get order IDs that are already matched in payment_logs
    const { data: matchedLogs } = await supabase
      .from("payment_logs")
      .select("order_id")
      .eq("status", "matched")
      .not("order_id", "is", null);

    const matchedOrderIds = matchedLogs?.map(l => l.order_id).filter(Boolean) || [];

    // Get orders with status ready or confirmed that aren't matched yet
    let query = supabase
      .from("orders")
      .select("id, order_number, total, status, invoice_date, customer_id")
      .in("status", ["ready", "confirmed"])
      .order("order_number", { ascending: false });

    if (matchedOrderIds.length > 0) {
      query = query.not("id", "in", `(${matchedOrderIds.join(",")})`);
    }

    const { data: orders } = await query;

    if (orders && orders.length > 0) {
      // Fetch customer names
      const customerIds = [...new Set(orders.map(o => o.customer_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", customerIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      setUnmatchedOrders(orders.map(o => ({
        id: o.id,
        order_number: o.order_number,
        total: o.total,
        status: o.status,
        customer_name: profileMap.get(o.customer_id) || null,
        invoice_date: o.invoice_date,
      })));
    } else {
      setUnmatchedOrders([]);
    }
    setLoadingOrders(false);
  };

  const openMatchDialog = (tx: PaymentLog) => {
    setSelectedTransaction(tx);
    setMatchDialogOpen(true);
    fetchUnmatchedOrders();
  };

  const matchToOrder = async (order: UnmatchedOrder) => {
    if (!selectedTransaction) return;
    setMatching(true);

    // Update payment log with matched order
    const { error: logError } = await supabase
      .from("payment_logs")
      .update({ order_id: order.id, status: "matched" })
      .eq("id", selectedTransaction.id);

    if (logError) {
      toast.error("Fout bij het matchen van de transactie");
      setMatching(false);
      return;
    }

    // Update order status to paid
    const { error: orderError } = await supabase
      .from("orders")
      .update({ status: "paid" })
      .eq("id", order.id);

    if (orderError) {
      toast.error("Transactie gematcht, maar orderstatus kon niet worden bijgewerkt");
    } else {
      toast.success(`Transactie gematcht aan bestelling #${order.order_number}`);
    }

    setMatching(false);
    setMatchDialogOpen(false);
    setSelectedTransaction(null);
    fetchTransactions();
  };

  const filteredTransactions = transactions.filter((t) => {
    const query = searchQuery.toLowerCase();
    const name = t.counterparty_name?.toLowerCase() || "";
    const desc = t.description?.toLowerCase() || "";
    return name.includes(query) || desc.includes(query);
  });

  const formatCurrency = (value: number) => {
    return `€${Math.abs(value).toFixed(2)}`;
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

  const canManualMatch = (tx: PaymentLog) => {
    return tx.status === "unmatched" || tx.status === "amount_mismatch";
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
                    <Tooltip>
                      <TooltipTrigger>
                        <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                      </TooltipTrigger>
                      <TooltipContent>Inkomend</TooltipContent>
                    </Tooltip>
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
                  <td className="py-4 px-4 text-right tabular-nums font-medium text-sm text-emerald-600">
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
                      {canManualMatch(tx) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openMatchDialog(tx)}
                            >
                              <LinkIcon className="w-4 h-4 text-primary" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Handmatig matchen</TooltipContent>
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

      {/* Manual match dialog */}
      <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transactie handmatig matchen</DialogTitle>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="mb-4 p-3 bg-muted rounded-lg space-y-1">
              <p className="text-sm font-medium">{selectedTransaction.counterparty_name || "Onbekend"}</p>
              <p className="text-sm text-muted-foreground">{selectedTransaction.description || "—"}</p>
              <p className="text-sm font-semibold text-emerald-600">€{selectedTransaction.amount.toFixed(2)}</p>
            </div>
          )}

          <p className="text-sm text-muted-foreground mb-3">Kies de bestelling om aan te koppelen:</p>

          {loadingOrders ? (
            <p className="text-center py-6 text-muted-foreground">Bestellingen laden...</p>
          ) : unmatchedOrders.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">Geen openstaande bestellingen gevonden</p>
          ) : (
            <div className="space-y-2">
              {unmatchedOrders.map((order) => {
                const amountMatch = selectedTransaction 
                  ? Math.abs(selectedTransaction.amount - order.total) <= 0.10
                  : false;
                return (
                  <button
                    key={order.id}
                    disabled={matching}
                    onClick={() => matchToOrder(order)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">#{order.order_number}</span>
                        <span className="text-sm text-muted-foreground">{order.customer_name || "—"}</span>
                        {amountMatch && (
                          <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">Bedrag komt overeen</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(order.invoice_date), "d MMM yyyy", { locale: nl })} · {order.status === "ready" ? "Gereed" : "Bevestigd"}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${amountMatch ? "text-emerald-600" : "text-foreground"}`}>
                      €{order.total.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransactionsTab;
