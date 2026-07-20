import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "HDHomerun Web",
  description: "Web interface for HDHomerun devices",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex flex-col bg-bg-primary text-text-primary">
        <Navigation />
        <main className="flex-1 overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
