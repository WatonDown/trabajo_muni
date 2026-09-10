import type { Metadata } from "next";
import "./globals.css";
import "./auth.css";
import "./modules.css";
import "./municipal.css";
import "./portal.css";

export const metadata: Metadata = {
  title: "Circular Muni | Gestión de residuos",
  description: "Plataforma municipal de trazabilidad y retiro de residuos reciclables"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
