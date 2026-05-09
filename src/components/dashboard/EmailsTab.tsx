import { useEffect, useState, useCallback, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { AlertTriangle, Send, Eye, Save } from "lucide-react";

interface VarDef { key: string; description?: string; example?: string }

interface Template {
  id: string;
  template_key: string;
  name: string;
  description: string | null;
  subject: string;
  html_body: string;
  text_body: string;
  item_html_template: string | null;
  item_text_template: string | null;
  item_variables: VarDef[] | null;
  available_variables: VarDef[] | null;
  is_active: boolean;
  updated_at: string;
}

interface EmailLog {
  id: string;
  email_type: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  status: string;
  error_message: string | null;
  resend_id: string | null;
  related_order_id: string | null;
  related_subscriber_id: string | null;
  related_popup_event_id: string | null;
  metadata: any;
  sent_at: string | null;
  created_at: string;
}

const renderPreview = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => vars[k] ?? "");

const renderItems = (itemTpl: string | null, items: Record<string, string>[]) => {
  if (!itemTpl) return "";
  return items.map((it) => renderPreview(itemTpl, it)).join("\n");
};

const buildPreview = (t: Template) => {
  const vars: Record<string, string> = {};
  (t.available_variables ?? []).forEach((v) => { vars[v.key] = v.example ?? `{{${v.key}}}`; });
  const items: Record<string, string>[] = [];
  if (t.item_html_template || t.item_text_template) {
    for (let i = 0; i < 3; i++) {
      const it: Record<string, string> = {};
      (t.item_variables ?? []).forEach((v) => { it[v.key] = v.example ?? `{{${v.key}}}`; });
      items.push(it);
    }
  }
  vars.items_html = renderItems(t.item_html_template, items);
  vars.items_text = renderItems(t.item_text_template, items);
  return {
    subject: renderPreview(t.subject, vars),
    html: renderPreview(t.html_body, vars),
    text: renderPreview(t.text_body, vars),
  };
};

const EmailsTab = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const subTab = searchParams.get("emailtab") ?? "templates";
  const setSubTab = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("emailtab", v);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl">E-mails</h2>
        <p className="text-sm text-muted-foreground mt-1">Beheer mail-templates en bekijk verzonden mails.</p>
      </div>
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="templates" className="mt-4"><TemplatesPane /></TabsContent>
        <TabsContent value="logs" className="mt-4"><LogsPane /></TabsContent>
      </Tabs>
    </div>
  );
};

// =================== TEMPLATES ===================

const TemplatesPane = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .order("template_key");
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    setTemplates((data as any) ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  if (loading) return <p className="text-muted-foreground">Laden…</p>;

  return (
    <>
      <div className="border border-border/60 rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-3 py-2">Naam</th>
              <th className="px-3 py-2">Onderwerp</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Laatst aangepast</th>
              <th className="px-3 py-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-t border-border/60">
                <td className="px-3 py-2">
                  <div className="font-medium">{t.name}</div>
                  {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                  {t.template_key === "baker_alert" && (
                    <Badge variant="outline" className="mt-1 text-amber-700 border-amber-300">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Wijzig alleen indien nodig
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{t.subject}</td>
                <td className="px-3 py-2">
                  {t.is_active
                    ? <span className="text-xs px-2 py-1 rounded-full bg-[hsl(var(--sage))]/15 text-[hsl(var(--sage))]">actief</span>
                    : <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">inactief</span>}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {format(parseISO(t.updated_at), "d MMM HH:mm", { locale: nl })}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => setEditing(t)}>Bewerken</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <TemplateEditor
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchTemplates(); }}
        />
      )}
    </>
  );
};

const VariablePanel = ({ vars, onCopy }: { vars: VarDef[]; onCopy: (k: string) => void }) => (
  <div className="space-y-2">
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Variabelen</p>
    <div className="flex flex-wrap gap-1.5">
      {vars.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => onCopy(v.key)}
          title={`${v.description ?? ""}${v.example ? ` (bv. ${v.example})` : ""}`}
          className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/70 font-mono"
        >
          {`{{${v.key}}}`}
        </button>
      ))}
    </div>
  </div>
);

