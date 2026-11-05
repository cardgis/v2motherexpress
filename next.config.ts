import type { NextConfig } from "next";

/**
 * En-têtes de sécurité appliqués à toutes les réponses.
 *
 * Pas de Content-Security-Policy stricte à ce stade : le site vitrine V1
 * repose sur jQuery/UIkit et des scripts en ligne qu'une CSP casserait. Les
 * protections ci-dessous couvrent les attaques les plus probables sur les
 * pages V2 : détournement de clic, reniflage de type, fuite de l'URL.
 */
const ENTETES_SECURITE = [
  // Force HTTPS pendant un an une fois le site visité en HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Un fichier est servi avec le type annoncé, jamais « deviné » par le navigateur.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Personne ne peut encadrer nos pages (clickjacking sur le bouton « Signer ») ;
  // SAMEORIGIN et non DENY : la page de signature affiche le PDF en iframe.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Caméra : le gérant photographie la moto au retrait. Le reste est coupé.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  /**
   * `standalone` produit un serveur Node autonome, prêt pour une image
   * Docker (Azure Container Apps, OVHcloud, Scaleway, tout VPS). Activé par
   * le Dockerfile seulement : le déploiement Vercel actuel n'en a pas besoin.
   */
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,

  /**
   * SDK chargés tels quels par Node plutôt que ré-empaquetés : ils sont
   * volumineux, n'existent que côté serveur, et ne sont chargés que si le
   * fournisseur correspondant est configuré.
   */
  serverExternalPackages: ["@aws-sdk/client-s3", "@azure/storage-blob", "nodemailer"],

  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 30,
    },
  },

  async headers() {
    return [
      { source: "/:path*", headers: ENTETES_SECURITE },
      // Le jeton de signature est DANS l'URL : aucun site tiers ne doit le
      // recevoir via l'en-tête Referer. Déclaré après la règle générale, qu'il
      // remplace pour ces chemins.
      {
        source: "/signer/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      { source: "/api/signature/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      {
        source: "/(compte|gerant)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
