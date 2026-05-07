import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Property Analyser",
  description: "Eerlijke vastgoedanalyse voor Immoweb, Zimmo en Realo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
