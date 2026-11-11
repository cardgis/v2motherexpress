/**
 * Texte de reconnaissance du témoin, commun aux trois contrats.
 *
 * ── Un seul endroit, et c'est voulu ────────────────────────────────────────
 * La règle du projet veut que tout changement de texte d'acte soit validé par
 * Alexandre et incrémente `VERSION_MODELES`. Rassembler cette formule ici rend
 * la règle applicable : on voit d'un coup d'œil ce qui est écrit sur les trois
 * actes, au lieu de le chercher dans trois compositions.
 *
 * ── Témoin, et NON caution ─────────────────────────────────────────────────
 * Décision d'Alexandre du 2026-11-11, après que je lui aie posé la question :
 * « pas de caution ». La distinction n'est pas de vocabulaire. Un témoin
 * atteste avoir été informé et ne doit rien ; une caution paierait à la place
 * du locataire défaillant. Ce texte doit donc dire clairement ce qu'il n'est
 * pas — faute de quoi un témoin pourra soutenir qu'il croyait n'être que
 * témoin pendant que la boutique soutiendra qu'il s'est engagé. Un litige
 * ajouté au litige.
 *
 * Et pratiquement : les gens acceptent de signer quand la limite de leur
 * engagement est écrite noir sur blanc.
 *
 * ── Ce que la formule apporte à la boutique ────────────────────────────────
 * La phrase utile est « atteste de l'identité et du consentement ». Si un
 * locataire prétend plus tard n'avoir jamais signé, ou ne pas avoir compris,
 * un tiers identifié par son propre code a attesté du contraire. C'est ce que
 * le témoin apporte, et c'est tout ce qu'il apporte.
 *
 * ── Le mot qui change d'un acte à l'autre ──────────────────────────────────
 * Les actes ne nomment pas le client de la même façon : « Locataire » pour la
 * location journalière, « Accédant » pour la location-accession, « Acheteur »
 * pour la vente. Le texte s'y adapte plutôt que d'employer un terme générique
 * qui jurerait avec le reste du document.
 */

export type RoleClient = "Locataire" | "Accédant" | "Acheteur";

/**
 * Déterminant propre à chaque rôle. Une table explicite plutôt qu'une règle
 * d'élision calculée : trois valeurs, aucune exception à craindre, et la
 * faute se voit en relisant le fichier. Le premier jet produisait « du
 * Accédant » et « du Acheteur » — un contrôle de `verif:actes` l'a attrapé.
 */
const DETERMINANT: Record<RoleClient, string> = {
  Locataire: "du Locataire",
  Accédant: "de l'Accédant",
  Acheteur: "de l'Acheteur",
};

export function texteTemoin(role: RoleClient): string {
  return (
    `Le témoin déclare avoir pris connaissance du présent contrat et atteste de ` +
    `l'identité et du consentement ${DETERMINANT[role]}. Cette attestation ne constitue ` +
    `pas un cautionnement : le témoin n'est tenu d'aucune obligation financière.`
  );
}
