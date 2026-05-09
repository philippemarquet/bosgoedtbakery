import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, Trash2, Send, Download, UserMinus } from "lucide-react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Subscriber {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  source: string | null;
  consent_marketing: boolean;
  created_at: string;
  unsubscribed_at: string | null;
}

const SubscribersTab = () => {
  const { toast } = useToast();
  const [subs, setSubs] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("subscribers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    setSubs(data ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchSubs();
  }, [fetchSubs]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    subs.forEach((s) => s.source && set.add(s.source));
    return Array.from(set).sort();
  }, [subs]);

  const filtered = useMemo(() => {
    return subs.filter((s) => {
      if (statusFilter === "active" && !s.is_active) return false;
      if (statusFilter === "inactive" && s.is_active) return false;
      if (sourceFilter !== "all" && s.source !== sourceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!s.full_name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [subs, statusFilter, sourceFilter, search]);

  const activeCount = subs.filter((s) => s.is_active).length;

  const markUnsubscribed = async (s: Subscriber) => {
    const { error } = await supabase
      .from("subscribers")
      .update({ is_active: false, unsubscribed_at: new Date().toISOString() })
      .eq("id", s.id);
    if (error) return toast({ title: "Fout", description: error.message, variant: "destructive" });
    toast({ title: "Uitgeschreven" });
    fetchSubs();
  };

  const remove = async (s: Subscriber) => {
    if (!confirm(`Verwijder ${s.email}?`)) return;
    const { error } = await supabase.from("subscribers").delete().eq("id", s.id);
    if (error) return toast({ title: "Fout", description: error.message, variant: "destructive" });
    toast({ title: "Verwijderd" });
    fetchSubs();
  };

  const exportCsv = () => {
    const rows = [["naam", "email", "telefoon", "source", "actief", "aangemeld"]];
    filtered.forEach((s) => {
      rows.push([
        s.full_name,
        s.email,
        s.phone ?? "",
        s.source ?? "",
        s.is_active ? "ja" : "nee",
        s.created_at,
      ]);
    });
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl">Subscribers</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {activeCount} actief · {subs.length} totaal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
          <Button onClick={() => toast({ title: "Resend integratie volgt" })}>
            <Send className="h-4 w-4 mr-2" /> Stuur menu update
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek naam of email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-64"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Actief</SelectItem>
            <SelectItem value="inactive">Uitgeschreven</SelectItem>
            <SelectItem value="all">Alle</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Laden…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">Geen subscribers gevonden.</p>
      ) : (
        <div className="border border-border/60 rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-2">Naam</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Telefoon</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Aangemeld</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-border/60">
                  <td className="px-3 py-2">{s.full_name}</td>
                  <td className="px-3 py-2">{s.email}</td>
                  <td className="px-3 py-2">{s.phone ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.source ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {format(parseISO(s.created_at), "d MMM yyyy", { locale: nl })}
                  </td>
                  <td className="px-3 py-2">
                    {s.is_active ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-[hsl(var(--sage))]/15 text-[hsl(var(--sage))]">
                        actief
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                        uitgeschreven
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {s.is_active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Markeer als uitgeschreven"
                          onClick={() => markUnsubscribed(s)}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" title="Verwijderen" onClick={() => remove(s)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SubscribersTab;
