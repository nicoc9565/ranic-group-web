import type { EmailType, Provider } from "./types";

// Traducción de REFERENCIA al español de los 8 templates de lib/emails.ts.
// Solo para que Nico/César entiendan el contenido — NO es lo que se copia/envía
// (eso siempre es el texto en inglés de generateEmail). Mismos placeholders.
// La firma queda igual: son datos de contacto, no hace falta traducirla.
const SIGNATURE = `Nicolas Conti
Managing Member | RANIC GROUP LLC
nicolas.conti@ranicgroup.com
www.ranicgroup.com
+1 (201) 572-1383`;

const TEMPLATES_ES: Record<EmailType, string> = {
  first_short: `Estimado/a [Contact]:

Mi nombre es Nicolas Conti, Managing Member de RANIC GROUP LLC, un retailer online con base en Summit, NJ.

Estamos buscando activamente sumar productos de [Company] a nuestro catálogo y realizar pedidos mensuales recurrentes.

¿Podrías enviarnos tu lista de precios mayorista (con UPCs) y los requisitos de pedido mínimo?

Estamos listos para avanzar rápido con un primer pedido.

Saludos cordiales,
[signature]`,

  first_long: `Estimado/a [Contact]:

Mi nombre es Nicolas Conti, Managing Member de RANIC GROUP LLC, una empresa de retail online que opera desde Summit, NJ.

Nos especializamos en compras mayoristas y actualmente trabajamos varias marcas en las categorías de Health, Grocery y Home. Queremos sumar productos de [Company] a nuestro inventario activo con un primer pedido en el rango de $500–$1,500, con la intención de realizar pedidos mensuales recurrentes a medida que escalamos.

¿Podrías compartirnos tu lista de precios mayorista (idealmente con UPCs) y los requisitos para abrir una cuenta? Tenemos toda la documentación estándar lista y podemos avanzar de inmediato una vez aprobados.

Gracias — quedo a la espera de poder conectar.

Saludos cordiales,
[signature]`,

  followup_4: `Hola [Contact]:

Quería dar seguimiento a mi mensaje anterior sobre los productos de [Company]. Seguimos muy interesados en sumar tu línea a nuestro catálogo.

¿Podrías enviarnos tu lista de precios mayorista (con UPCs) y los requisitos de pedido mínimo cuando tengas un momento?

Saludos cordiales,
[signature]`,

  followup_7: `Hola [Contact]:

Te escribo una vez más respecto de los productos de [Company]. Estamos listos para avanzar rápido con un primer pedido y nos encantaría empezar esta semana.

Si pudieras compartirnos tu lista de precios mayorista (con UPCs) y los requisitos de pedido mínimo, puedo realizar un pedido de inmediato.

Saludos cordiales,
[signature]`,

  last_attempt_12: `Hola [Contact]:

Quería contactarte una última vez por una posible alianza mayorista para los productos de [Company]. Si no es el momento adecuado, lo entiendo perfectamente.

Si quisieras avanzar, estamos listos para realizar un primer pedido y establecer pedidos mensuales recurrentes — solo envianos tu lista de precios con UPCs y me encargo del resto.

Gracias por tu tiempo.

Saludos cordiales,
[signature]`,

  catalog_upcs: `Estimado/a [Contact]:

Gracias por aprobar nuestra cuenta. Revisamos tu catálogo y estamos listos para avanzar.

¿Podrías compartirnos tu lista de precios mayorista en formato Excel o CSV, incluyendo códigos UPC y precios unitarios? Esto nos permitirá hacer un análisis de productos adecuado antes de realizar nuestro primer pedido.

Gracias y quedo a la espera de tu respuesta.

Saludos cordiales,
[signature]`,

  reply_approval: `Hola [Contact]:

Gracias por aprobar nuestra cuenta — estamos muy contentos de empezar a trabajar con ustedes.

¿Podrías compartirnos tu lista de precios mayorista con códigos UPC y precios unitarios, idealmente en formato Excel o CSV? Una vez que la revisemos, vamos a estar listos para realizar nuestro primer pedido y establecer pedidos mensuales recurrentes.

Quedo a la espera.

Saludos cordiales,
[signature]`,

  clarification: `Hola [Contact]:

Gracias por responder. Antes de avanzar con [Company], ¿podrías aclararnos tu proceso de pedido, los métodos de pago aceptados y los requisitos de pedido mínimo?

Esto nos ayudará a preparar nuestro primer pedido sin contratiempos.

Gracias por tu ayuda.

Saludos cordiales,
[signature]`,
};

/**
 * Genera la traducción de referencia en español (mismo reemplazo de placeholders que
 * generateEmail). NO usar para copiar/enviar — el email real va siempre en inglés.
 */
export function generateEmailEs(type: EmailType, p: Provider): string {
  return TEMPLATES_ES[type]
    .replaceAll("[Contact]", p.contact)
    .replaceAll("[Company]", p.company)
    .replaceAll("[signature]", SIGNATURE)
    .trim();
}
