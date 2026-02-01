
# Automatische Betalingsherkenning via Zapier Webhook

## Overzicht
We bouwen een systeem waarbij Zapier transacties van Bunq doorstuurt naar een Supabase Edge Function. Deze functie matcht de betaling aan een bestelling op basis van het ordernummer in de omschrijving en het bedrag, en zet de status automatisch op "betaald".

## Hoe het werkt

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐     ┌─────────────┐
│   Bunq      │────▶│   Zapier    │────▶│  Edge Function      │────▶│  Database   │
│ Transactie  │     │   Trigger   │     │  process-payment    │     │  orders     │
│             │     │             │     │                     │     │  status →   │
│ €25.50      │     │ POST naar   │     │ Match order_number  │     │  "paid"     │
│ "20260190"  │     │ webhook     │     │ + bedrag check      │     │             │
└─────────────┘     └─────────────┘     └─────────────────────┘     └─────────────┘
```

## Wat er gebouwd wordt

### 1. Edge Function: `process-payment`
Een nieuwe Supabase Edge Function die:
- Webhook requests van Zapier ontvangt
- De betaalomschrijving parseert om het ordernummer te vinden
- Het bedrag vergelijkt met het ordertotaal
- Bij een match: de orderstatus update naar "paid"
- Een beveiligingstoken controleert om te voorkomen dat anderen de webhook kunnen aanroepen

### 2. Beveiliging
- Een geheim webhook token dat je in Zapier configureert
- Dit voorkomt dat willekeurige requests de orderstatus kunnen wijzigen

### 3. Logging tabel (optioneel maar aanbevolen)
Een `payment_logs` tabel om alle ontvangen transacties bij te houden voor debugging en audit

## Zapier Setup (door jou te doen na implementatie)

1. **Trigger**: Bunq - New Transaction
2. **Filter**: Alleen inkomende betalingen
3. **Action**: Webhooks by Zapier - POST naar:
   ```
   https://jchxlfdcwdmuwnrqlyae.supabase.co/functions/v1/process-payment
   ```
4. **Headers**:
   ```
   Authorization: Bearer [WEBHOOK_SECRET]
   Content-Type: application/json
   ```
5. **Body** (JSON):
   ```json
   {
     "amount": "{{amount}}",
     "description": "{{description}}",
     "date": "{{date}}",
     "counterparty_name": "{{counterparty_name}}"
   }
   ```

## Technische Details

### Edge Function Logica
```text
1. Ontvang POST request van Zapier
2. Valideer Authorization header (webhook secret)
3. Parse JSON body: amount, description
4. Zoek ordernummer in description (regex: /\b(202\d{5})\b/)
5. Query orders tabel: WHERE order_number = X AND status = 'ready'
6. Vergelijk bedragen (met kleine marge voor afrondingen)
7. Als match: UPDATE orders SET status = 'paid'
8. Log de transactie in payment_logs
9. Return success/failure response
```

### Database Wijzigingen
Nieuwe tabel `payment_logs`:
- `id` (uuid, primary key)
- `order_id` (uuid, nullable - alleen gevuld bij succesvolle match)
- `amount` (numeric)
- `description` (text)
- `counterparty_name` (text)
- `status` (text: 'matched', 'unmatched', 'amount_mismatch')
- `created_at` (timestamp)

### Secret toe te voegen
- `PAYMENT_WEBHOOK_SECRET`: Een willekeurige string die je ook in Zapier configureert

## Voordelen van deze aanpak
- Geen directe Bunq API integratie nodig (complexe OAuth flow vermeden)
- Hergebruik van je bestaande Zapier setup
- Realtime updates zodra betaling binnenkomt
- Audit trail van alle transacties
- Veilig door webhook secret
