import { useState, useEffect, useCallback } from "react";
import { CheckSquare, Package, Users, Loader2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type StatusFilter = "confirmed" | "in_production" | "all_production";
type GroupBy = "product" | "customer";

interface OrderLineItem {
  orderItemId: string;
  orderId: string;
  orderNumber: number;
  customerName: string;
  customerId: string;
  productId: string;
  productName: string;
  quantity: number;
}

interface Props {
  statusFilter: StatusFilter;
}

const ProductionChecklist = ({ statusFilter }: Props) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<OrderLineItem[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<GroupBy>(() => {
    const saved = localStorage.getItem("production_checklist_groupBy");
    return (saved === "product" || saved === "customer") ? saved : "customer";
  });
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        customer_id,
        customer:profiles!orders_customer_id_fkey(id, full_name)
      `);

    if (statusFilter === "confirmed") {
      query = query.eq("status", "confirmed");
    } else if (statusFilter === "in_production") {
      query = query.eq("status", "in_production");
    } else {
      query = query.in("status", ["confirmed", "in_production"]);
    }

    const { data: orders, error: ordersErr } = await query;

    if (ordersErr || !orders || orders.length === 0) {
      setItems([]);
      setCheckedItems(new Set());
      setLoading(false);
      return;
    }

    const orderIds = orders.map((o: any) => o.id);

    // Fetch order items and production checks in parallel
    const [orderItemsResult, checksResult] = await Promise.all([
      supabase
        .from("order_items")
        .select(`
          id,
          order_id,
          product_id,
          quantity,
          product:products(id, name)
        `)
        .in("order_id", orderIds),
      supabase
        .from("production_checks")
        .select("order_item_id"),
    ]);

    if (orderItemsResult.error) {
      console.error("Error fetching order items:", orderItemsResult.error);
      setItems([]);
      setLoading(false);
      return;
    }

    const orderMap = new Map<string, any>();
    for (const o of orders as any[]) {
      orderMap.set(o.id, o);
    }

    const lineItems: OrderLineItem[] = ((orderItemsResult.data || []) as any[]).map((item) => {
      const order = orderMap.get(item.order_id);
      return {
        orderItemId: item.id,
        orderId: item.order_id,
        orderNumber: order?.order_number || 0,
        customerName: order?.customer?.full_name || "Onbekend",
        customerId: order?.customer_id || "",
        productId: item.product_id,
        productName: item.product?.name || "Onbekend product",
        quantity: item.quantity,
      };
    });

    // Restore checked state from DB
    const checkedSet = new Set<string>();
    const allOrderItemIds = new Set(lineItems.map(li => li.orderItemId));
    for (const check of (checksResult.data || []) as any[]) {
      if (allOrderItemIds.has(check.order_item_id)) {
        checkedSet.add(check.order_item_id);
      }
    }
    setCheckedItems(checkedSet);

    setItems(lineItems);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleItem = async (orderItemId: string) => {
    const isChecked = checkedItems.has(orderItemId);

    // Optimistic update
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (isChecked) {
        next.delete(orderItemId);
      } else {
        next.add(orderItemId);
      }
      return next;
    });

    if (isChecked) {
      const { error } = await supabase
        .from("production_checks")
        .delete()
        .eq("order_item_id", orderItemId);
      if (error) {
        console.error("Error removing check:", error);
        setCheckedItems((prev) => new Set([...prev, orderItemId]));
      }
    } else {
      const { error } = await supabase
        .from("production_checks")
        .insert({ order_item_id: orderItemId, checked_by: (await supabase.auth.getUser()).data.user?.id || "" });
      if (error) {
        console.error("Error saving check:", error);
        setCheckedItems((prev) => {
          const next = new Set(prev);
          next.delete(orderItemId);
          return next;
        });
      }
    }
  };

  const toggleAllForGroup = async (groupItems: OrderLineItem[]) => {
    const allChecked = groupItems.every((i) => checkedItems.has(i.orderItemId));
    const itemIds = groupItems.map((i) => i.orderItemId);

    // Optimistic update
    setCheckedItems((prev) => {
      const next = new Set(prev);
      for (const id of itemIds) {
        if (allChecked) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });

    if (allChecked) {
      // Uncheck all
      const { error } = await supabase
        .from("production_checks")
        .delete()
        .in("order_item_id", itemIds);
      if (error) {
        console.error("Error removing checks:", error);
        await fetchData();
      }
    } else {
      // Check unchecked items
      const uncheckedIds = itemIds.filter((id) => !checkedItems.has(id));
      const userId = (await supabase.auth.getUser()).data.user?.id || "";
      const rows = uncheckedIds.map((id) => ({ order_item_id: id, checked_by: userId }));
      const { error } = await supabase
        .from("production_checks")
        .upsert(rows, { onConflict: "order_item_id" });
      if (error) {
        console.error("Error saving checks:", error);
        await fetchData();
      }
    }
  };

  const getOrdersForCustomer = (customerId: string) => {
    const customerItems = items.filter((i) => i.customerId === customerId);
    const orderIds = [...new Set(customerItems.map((i) => i.orderId))];
    return orderIds;
  };

  const isOrderFullyChecked = (orderId: string) => {
    const orderItems = items.filter((i) => i.orderId === orderId);
    return orderItems.length > 0 && orderItems.every((i) => checkedItems.has(i.orderItemId));
  };

  const setOrderReady = async (orderId: string) => {
    setUpdatingOrder(orderId);
    const orderItemIds = items.filter((i) => i.orderId === orderId).map((i) => i.orderItemId);

    const { error } = await supabase
      .from("orders")
      .update({ status: "ready" })
      .eq("id", orderId);

    if (error) {
      toast.error("Fout bij het bijwerken van de status");
      console.error(error);
    } else {
      // Clean up production checks for this order
      await supabase
        .from("production_checks")
        .delete()
        .in("order_item_id", orderItemIds);

      toast.success("Bestelling op 'Gereed' gezet!");
      setCheckedItems((prev) => {
        const next = new Set(prev);
        orderItemIds.forEach((id) => next.delete(id));
        return next;
      });
      await fetchData();
    }
    setUpdatingOrder(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="w-6 h-6 mx-auto mb-2 opacity-50" />
        <p>Geen openstaande orderregels</p>
      </div>
    );
  }

  // Group items
  const grouped = new Map<string, { label: string; sortKey: string; items: OrderLineItem[] }>();

  if (groupBy === "customer") {
    for (const item of items) {
      const key = item.orderId; // Group by order within customer
      if (!grouped.has(key)) {
        grouped.set(key, {
          label: `${item.customerName} — #${item.orderNumber}`,
          sortKey: item.customerName.toLowerCase(),
          items: [],
        });
      }
      grouped.get(key)!.items.push(item);
    }
  } else {
    for (const item of items) {
      const key = item.productId;
      if (!grouped.has(key)) {
        grouped.set(key, {
          label: item.productName,
          sortKey: item.productName.toLowerCase(),
          items: [],
        });
      }
      grouped.get(key)!.items.push(item);
    }
  }

  const sortedGroups = Array.from(grouped.entries()).sort((a, b) =>
    a[1].sortKey.localeCompare(b[1].sortKey)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="customer">
              <span className="flex items-center gap-2"><Users className="w-4 h-4" />Per klant</span>
            </SelectItem>
            <SelectItem value="product">
              <span className="flex items-center gap-2"><Package className="w-4 h-4" />Per product</span>
            </SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {checkedItems.size}/{items.length} afgevinkt
        </span>
      </div>

      <div className="space-y-4">
        {sortedGroups.map(([key, group]) => {
          const allChecked = group.items.every((i) => checkedItems.has(i.orderItemId));
          // For customer grouping, key = orderId
          const isCustomerGroup = groupBy === "customer";
          const orderId = isCustomerGroup ? key : null;
          const orderFullyChecked = orderId ? isOrderFullyChecked(orderId) : false;

          return (
            <div key={key} className="rounded-lg border border-border bg-card">
              {/* Group header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleAllForGroup(group.items)}
              >
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={() => toggleAllForGroup(group.items)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className={`text-sm font-medium flex-1 ${allChecked ? "line-through text-muted-foreground" : ""}`}>
                  {group.label}
                </span>
                {isCustomerGroup && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {group.items.reduce((sum, i) => sum + i.quantity, 0)} items
                  </span>
                )}
                {!isCustomerGroup && (
                  <span className="text-sm font-medium tabular-nums">
                    {group.items.reduce((sum, i) => sum + i.quantity, 0)}×
                  </span>
                )}
              </div>

              {/* Items */}
              <div className="border-t border-border/50 divide-y divide-border/30">
                {group.items.map((item) => {
                  const checked = checkedItems.has(item.orderItemId);
                  return (
                    <div
                      key={item.orderItemId}
                      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() => toggleItem(item.orderItemId)}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleItem(item.orderItemId)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className={`text-sm flex-1 min-w-0 truncate ${checked ? "line-through text-muted-foreground" : ""}`}>
                        {isCustomerGroup ? item.productName : `${item.customerName} — #${item.orderNumber}`}
                      </span>
                      <span className={`text-sm tabular-nums shrink-0 ${checked ? "text-muted-foreground" : "font-medium"}`}>
                        {item.quantity}×
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Ready button for fully checked orders */}
              {isCustomerGroup && orderFullyChecked && orderId && (
                <div className="border-t border-border/50 px-4 py-3">
                  <Button
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => setOrderReady(orderId)}
                    disabled={updatingOrder === orderId}
                  >
                    {updatingOrder === orderId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckSquare className="w-4 h-4" />
                    )}
                    Bestelling op 'Gereed' zetten
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProductionChecklist;
