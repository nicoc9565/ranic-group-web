import type { Metadata } from "next";
import {
  Archivo,
  Inter,
  JetBrains_Mono,
  Space_Grotesk,
} from "next/font/google";
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
  title: "RANIC GROUP LLC",
  description: "RANIC GROUP LLC — CRM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-stone font-sans text-ink">
        {children}
      </body>
    </html>
  );
}
