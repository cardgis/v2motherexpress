/**
 * Reconnaissance des erreurs Prisma — par leur code, jamais par `instanceof`.
 *
 * `erreur instanceof Prisma.PrismaClientKnownRequestError` échoue sans bruit
 * dès que le client généré est chargé en deux exemplaires, ce que fait le
 * bundler de Next.js : l'erreur est levée par une copie de la classe, le test
 * en compare une autre, et le résultat vaut `false`. Constaté sur ce projet :
 * une collision de référence non reconnue, transformée en erreur 500.
 *
 * Le code d'erreur (`P2002`, `P2025`…) est documenté et stable : c'est lui
 * qu'on lit.
 */

/** Code d'une erreur Prisma connue, ou `null` pour toute autre erreur. */
export function codeErreurPrisma(erreur: unknown): string | null {
  if (typeof erreur !== "object" || erreur === null) return null;
  const { name, code } = erreur as { name?: unknown; code?: unknown };
  return name === "PrismaClientKnownRequestError" && typeof code === "string" ? code : null;
}

/**
 * Violation d'une contrainte d'unicité (P2002), sur un champ précis si
 * `champ` est fourni. Prisma nomme le champ entre accents graves dans le
 * message : « Unique constraint failed on the fields: (`reference`) ».
 */
export function estViolationUnicite(erreur: unknown, champ?: string): boolean {
  if (codeErreurPrisma(erreur) !== "P2002") return false;
  if (!champ) return true;
  const { message } = erreur as { message?: unknown };
  return typeof message === "string" && message.includes(`\`${champ}\``);
}
