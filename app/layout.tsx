import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "BLUESCREEN · Factorio Control",
  description: "팩토리오 서버 운영 상황판",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
