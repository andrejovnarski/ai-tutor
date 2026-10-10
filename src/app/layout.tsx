import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Andika } from "next/font/google";
import "./play/tokens.css";

const andika = Andika({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-andika",
});

export const metadata: Metadata = {
  title: "Math Friend",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={andika.variable}>
      <body>{children}</body>
    </html>
  );
}
