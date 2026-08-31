import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SLA Compass — Ticket Clocks",
  description:
    "Priority SLA compass with business hours, pauses, countdown, and escalation. By Saeed Rumaneh.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
