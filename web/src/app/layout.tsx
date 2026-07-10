import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { CurrencyProvider } from "@/lib/currency";
import { AppShell } from "@/components/AppShell";
import MagicProvider from "./context/MagicProvider";
import { UserProvider } from "./context/UserContext";

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
        <MagicProvider>
          <UserProvider>
            <CurrencyProvider>
              <AppShell>{children}</AppShell>
            </CurrencyProvider>
          </UserProvider>
        </MagicProvider>
      </body>
    </html>
  );
}
