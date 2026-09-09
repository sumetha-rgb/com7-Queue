import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
const notoSansThai = Noto_Sans_Thai({ subsets: ["thai", "latin"], display: "swap" });
export const metadata: Metadata = {
  title: "COM7 Interview Queue",
  description: "Interview Queue Management System",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="th"><body className={notoSansThai.className}>{children}</body></html>; }
