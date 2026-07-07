import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { CurrencyProvider } from "@/lib/currency";
import { Nav } from "@/components/Nav";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ArborWallet — Corporate Treasury",
  description:
    "Programmable budgets, instant settlement, full control. Treasury software for modern companies.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${jetbrains.variable} antialiased`}>
        <CurrencyProvider>
          <Nav />
          <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        </CurrencyProvider>
      </body>
    </html>
  );
}
