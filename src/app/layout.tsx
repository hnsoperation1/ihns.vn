import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "iHNS",
  description: "Chấm công theo vị trí GPS cho nhân viên Hanoi Sun Travel",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "iHNS",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#031c29",
  width: "device-width",
  initialScale: 1,
  // Chặn zoom bằng cử chỉ (pinch) — trải nghiệm app-like nhất quán khi chạy
  // standalone trên màn hình chính, không phải hành vi mặc định của web thường.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
