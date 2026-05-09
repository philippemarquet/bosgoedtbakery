## Bosgoedt Bakery — Pop-up website transformatie

Grote opdracht in 7 taken. Ik bouw in de door jou aangegeven volgorde en commit per stap zodat je tussendoor kunt reviewen.

---

### Taak 1 — Klant-account systeem volledig verwijderen

Verwijderen:
- `src/pages/CustomerDashboard.tsx`, `src/pages/reset-password.tsx`
- `src/components/customer/` (CustomerOrderDialog, CustomerOrdersTab, CustomerPlaceOrderTab)
- `src/components/ProfileDialog.tsx` (alleen als enkel klant-gebruik; checken)
- Edge function `set-initial-password`
- Klant-routes (`/klant`, `/reset-password`) uit `App.tsx`
- `password_set` references, `customer` rol-checks, `isCustomer` uit `AuthContext`
- "Wachtwoord vergeten" UI uit `Login.tsx`
- `ProtectedRoute.requireBaker` simplificeren — alle ingelogde users zijn nu bakers

Behouden: baker-login, `profiles` tabel, `discount_percentage`, hele backoffice, edge function `create-auth-user` (nog steeds nodig voor klantbeheer), `OrderDialog` voor interne bestellingen.

Login redirect: na login → altijd `/dashboard`. Niet-bakers worden uitgelogd met melding.

---

### Taak 2 — `/bestellen` (hoofdpagina, mobile-first)

Eén scrollende pagina opgebouwd uit secties:
- **Hero** met logo, tagline, foto-placeholder
- **Event-selectie** (0/1/2+ events afgehandeld zoals beschreven; `?event=<slug>` preselect)
- **Menu** uit `popup_event_products` joined met `products`, kaart-stijl met +/- selector
- **Sticky cart** rechts (desktop) / bottom-sheet (mobiel) → opent inline bestelformulier (modal)
- **Opt-in banner** (`source: 'bestelpagina_banner'`)
- **Over-Bosgoedt CTA** → `/over`

Bestel-flow: profile lookup-of-create (op email) → order met snapshots + `order_source='public_popup'` → order_items → optionele subscribers upsert → inline bevestiging met `order_number`.

Validatie: zod schema (email regex, BE/NL telefoon, min 1 product), 5-minuten dedupe via query op email+event, honeypot field, `// TODO: Resend bevestigingsmail`.

---

### Taak 3 — `/aanmelden` (lichtgewicht)

Korte pagina met naam/email/telefoon/source-select + verplichte opt-in checkbox. Insert in `subscribers`. Duplicate email → vriendelijke "al ingeschreven 🍞". Honeypot. CTA naar `/bestellen` na succes.

---

### Taak 4 — `/over`

Verhalende pagina met hero + secties (Over Nikki / Over zuurdesem / Over de zoete kant) + CTA. Alle teksten in `src/content/about.ts` voor makkelijke aanpassing later.

---

### Taak 5 — Backoffice uitbreidingen

**5.2 Pop-up Events** (eerst, want voorwaarde voor Taak 2 testen):
- `PopupEventsTab` met lijst + "Nieuwe pop-up" dialog (alle velden)
- Detail-view met tabs: Details (bewerkbaar) / Producten (multi-select uit orderable products met price_override, max_quantity, display_order) / Bestellingen (filter op `popup_event_id`)
- Publish toggle, "Bekijk publieke pagina" link
- Statistieken: bestellingen, unieke klanten, omzet, top-3 producten, opt-in rate
- "Verzend menu naar subscribers" knop met `// TODO: Resend`

**5.1 Subscribers**: lijst, filters (is_active, source), zoek, verwijder/markeer-uitgeschreven, CSV-export, teller, "Stuur menu update" placeholder.

**5.3 Bestellingen-overzicht uitbreiding**:
- Filter op `order_source` 
- Source badge per order
- Snapshot velden tonen voor public_popup orders
- Link naar bijbehorend popup event vanuit detail

Beide nieuwe tabs in bestaande `DashboardShell` navigatie.

---

### Taak 6 — Routing & navigatie

```text
/             → redirect: anoniem→/bestellen, baker→/dashboard
/bestellen    public
/aanmelden    public  (niet in nav)
/over         public
/privacy      public placeholder
/dashboard    baker-only (bestaand)
```

Nieuwe `PublicLayout` met minimale header (logo, "Bestellen", "Over") + footer (© / privacy / contact). Backoffice houdt eigen `DashboardShell`.

---

### Taak 7 — Doorlopend

Zod-validatie, geen `any`, loading/error states overal, toasts, mobile-first, types uit Supabase. Na DB-wijzigingen wordt `types.ts` automatisch geregenereerd.

---

### Technische details

- Cart state: lokaal in component met `useState` (niet globaal nodig, single page)
- Profile-lookup query: `.from('profiles').select().is('user_id', null).ilike('email', ...)` — **maar `profiles` heeft geen email kolom**. Oplossing: matchen op naam+telefoon óf altijd nieuw guest-profile aanmaken (snapshots zijn leidend). Ik kies **altijd nieuw guest-profile** — eenvoudiger en snapshots dekken alles. Dedupe gebeurt op order-niveau via 5-min check op snapshot-email.
- Subscribers tabel: geen `update` RLS policy bestaat → "markeer uitgeschreven" werkt via bestaande `unsubscribe_via_token` RPC, of ik voeg een baker-update policy toe (kleine migratie).
- "Bekijk publieke pagina" link gebruikt `popup_events.slug`.

---

### Buiten scope (zoals aangegeven)

Resend mails, Bunq integratie wijzigingen, extra bakers uitnodigen.

---

### Open vragen

1. **Profile-deduplicatie**: akkoord met "altijd nieuw guest-profile" per publieke bestelling? (alternatief: matchen op telefoonnummer)
2. **Subscribers update RLS**: mag ik een kleine migratie doen voor "Bakers can update subscribers" zodat de "markeer als uitgeschreven" knop werkt?
3. **Privacy/contact pagina's**: bare-bones placeholder met alleen titel + "binnenkort" tekst voldoende?

Ik kan starten zodra je groen licht geeft (en de open vragen beantwoordt — anders ga ik met de defaults hierboven).