const TemplateEditor = ({
  template, onClose, onSaved,
}: { template: Template; onClose: () => void; onSaved: () => void }) => {
  const { toast } = useToast();
  const [t, setT] = useState<Template>(template);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasItems = template.item_html_template !== null;

  const copy = (key: string) => {
    navigator.clipboard.writeText(`{{${key}}}`);
    toast({ title: `Gekopieerd: {{${key}}}` });
  };

  const save = async () => {
    if (!t.subject.trim() || !t.html_body.trim() || !t.text_body.trim()) {
      toast({ title: "Onderwerp en beide bodies zijn verplicht", variant: "destructive" });
      return;
    }
    if (hasItems && (!t.item_html_template?.trim() || !t.item_text_template?.trim())) {
      toast({ title: "Item-templates zijn verplicht voor dit type", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("email_templates")
      .update({
        subject: t.subject,
        html_body: t.html_body,
        text_body: t.text_body,
        item_html_template: t.item_html_template,
        item_text_template: t.item_text_template,
        is_active: t.is_active,
        updated_by: userData.user?.id,
      })
      .eq("id", t.id);
    setSaving(false);
    if (error) return toast({ title: "Fout", description: error.message, variant: "destructive" });
    toast({ title: "Template opgeslagen" });
    onSaved();
  };

  const sendTest = async () => {
    const { data, error } = await supabase.functions.invoke("send-test-email", {
      body: {
        template_key: t.template_key,
        override: {
          subject: t.subject,
          html_body: t.html_body,
          text_body: t.text_body,
          item_html_template: t.item_html_template,
          item_text_template: t.item_text_template,
        },
      },
    });
    if (error || (data as any)?.error) {
      toast({ title: "Test verzenden mislukt", description: (data as any)?.error ?? error?.message, variant: "destructive" });
    } else {
      toast({ title: "Test verzonden naar je eigen email" });
    }
  };

  const preview = useMemo(() => buildPreview(t), [t]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.name}</DialogTitle>
          {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Onderwerp</Label>
              <Input value={t.subject} onChange={(e) => setT({ ...t, subject: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>HTML versie</Label>
              <Textarea
                value={t.html_body}
                onChange={(e) => setT({ ...t, html_body: e.target.value })}
                className="font-mono text-xs min-h-[260px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Plain text versie</Label>
              <Textarea
                value={t.text_body}
                onChange={(e) => setT({ ...t, text_body: e.target.value })}
                className="font-mono text-xs min-h-[160px]"
              />
            </div>

            {hasItems && (
              <div className="border-t border-border/60 pt-4 space-y-4">
                <div>
                  <p className="font-medium">Item template</p>
                  <p className="text-xs text-muted-foreground">
                    Pas hier aan hoe één regel/item eruitziet. In de hoofdmail gebruik je{" "}
                    <code className="bg-muted px-1 rounded">{`{{items_html}}`}</code> of{" "}
                    <code className="bg-muted px-1 rounded">{`{{items_text}}`}</code>.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Item HTML</Label>
                  <Textarea
                    value={t.item_html_template ?? ""}
                    onChange={(e) => setT({ ...t, item_html_template: e.target.value })}
                    className="font-mono text-xs min-h-[100px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Item plain text</Label>
                  <Textarea
                    value={t.item_text_template ?? ""}
                    onChange={(e) => setT({ ...t, item_text_template: e.target.value })}
                    className="font-mono text-xs min-h-[80px]"
                  />
                </div>
              </div>
            )}

            <label className="flex items-center gap-3 pt-2">
              <Switch checked={t.is_active} onCheckedChange={(c) => setT({ ...t, is_active: c })} />
              <span className="text-sm">Actief</span>
            </label>
          </div>

          <aside className="space-y-5">
            <VariablePanel vars={t.available_variables ?? []} onCopy={copy} />
            {hasItems && t.item_variables && (
              <VariablePanel vars={t.item_variables} onCopy={copy} />
            )}
          </aside>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>Annuleren</Button>
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4 mr-1" /> Preview
          </Button>
          <Button variant="outline" onClick={sendTest}>
            <Send className="h-4 w-4 mr-1" /> Verzend test naar mij
          </Button>
          <Button onClick={save} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? "Opslaan…" : "Opslaan"}
          </Button>
        </DialogFooter>

        {previewOpen && (
          <Dialog open onOpenChange={() => setPreviewOpen(false)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Preview: {preview.subject}</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="html">
                <TabsList>
                  <TabsTrigger value="html">HTML</TabsTrigger>
                  <TabsTrigger value="text">Text</TabsTrigger>
                </TabsList>
                <TabsContent value="html" className="mt-3">
                  <div className="border border-border/60 rounded p-2 bg-white">
                    <iframe
                      title="preview"
                      srcDoc={preview.html}
                      className="w-full h-[60vh] bg-white"
                    />
                  </div>
                </TabsContent>
                <TabsContent value="text" className="mt-3">
                  <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded">{preview.text}</pre>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
};

// =================== LOGS ===================

const LogsPane = () => {
  const [searchParams] = useSearchParams();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.get("logtype") ?? "all");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("logstatus") ?? "all");
  const [periodFilter, setPeriodFilter] = useState<string>("7d");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<EmailLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("email_logs").select("*").order("created_at", { ascending: false }).limit(500);
    if (typeFilter !== "all") q = q.eq("email_type", typeFilter);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (periodFilter !== "all") {
      const days = periodFilter === "today" ? 0 : periodFilter === "7d" ? 7 : 30;
      const since = new Date();
      if (days === 0) since.setUTCHours(0, 0, 0, 0);
      else since.setDate(since.getDate() - days);
      q = q.gte("created_at", since.toISOString());
    }
    const { data } = await q;
    setLogs((data as any) ?? []);
    setLoading(false);
  }, [typeFilter, statusFilter, periodFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter((l) =>
      l.recipient_email.toLowerCase().includes(q) ||
      (l.subject ?? "").toLowerCase().includes(q),
    );
  }, [logs, search]);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return {
      today: logs.filter((l) => l.status === "sent" && new Date(l.created_at) >= today).length,
      week: logs.filter((l) => l.status === "sent" && new Date(l.created_at) >= weekAgo).length,
      failed: logs.filter((l) => l.status === "failed").length,
      alertsToday: logs.filter((l) => l.email_type === "baker_alert" && new Date(l.created_at) >= today).length,
    };
  }, [logs]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Verzonden vandaag" value={stats.today} />
        <Stat label="Verzonden 7 dagen" value={stats.week} />
        <Stat label="Gefaald" value={stats.failed} onClick={() => setStatusFilter("failed")} />
        <Stat label="Baker alerts vandaag" value={stats.alertsToday} onClick={() => setTypeFilter("baker_alert")} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Zoek op email of onderwerp…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle types</SelectItem>
            <SelectItem value="welcome">welcome</SelectItem>
            <SelectItem value="order_confirmation">order_confirmation</SelectItem>
            <SelectItem value="popup_reminder">popup_reminder</SelectItem>
            <SelectItem value="menu_broadcast">menu_broadcast</SelectItem>
            <SelectItem value="baker_alert">baker_alert</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="pending">pending</SelectItem>
            <SelectItem value="sent">sent</SelectItem>
            <SelectItem value="failed">failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Vandaag</SelectItem>
            <SelectItem value="7d">7 dagen</SelectItem>
            <SelectItem value="30d">30 dagen</SelectItem>
            <SelectItem value="all">Alles</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? <p className="text-muted-foreground">Laden…</p> : filtered.length === 0 ? (
        <p className="text-muted-foreground">Geen logs gevonden.</p>
      ) : (
        <div className="border border-border/60 rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Naar</th>
                <th className="px-3 py-2">Onderwerp</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Tijd</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-t border-border/60 cursor-pointer hover:bg-muted/30" onClick={() => setSelected(l)}>
                  <td className="px-3 py-2"><Badge variant="outline">{l.email_type}</Badge></td>
                  <td className="px-3 py-2">{l.recipient_email}</td>
                  <td className="px-3 py-2 truncate max-w-xs">{l.subject}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      l.status === "sent" ? "bg-[hsl(var(--sage))]/15 text-[hsl(var(--sage))]"
                      : l.status === "failed" ? "bg-red-100 text-red-700"
                      : "bg-muted text-muted-foreground"
                    }`}>{l.status}</span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {format(parseISO(l.created_at), "d MMM HH:mm", { locale: nl })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{selected.subject}</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div><strong>Type:</strong> {selected.email_type}</div>
              <div><strong>Naar:</strong> {selected.recipient_email} {selected.recipient_name && `(${selected.recipient_name})`}</div>
              <div><strong>Status:</strong> {selected.status}</div>
              <div><strong>Aangemaakt:</strong> {format(parseISO(selected.created_at), "d MMM yyyy HH:mm:ss", { locale: nl })}</div>
              {selected.sent_at && <div><strong>Verzonden:</strong> {format(parseISO(selected.sent_at), "d MMM yyyy HH:mm:ss", { locale: nl })}</div>}
              {selected.resend_id && <div><strong>Resend ID:</strong> <code className="text-xs">{selected.resend_id}</code></div>}
              {selected.error_message && (
                <div className="bg-red-50 border border-red-200 rounded p-2 mt-2">
                  <div className="text-xs font-semibold text-red-700">Error</div>
                  <pre className="text-xs whitespace-pre-wrap text-red-700">{selected.error_message}</pre>
                </div>
              )}
              {selected.metadata && (
                <div>
                  <div className="text-xs font-semibold mt-2">Metadata</div>
                  <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap">{JSON.stringify(selected.metadata, null, 2)}</pre>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

const Stat = ({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) => (
  <button
    onClick={onClick}
    disabled={!onClick}
    className="text-left rounded-[var(--radius)] border border-border/60 bg-card p-4 disabled:cursor-default enabled:hover:border-foreground/40 transition-colors"
  >
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="font-serif text-2xl mt-1 tabular-nums">{value}</p>
  </button>
);

export default EmailsTab;
