import type { EtatEconomiqueAgent, MicroUsdc } from "@esp/protocole";
import { calculerValeurEconomiqueNette } from "@esp/protocole";

/**
 * Limite de dépense cognitive autorisée pour un cycle.
 * Conservatrice : ne dépense jamais obligations ni capital inexistant.
 *
 * limite = min(plafondComputeParCycle, max(0, VEN))
 *
 * Une réservation Xway n'entre PAS dans ce calcul et ne modifie PAS la VEN :
 * elle réduit seulement la capacité opérationnelle côté PasserelleXway.
 */
export function calculerLimiteDepenseCognitive(options: {
  readonly etat: EtatEconomiqueAgent;
  readonly plafondComputeParCycleMicroUsdc: MicroUsdc;
}): MicroUsdc {
  const capacite = calculerValeurEconomiqueNette(options.etat);
  const disponible = capacite > 0n ? capacite : 0n;
  const plafond = options.plafondComputeParCycleMicroUsdc;
  return disponible < plafond ? disponible : plafond;
}

/**
 * Capacité cognitive encore ouvrable après réservations et coûts déjà réglés.
 * Ne touche pas à l'état économique (VEN).
 */
export function calculerCapaciteCognitiveDisponible(options: {
  readonly limiteDepenseAutoriseeMicroUsdc: MicroUsdc;
  readonly reservationsActivesMicroUsdc: MicroUsdc;
  readonly coutsReglesMicroUsdc: MicroUsdc;
}): MicroUsdc {
  const engage =
    options.reservationsActivesMicroUsdc + options.coutsReglesMicroUsdc;
  return options.limiteDepenseAutoriseeMicroUsdc > engage
    ? options.limiteDepenseAutoriseeMicroUsdc - engage
    : 0n;
}
