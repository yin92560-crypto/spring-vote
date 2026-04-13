import type { Metadata } from "next";
import { Ma_Shan_Zheng, Noto_Sans_SC, Source_Serif_4 } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const notoSans = Noto_Sans_SC({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: ["100", "200", "300"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const maShanZheng = Ma_Shan_Zheng({
  variable: "--font-ma-shan-zheng",
  subsets: ["latin"],
  weight: "400",
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
      className={`${notoSans.variable} ${sourceSerif.variable} ${maShanZheng.variable} h-full antialiased`}
    >
      <body className="relative min-h-full overflow-x-hidden font-sans">
        <div className="petal-fall-layer" aria-hidden>
          <span className="petal" />
          <span className="petal" />
          <span className="petal" />
          <span className="petal" />
          <span className="petal" />
          <span className="petal" />
          <span className="petal" />
          <span className="petal" />
          <span className="petal" />
          <span className="petal" />
          <span className="petal" />
          <span className="petal" />
        </div>
        <Providers>
          <div className="relative z-[3] flex min-h-full flex-col">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
