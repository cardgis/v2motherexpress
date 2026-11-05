/**
 * Refus métier de l'administration, présentés tels quels à l'administrateur.
 *
 * `champ` désigne la saisie en cause : l'écran place le message sous ce
 * champ plutôt qu'en haut de page.
 */
export class ErreurAdmin extends Error {
  readonly champ: string | undefined;
  readonly statut: number;

  constructor(message: string, options: { champ?: string; statut?: number } = {}) {
    super(message);
    this.name = "ErreurAdmin";
    this.champ = options.champ;
    this.statut = options.statut ?? 409;
  }
}
