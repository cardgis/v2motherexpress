/**
 * Cadre des pages sans session : connexion et signature par lien.
 *
 * Même identité visuelle que les espaces connectés, mais aucune navigation :
 * la personne n'a qu'une chose à faire sur ces pages.
 */

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import "@/styles/espace.css";

export default function CadreSimple({ mention, children }: { mention: string; children: ReactNode }) {
  return (
    <div className="lme-app">
      <a href="#contenu" className="lme-evitement">
        Aller au contenu
      </a>
      <header className="lme-entete">
        <div className="lme-entete__interieur">
          <Link href="/" className="lme-marque">
            <Image
              src="/assets/img/logo-la-mother-express.svg"
              alt="La Mother Express"
              width={84}
              height={34}
              priority
              unoptimized
            />
            <span className="lme-marque__espace">{mention}</span>
          </Link>
          <div className="lme-entete__droite">
            <Link href="/" className="lme-lien-site lme-lien-site--toujours">
              <ArrowLeft size={16} aria-hidden />
              <span>Retour au site</span>
            </Link>
          </div>
        </div>
      </header>
      <main id="contenu" className="lme-contenu" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
