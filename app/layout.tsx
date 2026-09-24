import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "บัญชีคาร์บอนองค์กร | Carbon Ledger",
  description: "บันทึกและคำนวณการปล่อยก๊าซเรือนกระจกขององค์กรตามแบบฟอร์ม Fr-01 ถึง Fr-05",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="antialiased">{children}</body>
    </html>
  );
}
