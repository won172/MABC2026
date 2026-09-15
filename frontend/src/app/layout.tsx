import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Go집될집",
  description: "청년주택 모집공고의 신청 자격을 판정하는 서비스",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
