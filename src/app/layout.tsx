import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import { DemoEnvironmentNotice } from "@/components/public/demo-environment-notice";
import { Providers } from "@/components/providers";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Veterans Bay",
  description:
    "A service marketplace and professional operations platform for home repair and maintenance.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <Providers>
          <DemoEnvironmentNotice />
          {children}
        </Providers>
      </body>
    </html>
  );
}
