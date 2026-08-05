import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Santa Ana Fleet Monitor",
  description: "Monitoreo GPS de flota Santa Ana con Traccar"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
