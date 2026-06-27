import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: Request) {
  const body = await request.json();
  const { company, name, email, category, message } = body as {
    company?: string;
    name?: string;
    email?: string;
    category?: string;
    message?: string;
  };

  if (!company || !name || !email || !message) {
    return NextResponse.json(
      { error: "Missing required fields." },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Email service is not configured." },
      { status: 500 },
    );
  }

  try {
    // Instanciar Resend dentro del handler (no a nivel de módulo): así el build no
    // requiere la key y, si falta en runtime, devolvemos un error claro sin romper.
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "RANIC GROUP Contact Form <contact@ranicgroup.com>",
      to: "nicolas.conti@ranicgroup.com",
      replyTo: email,
      subject: `New supplier inquiry: ${company}`,
      text: `Company: ${company}\nContact name: ${name}\nEmail: ${email}\nCategory: ${category ?? "N/A"}\n\nMessage:\n${message}`,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to send message." },
      { status: 500 },
    );
  }
}
