import { describe, expect, test } from "vitest";
import { buildRawMessage } from "../gmail";

/** Deshace el base64url que pide la Gmail API, para poder inspeccionar el mensaje. */
function decode(raw: string): string {
  return Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

const raw = () => decode(buildRawMessage("dest@example.com", "Wholesale inquiry - Acme", "Cuerpo"));

describe("buildRawMessage", () => {
  test("declara List-Unsubscribe con el mailto de baja", () => {
    expect(raw()).toContain(
      "List-Unsubscribe: <mailto:nicolas.conti@ranicgroup.com?subject=Unsubscribe>",
    );
  });
  // RFC 8058 exige una URL https que procese la baja sin intervención; no tenemos ese endpoint,
  // y declarar la cabecera apuntando a un mailto es peor que no declararla.
  test("NO declara List-Unsubscribe-Post", () => {
    expect(raw()).not.toContain("List-Unsubscribe-Post");
  });
  test("manda desde la casilla de Nico y en texto plano", () => {
    expect(raw()).toContain("From: nicolas.conti@ranicgroup.com");
    expect(raw()).toContain("Content-Type: text/plain; charset=utf-8");
  });
  test("las cabeceras van antes del cuerpo, separadas por una línea en blanco", () => {
    const [headers, ...rest] = raw().split("\n\n");
    expect(headers).toContain("Subject: Wholesale inquiry - Acme");
    expect(rest.join("\n\n")).toBe("Cuerpo");
  });
});
