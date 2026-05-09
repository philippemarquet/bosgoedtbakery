
INSERT INTO public.email_templates (template_key, name, description, subject, html_body, text_body, item_html_template, item_text_template, item_variables, available_variables, is_active)
VALUES
(
  'welcome',
  'Welkom op de mailinglist',
  'Verstuurd wanneer iemand zich aanmeldt via /aanmelden of opt-in op /bestellen.',
  'Welkom bij Bosgoedt Bakery 🍞',
$HTML$<!doctype html><html lang="nl"><body style="margin:0;padding:0;background:#FBF7F1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2A2622;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F1;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #ECE4D7;">
<tr><td style="padding:28px 28px 4px;"><p style="margin:0;font-family:Georgia,serif;font-size:22px;color:#8B5E3C;">Bosgoedt Bakery</p></td></tr>
<tr><td style="padding:8px 28px 32px;font-size:15px;line-height:1.65;">
<p style="margin:0 0 14px;">Hi {{full_name}},</p>
<p style="margin:0 0 14px;">Leuk dat je je hebt aangemeld! Je staat nu op onze lijst en hoort als eerste wanneer we een nieuwe pop-up plannen — meestal twee weken van tevoren stuur ik het menu door, met een directe link om te bestellen.</p>
<p style="margin:0 0 14px;">Wat we maken: zuurdesem brood met lange fermentatie en zoete lekkernijen die ik in onze keuken in Oud-Turnhout bak. Soms een seizoens-special, soms vaste favorieten.</p>
<p style="margin:18px 0 4px;">Tot bij de volgende pop-up!</p>
<p style="margin:0;color:#6B645E;">Nikki<br/>Bosgoedt Bakery</p>
</td></tr></table>
<p style="margin:24px 0 0;font-size:12px;color:#6B645E;text-align:center;">Maximaal 1 mail per pop-up event, je kunt je altijd uitschrijven.<br/><a href="{{unsubscribe_url}}" style="color:#6B645E;">Uitschrijven</a></p>
</td></tr></table></body></html>$HTML$,
$TEXT$Hi {{full_name}},

Leuk dat je je hebt aangemeld! Je staat nu op onze lijst en hoort als eerste wanneer we een nieuwe pop-up plannen — meestal twee weken van tevoren stuur ik het menu door, met een directe link om te bestellen.

Wat we maken: zuurdesem brood met lange fermentatie en zoete lekkernijen die ik in onze keuken in Oud-Turnhout bak.

Tot bij de volgende pop-up!

Nikki
Bosgoedt Bakery

—
Uitschrijven: {{unsubscribe_url}}$TEXT$,
  NULL, NULL, NULL,
  '[
    {"key":"full_name","description":"Volledige naam van de subscriber","example":"Sanne Janssen"},
    {"key":"unsubscribe_url","description":"Volledige uitschrijf-link met token","example":"https://bakery.bosgoedt.be/unsubscribe?token=…"}
  ]'::jsonb,
  true
),
(
  'order_confirmation',
  'Bestelbevestiging',
  'Direct na publieke pop-up bestelling. Transactioneel, geen uitschrijflink.',
  'Je bestelling bij Bosgoedt Bakery — bestelnummer #{{order_number}}',
$HTML$<!doctype html><html lang="nl"><body style="margin:0;padding:0;background:#FBF7F1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2A2622;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F1;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #ECE4D7;">
<tr><td style="padding:28px 28px 4px;"><p style="margin:0;font-family:Georgia,serif;font-size:22px;color:#8B5E3C;">Bosgoedt Bakery</p></td></tr>
<tr><td style="padding:8px 28px 32px;font-size:15px;line-height:1.65;">
<p style="margin:0 0 14px;">Hi {{full_name}},</p>
<p style="margin:0 0 18px;">Bedankt voor je bestelling! Hieronder een overzicht zodat je het bij de hand hebt.</p>
<p style="margin:18px 0 6px;font-weight:600;">Wat je hebt besteld</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ECE4D7;border-bottom:1px solid #ECE4D7;margin:0 0 8px;">
{{items_html}}
</table>
<p style="margin:8px 0 18px;text-align:right;font-weight:600;">Totaal: €{{total}}</p>
<p style="margin:18px 0 6px;font-weight:600;">Wanneer en waar</p>
<p style="margin:0 0 4px;">{{event_date_long}}</p>
<p style="margin:0 0 4px;">Ophalen tussen {{pickup_start}} en {{pickup_end}}</p>
<p style="margin:0 0 2px;">{{location_name}}</p>
<p style="margin:0 0 0;color:#6B645E;">{{location_address}}</p>
<p style="margin:22px 0 14px;">Betalen kan ter plekke met overboeking of cash.</p>
<p style="margin:0 0 18px;">Een dag van tevoren stuur ik je nog een herinnering met deze info.</p>
<p style="margin:18px 0 4px;">Tot dan!</p>
<p style="margin:0;color:#6B645E;">Nikki<br/>Bosgoedt Bakery</p>
<p style="margin:24px 0 0;font-size:13px;color:#6B645E;">PS — vragen of allergische zorgen? Reply gewoon op deze mail.</p>
</td></tr></table></td></tr></table></body></html>$HTML$,
$TEXT$Hi {{full_name}},

Bedankt voor je bestelling! Hieronder een overzicht.

Wat je hebt besteld:
{{items_text}}

Totaal: €{{total}}

Wanneer en waar:
{{event_date_long}}
Ophalen tussen {{pickup_start}} en {{pickup_end}}
{{location_name}}
{{location_address}}

Betalen kan ter plekke met overboeking of cash.

Tot dan!

Nikki
Bosgoedt Bakery$TEXT$,
$ITEM_HTML$<tr><td style="padding:6px 0;font-size:14px;">{{quantity}} × {{product_name}}</td><td style="padding:6px 0;font-size:14px;text-align:right;">€{{line_total}}</td></tr>$ITEM_HTML$,
$ITEM_TEXT$  {{quantity}} × {{product_name}}  €{{line_total}}$ITEM_TEXT$,
  '[
    {"key":"quantity","description":"Aantal","example":"2"},
    {"key":"product_name","description":"Productnaam","example":"Zuurdesem boerenbrood"},
    {"key":"unit_price","description":"Prijs per stuk","example":"6,50"},
    {"key":"line_total","description":"Regeltotaal","example":"13,00"}
  ]'::jsonb,
  '[
    {"key":"full_name","description":"Naam klant","example":"Sanne Janssen"},
    {"key":"order_number","description":"Bestelnummer","example":"1042"},
    {"key":"items_html","description":"Lijst van bestelde producten — pas hierboven het Item template aan voor de styling van één regel.","example":"<tr>…</tr>"},
    {"key":"items_text","description":"Plain-text lijst van producten","example":"  2 × Brood  €13,00"},
    {"key":"total","description":"Totaalbedrag (zonder €)","example":"24,50"},
    {"key":"event_date_long","description":"Pop-up datum in Nederlands","example":"zaterdag 11 juli"},
    {"key":"pickup_start","description":"Starttijd ophalen","example":"11:00"},
    {"key":"pickup_end","description":"Eindtijd ophalen","example":"15:00"},
    {"key":"location_name","description":"Naam van locatie","example":"Bakkerij Bosgoedt"},
    {"key":"location_address","description":"Adres locatie","example":"Steenweg 12, Oud-Turnhout"}
  ]'::jsonb,
  true
),
(
  'popup_reminder',
  'Pop-up herinnering',
  'Eén dag voor de pop-up. Transactioneel, GEEN uitschrijflink.',
  'Morgen is het zover — je Bosgoedt Bakery bestelling',
$HTML$<!doctype html><html lang="nl"><body style="margin:0;padding:0;background:#FBF7F1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2A2622;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F1;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #ECE4D7;">
<tr><td style="padding:28px 28px 4px;"><p style="margin:0;font-family:Georgia,serif;font-size:22px;color:#8B5E3C;">Bosgoedt Bakery</p></td></tr>
<tr><td style="padding:8px 28px 32px;font-size:15px;line-height:1.65;">
<p style="margin:0 0 14px;">Hi {{full_name}},</p>
<p style="margin:0 0 18px;">Morgen mag je je bestelling komen ophalen! Hier alles op een rijtje:</p>
<p style="margin:18px 0 6px;font-weight:600;">Wanneer</p>
<p style="margin:0 0 4px;">{{event_date_long}}</p>
<p style="margin:0 0 14px;">Tussen {{pickup_start}} en {{pickup_end}}</p>
<p style="margin:14px 0 6px;font-weight:600;">Waar</p>
<p style="margin:0 0 2px;">{{location_name}}</p>
<p style="margin:0 0 14px;color:#6B645E;">{{location_address}}</p>
<p style="margin:14px 0 6px;font-weight:600;">Wat je hebt besteld</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ECE4D7;border-bottom:1px solid #ECE4D7;margin:0 0 14px;">
{{items_html}}
</table>
<p style="margin:14px 0 22px;">Totaal te betalen: <strong>€{{total}}</strong><br/>Betalen kan met overboeking of cash.</p>
<p style="margin:18px 0 4px;">Tot morgen!</p>
<p style="margin:0;color:#6B645E;">Nikki<br/>Bosgoedt Bakery</p>
<p style="margin:24px 0 0;font-size:13px;color:#6B645E;">PS — niet kunnen komen? Stuur me een berichtje, dan regel ik wat anders.</p>
</td></tr></table></td></tr></table></body></html>$HTML$,
$TEXT$Hi {{full_name}},

Morgen mag je je bestelling komen ophalen!

Wanneer:
{{event_date_long}}
Tussen {{pickup_start}} en {{pickup_end}}

Waar:
{{location_name}}
{{location_address}}

Wat je hebt besteld:
{{items_text}}

Totaal te betalen: €{{total}}
Betalen kan met overboeking of cash.

Tot morgen!

Nikki
Bosgoedt Bakery$TEXT$,
$ITEM_HTML$<tr><td style="padding:5px 0;font-size:14px;">{{quantity}} × {{product_name}}</td></tr>$ITEM_HTML$,
$ITEM_TEXT$  {{quantity}} × {{product_name}}$ITEM_TEXT$,
  '[
    {"key":"quantity","description":"Aantal","example":"2"},
    {"key":"product_name","description":"Productnaam","example":"Zuurdesem boerenbrood"},
    {"key":"unit_price","description":"Prijs per stuk","example":"6,50"},
    {"key":"line_total","description":"Regeltotaal","example":"13,00"}
  ]'::jsonb,
  '[
    {"key":"full_name","description":"Naam klant","example":"Sanne Janssen"},
    {"key":"items_html","description":"Lijst van bestelde producten — pas item-template aan voor styling.","example":"<tr>…</tr>"},
    {"key":"items_text","description":"Plain-text lijst","example":"  2 × Brood"},
    {"key":"total","description":"Totaalbedrag zonder €","example":"24,50"},
    {"key":"event_date_long","description":"Datum NL","example":"zaterdag 11 juli"},
    {"key":"pickup_start","description":"Starttijd","example":"11:00"},
    {"key":"pickup_end","description":"Eindtijd","example":"15:00"},
    {"key":"location_name","description":"Locatie naam","example":"Bakkerij Bosgoedt"},
    {"key":"location_address","description":"Adres","example":"Steenweg 12, Oud-Turnhout"}
  ]'::jsonb,
  true
),
(
  'menu_broadcast',
  'Menu broadcast',
  'Handmatig vanuit backoffice naar alle actieve subscribers.',
  'Het menu voor onze pop-up op {{event_date_long}}',
$HTML$<!doctype html><html lang="nl"><body style="margin:0;padding:0;background:#FBF7F1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2A2622;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F1;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #ECE4D7;">
<tr><td style="padding:28px 28px 4px;"><p style="margin:0;font-family:Georgia,serif;font-size:22px;color:#8B5E3C;">Bosgoedt Bakery</p></td></tr>
<tr><td style="padding:8px 28px 32px;font-size:15px;line-height:1.65;">
<p style="margin:0 0 14px;">Hi {{full_name}},</p>
<p style="margin:0 0 14px;">{{intro}}</p>
<p style="margin:18px 0 6px;font-weight:600;">Wat staat er op het menu</p>
<div style="border-bottom:1px solid #ECE4D7;margin:0 0 18px;">{{items_html}}</div>
<p style="margin:14px 0 6px;font-weight:600;">Wanneer</p>
<p style="margin:0 0 4px;">{{event_date_long}}</p>
<p style="margin:0 0 14px;">Ophalen tussen {{pickup_start}} en {{pickup_end}}</p>
<p style="margin:14px 0 6px;font-weight:600;">Waar</p>
<p style="margin:0 0 2px;">{{location_name}}</p>
<p style="margin:0 0 18px;color:#6B645E;">{{location_address}}</p>
<p style="margin:14px 0 18px;">Bestellen kan tot {{ordering_closes_long}}.</p>
<p style="margin:0 0 24px;"><a href="{{order_url}}" style="display:inline-block;background:#8B5E3C;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;">Bestel hier</a></p>
<p style="margin:18px 0 4px;">Tot dan!</p>
<p style="margin:0;color:#6B645E;">Nikki<br/>Bosgoedt Bakery</p>
</td></tr></table>
<p style="margin:24px 0 0;font-size:12px;color:#6B645E;text-align:center;"><a href="{{unsubscribe_url}}" style="color:#6B645E;">Uitschrijven</a></p>
</td></tr></table></body></html>$HTML$,
$TEXT$Hi {{full_name}},

{{intro}}

Wat staat er op het menu:
{{items_text}}

Wanneer:
{{event_date_long}}
Ophalen tussen {{pickup_start}} en {{pickup_end}}

Waar:
{{location_name}}
{{location_address}}

Bestellen kan tot {{ordering_closes_long}}.
Bestel hier: {{order_url}}

Tot dan!

Nikki
Bosgoedt Bakery

—
Uitschrijven: {{unsubscribe_url}}$TEXT$,
$ITEM_HTML$<div style="margin-bottom:16px;padding:12px 0;border-top:1px solid #ECE4D7;"><strong>{{product_name}}</strong> — €{{price}}<br/><span style="color:#666;font-size:14px;">{{description}}</span></div>$ITEM_HTML$,
$ITEM_TEXT${{product_name}} — €{{price}}
{{description}}
$ITEM_TEXT$,
  '[
    {"key":"product_name","description":"Productnaam","example":"Zuurdesem boerenbrood"},
    {"key":"price","description":"Prijs (zonder €)","example":"6,50"},
    {"key":"description","description":"Productbeschrijving","example":"Lange fermentatie, knapperige korst."}
  ]'::jsonb,
  '[
    {"key":"full_name","description":"Naam subscriber","example":"Sanne Janssen"},
    {"key":"intro","description":"Intro tekst (custom of default)","example":"Het is bijna zover!"},
    {"key":"items_html","description":"Lijst van producten — pas item-template aan voor styling.","example":"<div>…</div>"},
    {"key":"items_text","description":"Plain-text lijst","example":"Brood — €6,50"},
    {"key":"event_date_long","description":"Datum NL","example":"zaterdag 11 juli"},
    {"key":"pickup_start","description":"Starttijd","example":"11:00"},
    {"key":"pickup_end","description":"Eindtijd","example":"15:00"},
    {"key":"location_name","description":"Locatie naam","example":"Bakkerij Bosgoedt"},
    {"key":"location_address","description":"Adres","example":"Steenweg 12"},
    {"key":"ordering_closes_long","description":"Sluitingsmoment NL","example":"donderdag 9 juli 18:00"},
    {"key":"order_url","description":"Bestel-link","example":"https://bakery.bosgoedt.be/bestellen?event=…"},
    {"key":"unsubscribe_url","description":"Uitschrijf-link","example":"https://bakery.bosgoedt.be/unsubscribe?token=…"}
  ]'::jsonb,
  true
),
(
  'baker_alert',
  'Baker alert',
  'Wordt naar bakers gestuurd wanneer een mail-flow faalt. Wijzig alleen indien nodig.',
  '⚠️ Mail-flow gefaald: {{email_type}}',
$HTML$<!doctype html><html lang="nl"><body style="margin:0;padding:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2A2622;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border:1px solid #E5C7C7;border-radius:6px;background:#FFF8F8;">
<tr><td style="padding:20px 24px;font-size:14px;line-height:1.6;">
<p style="margin:0 0 12px;font-weight:600;color:#A23A3A;">⚠️ Mail-flow gefaald</p>
<p style="margin:0 0 6px;"><strong>Type:</strong> {{email_type}}</p>
<p style="margin:0 0 6px;"><strong>Wanneer:</strong> {{failed_at}}</p>
<p style="margin:0 0 6px;"><strong>Naar:</strong> {{recipient_email}}</p>
<p style="margin:0 0 6px;"><strong>Aantal failures vandaag (dit type):</strong> {{failures_today}}</p>
<p style="margin:12px 0 6px;"><strong>Error:</strong></p>
<pre style="background:#fff;border:1px solid #ECC;padding:10px;border-radius:4px;white-space:pre-wrap;font-size:12px;color:#722;">{{error_message}}</pre>
<p style="margin:14px 0 0;color:#6B645E;font-size:13px;">Geen actie van mij nodig om dit te resolven — debug via de logs en stuur eventueel handmatig opnieuw.</p>
<p style="margin:14px 0 0;"><a href="{{logs_url}}" style="color:#8B5E3C;">Open email logs →</a></p>
</td></tr></table></td></tr></table></body></html>$HTML$,
$TEXT$⚠️ Mail-flow gefaald

Type: {{email_type}}
Wanneer: {{failed_at}}
Naar: {{recipient_email}}
Failures vandaag (dit type): {{failures_today}}

Error:
{{error_message}}

Geen actie van mij nodig om dit te resolven — debug via de logs en stuur eventueel handmatig opnieuw.

Logs: {{logs_url}}$TEXT$,
  NULL, NULL, NULL,
  '[
    {"key":"email_type","description":"Type van de gefaalde mail","example":"order_confirmation"},
    {"key":"failed_at","description":"Tijdstip falen","example":"9 mei 2026 14:32"},
    {"key":"recipient_email","description":"Email van de oorspronkelijke ontvanger","example":"klant@example.be"},
    {"key":"failures_today","description":"Aantal failures vandaag van dit type","example":"3"},
    {"key":"error_message","description":"Foutmelding","example":"Resend: invalid_to_address"},
    {"key":"logs_url","description":"Link naar logs in backoffice","example":"https://bakery.bosgoedt.be/dashboard?tab=emails&logtype=order_confirmation&logstatus=failed"}
  ]'::jsonb,
  true
);
