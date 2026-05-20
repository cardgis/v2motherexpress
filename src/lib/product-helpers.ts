export function buildTarificationData(t: any) {
  return {
    prixVenteFcfa: Number(t.prixVenteFcfa ?? 0),
    tarif24hFcfa: Number(t.tarif24hFcfa ?? 0),
    kmInclus: Number(t.kmInclus ?? 0),
    tarifMatinFcfa: Number(t.tarifMatinFcfa ?? 0),
    tarifApresMidiFcfa: Number(t.tarifApresMidiFcfa ?? 0),
    tarifJourneeFcfa: Number(t.tarifJourneeFcfa ?? 0),
    tarifKmSupplementaire: Number(t.tarifKmSupplementaire ?? 1000),
    moratoireActif: Boolean(t.moratoireActif ?? false),
    moratoireAcompte: t.moratoireAcompte ?? null,
    moratoireSolde: t.moratoireSolde ?? null,
    moratoireDureeEnMois: Number(t.moratoireDureeEnMois ?? 4),
    rachatMontantJournalier: Number(t.rachatMontantJournalier ?? 5000),
    rachatNombreJours: Number(t.rachatNombreJours ?? 730),
    rachatMontantTotal: Number(t.rachatMontantTotal ?? 3650000),
  };
}

export function buildInventoryData(inv: any, adminId: string) {
  return {
    storeId: inv.storeId,
    totalQuantity: Number(inv.totalQuantity ?? 0),
    availableQuantity: Number(inv.availableQuantity ?? 0),
    isAvailable: Boolean(inv.isAvailable ?? true),
    updatedById: adminId,
  };
}
