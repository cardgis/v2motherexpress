import type { MetadataRoute } from "next";
import { DOMAINE_PROVISOIRE, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Domaine provisoire : on refuse TOUTE exploration. Le raisonnement est dans
  // `lib/site.ts`, auprès de la constante.
  if (DOMAINE_PROVISOIRE) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Bloquer les pages admin — inutile à indexer, données privées
        disallow: ["/admin/", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
