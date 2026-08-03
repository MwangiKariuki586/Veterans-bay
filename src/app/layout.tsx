import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";

import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: "Veterans Bay",
  description:
    "A service marketplace and professional operations platform for home repair and maintenance.",
  icons: {
    icon: "/images/veterans-bay-logo.png",
    apple: "/images/veterans-bay-logo.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} ${poppins.className} antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
