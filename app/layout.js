import "./globals.css";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap"
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

export const metadata = {
  title: "RTC Clearance Express — Official Municipal & Court Clearance Platform",
  description: "Unified digital clearance platform connecting constituents and station clerks. Request clearances online, generate QR passes, and verify counter issuance instantly."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${inter.variable}`}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}

