import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VUS Resolver",
  description:
    "Autonomous cross-species evidence gathering for variants of uncertain significance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
