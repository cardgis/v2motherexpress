import type { Metadata } from "next";
import Script from "next/script";
import { Header } from "@/components/Header";
import RouteBoundary from "@/components/RouteBoundary";
import DisableBfcache from "@/components/DisableBfcache";
import "./globals.css";

export const metadata: Metadata = {
  title: "La Mother Express",
  description: "Motorcycles dealer template",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/assets/css/uikit.min.css" />
        <link rel="stylesheet" href="/assets/css/slick.css" />
        <link rel="stylesheet" href="/assets/css/slick-theme.css" />
        <link rel="stylesheet" href="/assets/css/ion.rangeSlider.css" />
        <link rel="stylesheet" href="/assets/css/main.css" />
        <style>{`body,.page-home{font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial}`}</style>
      </head>
      <body>
        {/* Header monté une seule fois — jamais démonté pendant la navigation SPA */}
        <Header />
        <RouteBoundary>
          {children}
          <DisableBfcache />
        </RouteBoundary>
        <Script src="/assets/js/jquery.min.js" strategy="beforeInteractive" />
        <Script src="/assets/js/uikit.min.js" strategy="afterInteractive" />
        <Script src="/assets/js/uikit-icons.min.js" strategy="afterInteractive" />
        <Script src="/assets/js/slick.min.js" strategy="afterInteractive" />
        <Script src="/assets/js/ion.rangeSlider.min.js" strategy="afterInteractive" />
        <Script src="/assets/js/main.js" strategy="afterInteractive" />
        <Script src="/assets/js/fontawesome.all.min.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
