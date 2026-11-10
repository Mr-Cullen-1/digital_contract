import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Vertex Contract — контракты без лишних шагов",
    template: "%s · Vertex Contract",
  },
  description:
    "Digital Contract by Vertex Studio. Создавайте, отправляйте и подписывайте контракты в одном пространстве.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
