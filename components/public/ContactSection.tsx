"use client";

import { useState, type FormEvent } from "react";

const CATEGORIES = [
  "Beauty & Personal Care",
  "Home & Pet",
  "Entertainment & Toys",
  "General Merchandise",
  "Other",
] as const;

type Status = "idle" | "submitting" | "success" | "error";

export function ContactSection() {
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");

    const form = event.currentTarget;
    const data = {
      company: (form.elements.namedItem("company") as HTMLInputElement).value,
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      category: (form.elements.namedItem("category") as HTMLSelectElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value,
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Request failed");
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  return (
    <section id="contact" className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <p className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Get in touch
        </p>
        <h2 className="font-display text-3xl font-bold text-ink">
          Sell your brand to RANIC
        </h2>
        <p className="mt-3 text-ink-soft">
          Tell us about your brand and we&apos;ll get back to you. Prefer email?{" "}
          <a
            href="mailto:nicolas.conti@ranicgroup.com"
            className="underline hover:text-ink"
          >
            Write to us directly
          </a>
          .
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 grid gap-4 rounded-card border border-kraft bg-kraft/20 p-6 sm:grid-cols-2"
        >
          <div>
            <label
              htmlFor="company"
              className="block text-xs font-semibold uppercase tracking-wide text-ink-soft"
            >
              Company / Brand
            </label>
            <input
              id="company"
              name="company"
              required
              className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
          </div>
          <div>
            <label
              htmlFor="name"
              className="block text-xs font-semibold uppercase tracking-wide text-ink-soft"
            >
              Contact Name
            </label>
            <input
              id="name"
              name="name"
              required
              className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wide text-ink-soft"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
          </div>
          <div>
            <label
              htmlFor="category"
              className="block text-xs font-semibold uppercase tracking-wide text-ink-soft"
            >
              Category
            </label>
            <select
              id="category"
              name="category"
              defaultValue={CATEGORIES[0]}
              className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="message"
              className="block text-xs font-semibold uppercase tracking-wide text-ink-soft"
            >
              Message
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={4}
              className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={status === "submitting"}
              className="rounded-control bg-olive px-6 py-3 font-sans text-sm font-semibold text-stone transition hover:bg-olive-deep disabled:opacity-60"
            >
              {status === "submitting" ? "Sending…" : "Send message"}
            </button>
            {status === "success" && (
              <p className="mt-3 text-sm text-olive-deep">
                Thanks — we&apos;ll get back to you soon.
              </p>
            )}
            {status === "error" && (
              <p className="mt-3 text-sm text-stamp">
                Something went wrong. Please try again or email us directly.
              </p>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
