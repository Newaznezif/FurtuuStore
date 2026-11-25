import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FurtuuStore — Your keys. Your privacy.",
  description: "A private, client-side encrypted password vault. Your keys. Your privacy. Your control.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
