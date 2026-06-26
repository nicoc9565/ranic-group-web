import type { EmailType, Provider } from "./types";

// Firma textual obligatoria al cierre de TODOS los emails (Global Constraints / §6.4 del spec).
const SIGNATURE = `Nicolas Conti
Managing Member | RANIC GROUP LLC
nicolas.conti@ranicgroup.com
www.ranicgroup.com
+1 (201) 572-1383`;

// Cuerpos por tipo de email. Placeholders [Contact], [Company] y [signature] se reemplazan en
// generateEmail. Reglas forzadas: primeros contactos empiezan con "Dear [Contact],"; los
// follow-ups de hilo en curso pueden usar "Hi [Contact],"; nunca mencionar Amazon (usar "online
// retailer"); nunca incluir EIN / Resale Certificate / Tax ID salvo pedido explícito; la frase
// "recurring monthly orders" aparece en los primeros contactos; presentarse como "online retailer
// based in Summit, NJ".
const TEMPLATES: Record<EmailType, string> = {
  // Template textual del spec §6.4 — short first contact.
  first_short: `Dear [Contact],

My name is Nicolas Conti, Managing Member of RANIC GROUP LLC, an online retailer based in Summit, NJ.

We are actively looking to add [Company] products to our catalog and place recurring monthly orders.

Could you please send us your wholesale price list (with UPCs) and minimum order requirements?

We are ready to move quickly on an initial order.

Best regards,
[signature]`,

  // Template textual del spec §6.4 — long first contact.
  first_long: `Dear [Contact],

My name is Nicolas Conti, Managing Member of RANIC GROUP LLC, an online retail company operating out of Summit, NJ.

We specialize in wholesale purchasing and currently carry several brands across Health, Grocery, and Home categories. We are looking to add [Company] products to our active inventory with an initial order in the $500–$1,500 range, with the intention of placing recurring monthly orders as we scale.

Could you please share your wholesale price list (ideally with UPCs) and any account opening requirements? We have all standard documentation ready and can move forward immediately upon approval.

Thank you — I look forward to connecting.

Best regards,
[signature]`,

  // Follow-up día 4 — recordatorio corto sobre un hilo ya iniciado.
  followup_4: `Hi [Contact],

I wanted to follow up on my previous message about [Company] products. We remain very interested in adding your line to our catalog.

Could you please send over your wholesale price list (with UPCs) and minimum order requirements whenever you have a moment?

Best regards,
[signature]`,

  // Follow-up día 7 — con sentido de urgencia.
  followup_7: `Hi [Contact],

I'm following up once more regarding [Company] products. We're ready to move forward quickly with an initial order and would love to get started this week.

If you could share your wholesale price list (with UPCs) and minimum order requirements, I can place an order right away.

Best regards,
[signature]`,

  // Último intento día 12 — cierre cordial de la secuencia.
  last_attempt_12: `Hi [Contact],

I wanted to reach out one last time about a potential wholesale partnership for [Company] products. If now isn't the right time, I completely understand.

Should you wish to move forward, we're ready to place an initial order and establish recurring monthly orders — just send over your price list with UPCs and I'll take it from there.

Thank you for your time.

Best regards,
[signature]`,

  // Template textual del spec §6.4 — catalog request with UPCs.
  catalog_upcs: `Dear [Contact],

Thank you for approving our account. We have reviewed your catalog and are ready to move forward.

Could you please share your wholesale price list in Excel or CSV format, including UPC codes and unit prices? This will allow us to conduct a proper product analysis before placing our first order.

Thank you and looking forward to hearing from you.

Best regards,
[signature]`,

  // Respuesta a una aprobación — agradecer y pedir price list con UPCs.
  reply_approval: `Hi [Contact],

Thank you for approving our account — we're excited to start working with you.

Could you please share your wholesale price list with UPC codes and unit prices, ideally in Excel or CSV format? Once we review it, we'll be ready to place our first order and set up recurring monthly orders.

Looking forward to it.

Best regards,
[signature]`,

  // Pedido de aclaración sobre proceso de compra / pago / mínimos.
  clarification: `Hi [Contact],

Thank you for getting back to me. Before we move forward with [Company], could you please clarify your ordering process, accepted payment methods, and minimum order requirements?

This will help us prepare our first order smoothly.

Thank you for your help.

Best regards,
[signature]`,
};

/**
 * Genera el email en texto plano para un tipo y proveedor: reemplaza [Contact] por el contacto,
 * [Company] por la empresa y [signature] por la firma, y recorta espacios externos.
 */
export function generateEmail(type: EmailType, p: Provider): string {
  return TEMPLATES[type]
    .replaceAll("[Contact]", p.contact)
    .replaceAll("[Company]", p.company)
    .replaceAll("[signature]", SIGNATURE)
    .trim();
}
