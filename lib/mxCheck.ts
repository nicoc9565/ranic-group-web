import { Resolver } from "node:dns/promises";

/**
 * Chequeo de MX: ¿el dominio de una dirección de email puede recibir correo?
 *
 * Vive en lib/ pero NO es lógica pura — hace I/O de red. Está separado del heurístico de
 * elegibilidad (lib/outreachEligibility.ts), que sí es puro y testeable sin red, justamente para
 * que esa distinción quede en la estructura y no en un comentario.
 */
export type DomainVerdict = "con-mx" | "sin-mx" | "error-transitorio";

/**
 * Códigos de DNS que significan "este dominio no recibe correo":
 *   ENOTFOUND / NXDOMAIN → el dominio no existe.
 *   ENODATA              → existe pero no tiene registros MX.
 * Cualquier otro código (ETIMEOUT, ESERVFAIL, EAI_AGAIN, ECONNREFUSED) es un problema de la
 * consulta, no del dominio, y no alcanza para sacar a nadie de la campaña.
 */
const DEAD_CODES = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN", "EBADNAME"]);

/** Dominio en minúsculas de una dirección de email. "" si no se puede determinar. */
export function domainOf(email: string): string {
  return (email ?? "").trim().toLowerCase().split("@")[1] ?? "";
}

async function resolveOne(resolver: Resolver, domain: string): Promise<DomainVerdict> {
  try {
    const records = await resolver.resolveMx(domain);
    // Un array vacío, o registros con exchange vacío, es lo mismo que no tener MX.
    const usable = records.filter((r) => (r.exchange ?? "").trim() !== "");
    return usable.length > 0 ? "con-mx" : "sin-mx";
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? "";
    if (DEAD_CODES.has(code)) return "sin-mx";
    return "error-transitorio";
  }
}

/**
 * Resuelve MX de una lista de dominios con concurrencia acotada.
 *
 * Los transitorios se reintentan UNA vez antes de darlos por transitorios: con cientos de
 * consultas seguidas, un puñado de timeouts es normal y reintentar baja mucho el ruido sin
 * cambiar el criterio (un dominio muerto responde ENOTFOUND las dos veces).
 */
export async function resolveDomains(
  domains: string[],
  concurrency = 25,
): Promise<Map<string, DomainVerdict>> {
  const resolver = new Resolver({ timeout: 5000, tries: 2 });
  const out = new Map<string, DomainVerdict>();
  let next = 0;

  async function worker() {
    while (next < domains.length) {
      const domain = domains[next++];
      let verdict = await resolveOne(resolver, domain);
      if (verdict === "error-transitorio") {
        verdict = await resolveOne(resolver, domain);
      }
      out.set(domain, verdict);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, domains.length) }, worker),
  );
  return out;
}
