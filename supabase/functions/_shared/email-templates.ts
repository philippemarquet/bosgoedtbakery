// DB-backed templates. Loads + renders from public.email_templates.
// No code-side fallbacks: if a template is missing or inactive, we throw.

import { getServiceClient } from "./email-client.ts";

const SITE = "https://bakery.bosgoedt.be";

export interface EmailTemplate {
  template_key: string;
  name: string;
  subject: string;
  html_body: string;
  text_body: string;
  item_html_template: string | null;
  item_text_template: string | null;
  available_variables: Array<{ key: string; description?: string; example?: string }> | null;
  item_variables: Array<{ key: string; description?: string; example?: string }> | null;
  is_active: boolean;
}

export async function loadTemplate(templateKey: string): Promise<EmailTemplate> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("template_key", templateKey)
    .maybeSingle();
  if (error) throw new Error(`Template load error (${templateKey}): ${error.message}`);
  if (!data) throw new Error(`Template '${templateKey}' niet gevonden`);
  if (!data.is_active) throw new Error(`Template '${templateKey}' is inactief`);
  return data as EmailTemplate;
}

export function renderString(tpl: string, vars: Record<string, string | number | null | undefined>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const v = vars[key];
    if (v === undefined || v === null) return "";
    return String(v);
  });
}

export function renderItems(
  itemHtmlTpl: string | null,
  itemTextTpl: string | null,
  items: Array<Record<string, string | number | null | undefined>>,
): { items_html: string; items_text: string } {
  if (!itemHtmlTpl && !itemTextTpl) return { items_html: "", items_text: "" };
  const items_html = (itemHtmlTpl ?? "")
    ? items.map((it) => renderString(itemHtmlTpl!, it)).join("\n")
    : "";
  const items_text = (itemTextTpl ?? "")
    ? items.map((it) => renderString(itemTextTpl!, it)).join("\n")
    : "";
  return { items_html, items_text };
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export async function renderEmail(
  templateKey: string,
  vars: Record<string, string | number | null | undefined>,
  items?: Array<Record<string, string | number | null | undefined>>,
): Promise<RenderedEmail> {
  const tpl = await loadTemplate(templateKey);
  const { items_html, items_text } = renderItems(tpl.item_html_template, tpl.item_text_template, items ?? []);
  const allVars = { ...vars, items_html, items_text };
  return {
    subject: renderString(tpl.subject, allVars),
    html: renderString(tpl.html_body, allVars),
    text: renderString(tpl.text_body, allVars),
  };
}

// ---------- Helpers used by Edge Functions to pre-format values ----------

export const eur = (n: number) =>
  new Intl.NumberFormat("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n));

export const dateLong = (iso: string) => {
  const d = iso.length === 10 ? new Date(iso + "T00:00:00") : new Date(iso);
  return new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long" }).format(d);
};

export const dateTimeLong = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export const time = (t: string) => (t || "").slice(0, 5);

export const unsubscribeUrl = (token: string | null | undefined) =>
  token ? `${SITE}/unsubscribe?token=${token}` : "";

export const orderUrlForEvent = (slug: string | null | undefined) =>
  slug ? `${SITE}/bestellen?event=${slug}` : `${SITE}/bestellen`;

export const SITE_URL = SITE;
