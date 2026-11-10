import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Assistant",
  description: "PDF belgelerinizde anlam odaklı arama yapın ve ilgili kaynak sayfalarını inceleyin.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body>{children}</body></html>;
}
