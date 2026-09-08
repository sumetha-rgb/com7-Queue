import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "COM7 Interview Queue", description: "Interview Queue Management System" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="th"><body>{children}</body></html>; }
