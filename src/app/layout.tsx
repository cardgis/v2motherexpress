import type { Metadata } from "next";
import Script from "next/script";
import { Header } from "@/components/Header";
import RouteBoundary from "@/components/RouteBoundary";
import DisableBfcache from "@/components/DisableBfcache";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lamotherexpress.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "La Mother Express — Location & Vente Scooters Électriques Sénégal",
    template: "%s — La Mother Express",
  },
  description:
    "Location et vente de scooters électriques REVOO au Sénégal. Agences à Thiès et Mbour. Réservez facilement, roulez électrique.",
  keywords: [
    "scooter électrique Sénégal",
    "location scooter Thiès",
    "location scooter Mbour",
    "REVOO Sénégal",
    "vente scooter électrique",
    "mobilité électrique Afrique",
    "La Mother Express",
  ],
  authors: [{ name: "La Mother Express" }],
  creator: "La Mother Express",
  openGraph: {
    type: "website",
    locale: "fr_SN",
    siteName: "La Mother Express",
    title: "La Mother Express — Scooters Électriques REVOO au Sénégal",
    description:
      "Location et vente de scooters électriques REVOO. Agences à Thiès et Mbour. Simple, rapide et fiable.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "La Mother Express — Scooters Électriques REVOO au Sénégal",
    description:
      "Location et vente de scooters électriques REVOO. Agences à Thiès et Mbour.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
};

/** JSON-LD LocalBusiness — aide Google à afficher l'entreprise sur Maps et dans les résultats locaux */
const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${SITE_URL}/#business`,
  name: "La Mother Express",
  description:
    "Location et vente de scooters électriques REVOO au Sénégal. Agences à Thiès et Mbour.",
  url: SITE_URL,
  telephone: ["+221772320235", "+221703677575", "+221700019193"],
  email: "lamotherexpress@gmail.com",
  priceRange: "CFA",
  currenciesAccepted: "XOF",
  paymentAccepted: "Cash",
  image: `${SITE_URL}/assets/img/logo-la-mother-express.svg`,
  logo: `${SITE_URL}/assets/img/logo-la-mother-express.svg`,
  location: [
    {
      "@type": "Place",
      name: "La Mother Express — Thiès",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Thiès",
        addressCountry: "SN",
      },
      hasMap: "https://maps.google.com/maps?q=Q3F7%2B7J%2C+Thi%C3%A8s%2C+S%C3%A9n%C3%A9gal",
      telephone: "+221772320235",
    },
    {
      "@type": "Place",
      name: "La Mother Express — Mbour",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Mbour",
        addressCountry: "SN",
      },
      hasMap: "https://maps.google.com/maps?q=C2W7%2B5C+M%27bour%2C+S%C3%A9n%C3%A9gal",
      telephone: "+221703677575",
    },
  ],
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "09:00",
    closes: "19:00",
  },
  areaServed: {
    "@type": "Country",
    name: "Sénégal",
  },
  knowsAbout: ["scooter électrique", "REVOO", "location deux-roues", "mobilité électrique"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link rel="stylesheet" href="/assets/css/uikit.min.css" />
        <link rel="stylesheet" href="/assets/css/slick.css" />
        <link rel="stylesheet" href="/assets/css/slick-theme.css" />
        <link rel="stylesheet" href="/assets/css/ion.rangeSlider.css" />
        <link rel="stylesheet" href="/assets/css/main.css" />
        <style>{`body,.page-home{font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial}`}</style>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
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
