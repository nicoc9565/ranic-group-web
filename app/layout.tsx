import type { Metadata } from "next";
import {
  Archivo,
  Inter,
  JetBrains_Mono,
  Space_Grotesk,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { OrganizationJsonLd } from "@/components/public/OrganizationJsonLd";
import "./globals.css";

// Display / métricas — geométrico, técnico.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Body / UI / tablas.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Datos "de máquina": email, website, UPC, fechas, montos, IDs.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

// Eyebrows / labels de sección (aire de etiqueta de almacén).
// "Archivo Expanded" no está en next/font/google; usamos Archivo con tracking ancho (fallback de la guía).
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.ranicgroup.com"),
  title: {
    default: "RANIC GROUP LLC | Wholesale Buyer & Amazon Seller",
    template: "%s | RANIC GROUP LLC",
  },
  description:
    "RANIC GROUP LLC is a U.S.-based wholesale buyer and Amazon seller in Summit, NJ. We purchase inventory directly from brands and sell it on Amazon with MAP discipline.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-stone font-sans text-ink">
        {children}
        <Analytics />
        <OrganizationJsonLd />
      </body>
    </html>
  );
}
