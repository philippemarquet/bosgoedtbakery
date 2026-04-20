import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { ArrowDownLeft, Link2, Search, RefreshCw, LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
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

const StatusChip = ({ status }: { status: string }) => {
  const configs: Record<string, { label: string; cls: string }> = {
    matched: {
      label: "Gematcht",
      cls: "bg-foreground text-background ring-foreground",
    },
    unmatched: {
      label: "Niet gematcht",
      cls: "bg-muted/60 text-muted-foreground ring-border/60",
    },
    amount_mismatch: {
      label: "Bedrag wijkt af",
      cls: "bg-[hsl(var(--ember))]/10 text-[hsl(var(--ember))] ring-[hsl(var(--ember))]/30",
    },
    update_failed: {
      label: "Update mislukt",
      cls: "bg-destructive/10 text-destructive ring-destructive/30",
    },
  };
  const config = configs[status] || {
    label: status,
    cls: "bg-muted/60 text-muted-foreground ring-border/60",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium tracking-[0.08em] uppercase rounded-[calc(var(--radius)-4px)] ring-1 ring-inset ${config.cls}`}
    >
      {config.label}
    </span>
  );
};

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

  const canManualMatch = (tx: PaymentLog) => {
    return tx.status === "unmatched" || tx.status === "amount_mismatch";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="bakery-eyebrow mb-2">Transacties</p>
          <h2
            className="font-serif text-3xl md:text-4xl font-medium text-foreground leading-tight"
            style={{ letterSpacing: "-0.02em" }}
          >
            Betalingen
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Inkomende bankmutaties — automatisch of handmatig gematcht.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op naam of omschrijving…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={fetchTransactions} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Vernieuwen
          </Button>
        </div>
      </div>

      <div className="paper-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="text-left py-3 pl-6 pr-2 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em] w-8"></th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em]">Datum</th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em]">Naam</th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em]">Omschrijving</th>
                <th className="text-right py-3 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em]">Bedrag</th>
                <th className="text-left py-3 px-4 pr-6 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em]">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-muted-foreground">
                    <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border border-foreground/20 border-t-foreground/70" />
                    <p className="text-sm">Laden…</p>
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-muted-foreground text-sm">
                    {searchQuery ? "Geen transacties gevonden." : "Nog geen transacties."}
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/40 transition-colors"
                  >
                    <td className="py-3 pl-6 pr-2">
                      <Tooltip>
                        <TooltipTrigger>
                          <ArrowDownLeft className="w-4 h-4 text-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>Inkomend</TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground tabular-nums text-sm whitespace-nowrap">
                      {tx.transaction_date
                        ? format(parseISO(tx.transaction_date), "d MMM yyyy", { locale: nl })
                        : format(parseISO(tx.created_at), "d MMM yyyy", { locale: nl })
                      }
                    </td>
                    <td className="py-3 px-4 text-foreground text-sm">
                      {tx.counterparty_name || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-sm max-w-xs truncate">
                      {tx.description || <span>—</span>}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-medium text-sm text-foreground">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="py-3 px-4 pr-6">
                      <div className="flex items-center gap-2">
                        <StatusChip status={tx.status} />
                        {tx.order_id && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Link2 className="w-4 h-4 text-muted-foreground" />
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
                                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                onClick={() => openMatchDialog(tx)}
                              >
                                <LinkIcon className="w-4 h-4" />
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
      </div>

      {/* Manual match dialog */}
      <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader className="space-y-2">
            <p className="bakery-eyebrow">Handmatig matchen</p>
            <DialogTitle
              className="font-serif text-2xl md:text-3xl font-medium text-foreground leading-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              Koppel aan bestelling
            </DialogTitle>
          </DialogHeader>

          {selectedTransaction && (
            <div className="mb-4 p-4 rounded-[calc(var(--radius)-2px)] border border-border/60 bg-muted/30 space-y-1">
              <p className="text-sm font-medium text-foreground">
                {selectedTransaction.counterparty_name || "Onbekend"}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedTransaction.description || "—"}
              </p>
              <p className="font-serif text-lg font-medium tabular-nums text-foreground pt-1">
                €{selectedTransaction.amount.toFixed(2)}
              </p>
            </div>
          )}

          <p className="text-sm text-muted-foreground mb-3">
            Kies de bestelling om aan te koppelen:
          </p>

          {loadingOrders ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border border-foreground/20 border-t-foreground/70" />
              <p className="text-sm text-muted-foreground">Bestellingen laden…</p>
            </div>
          ) : unmatchedOrders.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">
              Geen openstaande bestellingen gevonden.
            </p>
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
                    className={`w-full flex items-center justify-between p-3 rounded-[calc(var(--radius)-2px)] border transition-colors text-left disabled:opacity-50 ${
                      amountMatch
                        ? "border-foreground/40 bg-muted/40 hover:bg-muted/60"
                        : "border-border/60 hover:bg-muted/40"
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">#{order.order_number}</span>
                        <span className="text-sm text-muted-foreground truncate">
                          {order.customer_name || "—"}
                        </span>
                        {amountMatch && (
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium tracking-[0.08em] uppercase rounded-[calc(var(--radius)-4px)] bg-foreground text-background ring-1 ring-inset ring-foreground">
                            Bedrag matcht
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(order.invoice_date), "d MMM yyyy", { locale: nl })} · {order.status === "ready" ? "Gereed" : "Bevestigd"}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-foreground shrink-0 ml-3">
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
