import type { Metadata } from "next";
import { Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import { Providers } from "@/components/providers";
import { SakuraFalling } from "@/components/SakuraFalling";
import "./globals.css";

const notoSans = Noto_Sans_SC({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const notoSerif = Noto_Serif_SC({
  variable: "--font-noto-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "捕捉春日计划 - 2026华勤全球员工春日摄影大赛",
  description:
    "2026华勤全球员工春日摄影大赛官方投票。用镜头定格全球华勤人的春日瞬间，每位员工每日可投3票。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${notoSans.variable} ${notoSerif.variable} h-full antialiased`}
    >
      <body className="relative min-h-full overflow-x-hidden font-sans">
        <Providers>
          <SakuraFalling />
          <div className="relative z-[3] flex min-h-full flex-col">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
