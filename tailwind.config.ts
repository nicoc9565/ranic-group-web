import type { Config } from "tailwindcss";

// Tokens de la guía de diseño (docs/design-guidelines.md): consola de operaciones / tracking
// logístico. Paleta olive + neutro frío "stone" + semáforo logístico para estados de follow-up.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Marca / primario
        olive: {
          DEFAULT: "#556B2F", // sidebar, botones primarios, acentos
          deep: "#3E4F1D", // sidebar activo, hover de primarios
          tint: "#EDF0E4", // fondos sutiles: fila hover, badges, selección
        },
        stone: "#F3F4EF", // fondo de la app (neutro frío levemente verdoso)
        surface: "#FFFFFF", // cards y tablas
        ink: {
          DEFAULT: "#1C1B17", // texto principal (negro cálido)
          soft: "#6B6A60", // texto secundario / labels / muted
        },
        line: "#E4E4DD", // hairlines, bordes de tabla y cards
        // Semáforo logístico de estados de follow-up (tonos apagados)
        status: {
          overdue: "#B23A2E", // vencido (rojo ladrillo)
          today: "#C98A2B", // vence hoy (ámbar/mostaza)
          ontrack: "#4E7A3F", // en fecha (verde)
        },
      },
      fontFamily: {
        // Body / UI / tablas (default)
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        // Display / titulares de sección y números de métricas
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        // Datos "de máquina": email, website, UPC, fechas, montos, contadores, IDs
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
        // Eyebrows / labels de sección (uppercase, tracking ancho)
        eyebrow: ["var(--font-archivo)", "var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        card: "6px",
        control: "4px",
      },
    },
  },
  plugins: [],
};

export default config;
