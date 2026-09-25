import type { Metadata } from "next";
import { Noto_Sans_Thai, Poppins } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-noto-sans-thai",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "บัญชีคาร์บอนองค์กร | Carbon Ledger",
  description: "บันทึกและคำนวณการปล่อยก๊าซเรือนกระจกขององค์กรตามแบบฟอร์ม Fr-01 ถึง Fr-05",
  icons: {
    icon: "/favicon.svg?v=3",
    shortcut: "/favicon.svg?v=3",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${notoSansThai.variable} ${poppins.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
