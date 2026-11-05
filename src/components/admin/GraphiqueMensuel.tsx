/**
 * Histogramme empilé des douze derniers mois, dessiné en SVG côté serveur.
 *
 * Aucune bibliothèque de graphiques : le rendu part avec la page, s'imprime
 * net, et ne charge rien de plus sur un téléphone en 3G. Les valeurs exactes
 * sont reprises dans un tableau dépliable, lisible aussi par les lecteurs
 * d'écran.
 */

import { SERIES } from "@/lib/admin/filtres";
import { nombre } from "@/lib/formatters";
import type { MoisGraphique } from "@/lib/admin/statistiques";

const LARGEUR = 720;
const HAUTEUR = 260;
const MARGE = { gauche: 40, droite: 12, haut: 22, bas: 34 };

export default function GraphiqueMensuel({ mois, titre }: { mois: MoisGraphique[]; titre: string }) {
  const totaux = mois.map((m) => m.ventes + m.longues + m.courtes);
  // Graduations entières et régulières : quatre intervalles jusqu'au plafond.
  const pas = Math.max(1, Math.ceil(Math.max(0, ...totaux) / 4));
  const plafond = pas * 4;

  const zoneLargeur = LARGEUR - MARGE.gauche - MARGE.droite;
  const zoneHauteur = HAUTEUR - MARGE.haut - MARGE.bas;
  const colonne = zoneLargeur / mois.length;
  const barre = Math.min(34, colonne * 0.6);
  const y = (valeur: number) => MARGE.haut + zoneHauteur - (valeur / plafond) * zoneHauteur;

  return (
    <figure className="lme-graphique">
      <div className="lme-graphique__zone">
        <svg viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} role="img" aria-label={`${titre}. Détail chiffré sous le graphique.`}>
          {Array.from({ length: 5 }, (_, i) => (
            <g key={i}>
              <line
                x1={MARGE.gauche}
                x2={LARGEUR - MARGE.droite}
                y1={y(pas * i)}
                y2={y(pas * i)}
                stroke={i === 0 ? "#c5cad3" : "#e2e5ea"}
                strokeWidth={1}
              />
              <text x={MARGE.gauche - 8} y={y(pas * i) + 4} textAnchor="end" fontSize={12} fill="#636b78">
                {nombre(pas * i)}
              </text>
            </g>
          ))}

          {mois.map((m, i) => {
            const x = MARGE.gauche + colonne * i + (colonne - barre) / 2;
            const total = totaux[i] ?? 0;
            let cumul = 0;

            return (
              <g key={m.cle}>
                {SERIES.map((serie) => {
                  const valeur = m[serie.cle];
                  if (valeur === 0) return null;
                  const haut = y(cumul + valeur);
                  const bas = y(cumul);
                  cumul += valeur;
                  return (
                    <rect key={serie.cle} x={x} y={haut} width={barre} height={bas - haut} fill={serie.couleur}>
                      <title>{`${m.libelle} — ${serie.libelle} : ${valeur}`}</title>
                    </rect>
                  );
                })}
                {total > 0 ? (
                  <text x={x + barre / 2} y={y(total) - 6} textAnchor="middle" fontSize={12} fontWeight={700} fill="#14171c">
                    {total}
                  </text>
                ) : null}
                <text x={x + barre / 2} y={HAUTEUR - 12} textAnchor="middle" fontSize={12} fill="#474e5c">
                  {m.libelle}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="lme-legende">
        {SERIES.map((serie) => (
          <li key={serie.cle}>
            <span className="lme-legende__pastille" style={{ background: serie.couleur }} aria-hidden />
            {serie.libelle}
          </li>
        ))}
      </ul>

      <details>
        <summary>Voir les chiffres du graphique</summary>
        <div className="lme-tableau-conteneur">
          <table className="lme-tableau">
            <thead>
              <tr>
                <th scope="col">Mois</th>
                {SERIES.map((serie) => (
                  <th key={serie.cle} scope="col" className="lme-nombre">
                    {serie.libelle}
                  </th>
                ))}
                <th scope="col" className="lme-nombre">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {mois.map((m, i) => (
                <tr key={m.cle}>
                  <th scope="row">{m.libelle}</th>
                  {SERIES.map((serie) => (
                    <td key={serie.cle} className="lme-nombre">
                      {m[serie.cle]}
                    </td>
                  ))}
                  <td className="lme-nombre">{totaux[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
