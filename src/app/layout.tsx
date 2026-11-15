import type { Metadata } from "next";
import Script from "next/script";
import { Header } from "@/components/Header";
import RouteBoundary from "@/components/RouteBoundary";
import DisableBfcache from "@/components/DisableBfcache";
import "./globals.css";

import { DOMAINE_PROVISOIRE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // `robots.txt` empêche l'EXPLORATION, pas l'INDEXATION : une adresse citée
  // ailleurs peut être indexée sans que son contenu soit lu. Sur un domaine
  // provisoire, il faut donc aussi la directive qui l'interdit explicitement.
  ...(DOMAINE_PROVISOIRE ? { robots: { index: false, follow: false } } : {}),
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
  alternates: {
    canonical: "/",
  },
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
  verification: {
    google: "zaaBJFQ9RgO3MWPxiDTQtj4Fa3A2mB1iKKsk_WA8FdE",
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
  image: `${SITE_URL}/assets/img/logo-la-mother-express.png`,
  logo: `${SITE_URL}/assets/img/logo-la-mother-express.png`,
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
    // `data-scroll-behavior` : globals.css pose `scroll-behavior: smooth` sur
    // `html`, et Next.js a besoin de cet attribut pour le NEUTRALISER pendant un
    // changement de route. Sans lui, chaque navigation anime un défilement vers
    // le haut, ce qui donne une impression de page qui saute.
    //
    // `suppressHydrationWarning` : les extensions de navigateur écrivent sur la
    // balise racine AVANT que React n'hydrate — ici `xk-pk-bridge` sous Chrome,
    // rien sous Edge. React comparait, trouvait un attribut qu'il n'avait pas
    // écrit, et avertissait à chaque chargement. Le coût de cette mesure est
    // nul : cette balise ne porte que deux attributs FIXES, donc rien de notre
    // fait ne peut y différer. Et la portée est l'ÉLÉMENT SEUL — un vrai
    // désaccord d'hydratation ailleurs dans l'arbre sera toujours signalé.
    <html lang="fr" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* La balise <style> qui forçait ici la police système a été retirée
            (2026-11-14). Elle ne s'appliquait pas : `main.css`, chargée après
            elle, imposait Oxygen à `html, body`. En supprimant `main.css` on
            l'aurait rendue active d'un coup, changeant la police de tout le
            site. Le socle de `globals.css` porte désormais la typographie,
            Oxygen comprise, et une seule feuille en décide. */}
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
        {/* PLUS AUCUN FICHIER DU THÈME V1 (2026-11-14). Les quatre derniers
            — `uikit.min.css`, `main.css`, `uikit.min.js`,
            `uikit-icons.min.js`, 655 Ko sur CHAQUE page — ne servaient plus
            que l'en-tête et le menu latéral, pour cinq classes `uk-` et
            vingt-huit classes de `main.css`. Tout est passé dans
            `src/styles/entete.css`. Mesuré page par page dans `CLAUDE.md`.
            Ne pas les recharger : réécrire en React et en CSS propre. */}
      </body>
    </html>
  );
}
