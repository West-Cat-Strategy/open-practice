import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Open Practice",
  description: "Open-source legal practice management for Canadian legal professionals.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
