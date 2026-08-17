// Envuelve generateEmail("first_short", p) agregando lo que exige CAN-SPAM para outreach
// automático masivo: dirección postal física + opt-out. Solo lo usa el endpoint de envío
// automático (Task 10) — los emails manuales del CRM no pasan por acá.
import { generateEmail } from "./emails";
import type { Provider } from "./types";

// La dirección va como una línea más al pie de la firma, no como bloque aparte. Las seis líneas
// de la firma que exige CLAUDE.md quedan idénticas: esto se agrega después, no las reemplaza.
const COMPLIANCE_FOOTER = `
3 Ridgedale Ave, Summit, NJ 07901

If you'd prefer not to receive future emails from us, just reply and let us know and we'll remove you from our list.`;

export function generateOutreachEmail(p: Provider): string {
  return generateEmail("first_short", p) + COMPLIANCE_FOOTER;
}
