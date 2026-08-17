import { describe, expect, test } from "vitest";
import { bounceReason, classifyThread, type ThreadMessage } from "../bounceClassification";

const hardBounce: ThreadMessage = {
  headers: {
    from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
    "content-type": 'multipart/report; report-type=delivery-status; boundary="000000"',
    "x-failed-recipients": "test-jgvouqpcz@srv1.mail-tester.com",
  },
  body: [
    "Final-Recipient: rfc822; test-jgvouqpcz@srv1.mail-tester.com",
    "Action: failed",
    "Status: 5.1.1",
    "Diagnostic-Code: smtp; 550 5.1.1 The email account that you tried to reach does not exist.",
  ].join("\n"),
};

const softBounce: ThreadMessage = {
  headers: {
    from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
    "content-type": "multipart/report; report-type=delivery-status",
  },
  body: ["Action: delayed", "Status: 4.2.2", "Diagnostic-Code: smtp; 452 Mailbox full"].join("\n"),
};

const humanReply: ThreadMessage = {
  headers: {
    from: "Sales <sales@acmedistributors.com>",
    "content-type": 'text/plain; charset="UTF-8"',
  },
  body: "Thanks for reaching out, attaching our wholesale price list.",
};

describe("classifyThread", () => {
  test("hilo sin mensajes nuevos", () => {
    expect(classifyThread(null)).toBe("sin-respuesta");
  });
  test("respuesta de una persona", () => {
    expect(classifyThread(humanReply)).toBe("respuesta");
  });
  test("rebote duro 5.1.1", () => {
    expect(classifyThread(hardBounce)).toBe("rebote-duro");
  });
  test("rebote blando 4.2.2", () => {
    expect(classifyThread(softBounce)).toBe("rebote-blando");
  });
  // Conservador: mejor reintentar a una direccion viva que condenar una por no saber parsear.
  test("rebote sin Status legible cae en blando, no en duro", () => {
    expect(
      classifyThread({
        headers: { from: "mailer-daemon@googlemail.com" },
        body: "Something went wrong, no machine-readable status here.",
      }),
    ).toBe("rebote-blando");
  });
  test("detecta el rebote por X-Failed-Recipients aunque el From sea raro", () => {
    expect(
      classifyThread({
        headers: { from: "noreply@example.com", "x-failed-recipients": "a@b.com" },
        body: "Status: 5.0.0",
      }),
    ).toBe("rebote-duro");
  });
  // El asunto depende del idioma de la cuenta: no puede ser señal de clasificación.
  test("no clasifica por asunto", () => {
    expect(
      classifyThread({
        headers: {
          from: "buyer@realcompany.com",
          subject: "Re: Delivery Status Notification (Failure)",
          "content-type": "text/plain",
        },
        body: "Hi, we got your email.",
      }),
    ).toBe("respuesta");
  });
});

describe("bounceReason", () => {
  test("arma el motivo con código y diagnóstico", () => {
    expect(bounceReason(hardBounce)).toContain("5.1.1");
    expect(bounceReason(hardBounce)).toContain("does not exist");
  });
  test("cae en el destinatario fallido si no hay diagnóstico", () => {
    expect(
      bounceReason({
        headers: { "x-failed-recipients": "muerta@ejemplo.com" },
        body: "Status: 5.1.1",
      }),
    ).toContain("muerta@ejemplo.com");
  });
});
