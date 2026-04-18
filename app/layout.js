import "./globals.css";
import { Public_Sans } from "next/font/google";

const publicSans = Public_Sans({
  subsets: ["latin"],
  display: "swap"
});

export const metadata = {
  title: "RTC Clearance Editor",
  description: "Regional Trial Court clearance editor with live preview"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={publicSans.className}>{children}</body>
    </html>
  );
}
