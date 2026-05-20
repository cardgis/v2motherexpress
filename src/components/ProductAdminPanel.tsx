"use client";

import { useMemo, useState, type FormEvent } from "react";

type Produit = {
  id: string;
  slug: string;
  nom: string;
  marque: string;
  modele: string;
  categorie: "ELECTRIQUE";
  moteurType: string;
  batterie: string;
  vitesseMaxKmh: number;
  autonomieKm: number;
  stockTotal: number;
  stockDisponible: number;
  estDisponible: boolean;
  imageUrl?: string | null;
  inventories?: Array<{
    id: string;
    storeId: string;
    totalQuantity: number;
    availableQuantity: number;
    isAvailable: boolean;
    store?: { id: string; name: string; slug: string; city?: string | null } | null;
  }>;
  tarification?: {
    prixVenteFcfa: number;
    tarif24hFcfa: number;
    tarifMatinFcfa: number;
    tarifApresMidiFcfa: number;
    tarifJourneeFcfa: number;
    kmInclus: number;
    tarifKmSupplementaire: number;
    moratoireActif: boolean;
    moratoireAcompte: number | null;
    moratoireSolde: number | null;
    moratoireDureeEnMois: number;
    rachatMontantJournalier: number;
    rachatNombreJours: number;
    rachatMontantTotal: number;
  } | null;
};

type StoreOption = {
  id: string;
  name: string;
  slug: string;
  city?: string | null;
};

type InventoryFormValue = {
  totalQuantity: number;
  availableQuantity: number;
  isAvailable: boolean;
};

type FormState = {
  id?: string;
  slug: string;
  nom: string;
  marque: string;
  modele: string;
  moteurType: string;
  batterie: string;
  vitesseMaxKmh: number;
  autonomieKm: number;
  estDisponible: boolean;
  imageUrl: string;
  prixVenteFcfa: number;
  tarif24hFcfa: number;
  // preserved but not shown in form — prevents overwriting existing tarif data on edit
  tarifMatinFcfa: number;
  tarifApresMidiFcfa: number;
  tarifJourneeFcfa: number;
  kmInclus: number;
  tarifKmSupplementaire: number;
  moratoireActif: boolean;
  moratoireAcompte: number | null;
  moratoireSolde: number | null;
  moratoireDureeEnMois: number;
  rachatMontantJournalier: number;
  rachatNombreJours: number;
  rachatMontantTotal: number;
  inventories: Record<string, InventoryFormValue>;
};

const createEmptyForm = (stores: StoreOption[]): FormState => ({
  slug: "",
  nom: "",
  marque: "",
  modele: "",
  moteurType: "",
  batterie: "",
  vitesseMaxKmh: 0,
  autonomieKm: 0,
  estDisponible: true,
  imageUrl: "",
  prixVenteFcfa: 0,
  tarif24hFcfa: 0,
  tarifMatinFcfa: 0,
  tarifApresMidiFcfa: 0,
  tarifJourneeFcfa: 0,
  kmInclus: 0,
  tarifKmSupplementaire: 1000,
  moratoireActif: false,
  moratoireAcompte: null,
  moratoireSolde: null,
  moratoireDureeEnMois: 4,
  rachatMontantJournalier: 5000,
  rachatNombreJours: 730,
  rachatMontantTotal: 3650000,
  inventories: Object.fromEntries(
    stores.map((store) => [
      store.id,
      {
        totalQuantity: 0,
        availableQuantity: 0,
        isAvailable: true,
      },
    ])
  ),
});

const textFields: Array<[keyof FormState, string]> = [
  ["slug", "Slug"],
  ["nom", "Nom"],
  ["marque", "Marque"],
  ["modele", "Modèle"],
  ["moteurType", "Type moteur"],
  ["batterie", "Batterie"],
  ["imageUrl", "Image URL"],
];

const numberFields: Array<[keyof FormState, string]> = [
  ["vitesseMaxKmh", "Vitesse max"],
  ["autonomieKm", "Autonomie"],
  ["prixVenteFcfa", "Prix vente"],
  ["tarif24hFcfa", "Tarif 24h"],
];

function toForm(p: Produit, stores: StoreOption[]): FormState {
  const inventories = Object.fromEntries(
    stores.map((store) => {
      const inventory = p.inventories?.find((item) => item.storeId === store.id);
      return [
        store.id,
        {
          totalQuantity: inventory?.totalQuantity ?? 0,
          availableQuantity: inventory?.availableQuantity ?? 0,
          isAvailable: inventory?.isAvailable ?? true,
        },
      ];
    })
  );

  return {
    id: p.id,
    slug: p.slug,
    nom: p.nom,
    marque: p.marque,
    modele: p.modele,
    moteurType: p.moteurType,
    batterie: p.batterie,
    vitesseMaxKmh: p.vitesseMaxKmh,
    autonomieKm: p.autonomieKm,
    estDisponible: p.estDisponible,
    imageUrl: p.imageUrl ?? "",
    prixVenteFcfa: p.tarification?.prixVenteFcfa ?? 0,
    tarif24hFcfa: p.tarification?.tarif24hFcfa ?? 0,
    tarifMatinFcfa: p.tarification?.tarifMatinFcfa ?? 0,
    tarifApresMidiFcfa: p.tarification?.tarifApresMidiFcfa ?? 0,
    tarifJourneeFcfa: p.tarification?.tarifJourneeFcfa ?? 0,
    kmInclus: p.tarification?.kmInclus ?? 0,
    tarifKmSupplementaire: p.tarification?.tarifKmSupplementaire ?? 1000,
    moratoireActif: p.tarification?.moratoireActif ?? false,
    moratoireAcompte: p.tarification?.moratoireAcompte ?? null,
    moratoireSolde: p.tarification?.moratoireSolde ?? null,
    moratoireDureeEnMois: p.tarification?.moratoireDureeEnMois ?? 4,
    rachatMontantJournalier: p.tarification?.rachatMontantJournalier ?? 5000,
    rachatNombreJours: p.tarification?.rachatNombreJours ?? 730,
    rachatMontantTotal: p.tarification?.rachatMontantTotal ?? 3650000,
    inventories,
  };
}

export default function ProductAdminPanel({ initialProducts, stores }: { initialProducts: Produit[]; stores: StoreOption[] }) {
  const [products, setProducts] = useState<Produit[]>(initialProducts);
  const [form, setForm] = useState<FormState>(() => createEmptyForm(stores));
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  async function handleLogout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch (e) {
      // ignore
    }
    window.location.assign("/admin/login");
  }

  function patchProduct(id: string, updater: (product: Produit) => Produit) {
    setProducts((prev) => prev.map((product) => (product.id === id ? updater(product) : product)));
  }

  const stats = useMemo(() => {
    const available = products.filter((product) =>
      product.estDisponible || (product.inventories ?? []).some((inventory) => inventory.isAvailable && inventory.availableQuantity > 0)
    ).length;
    const unavailable = products.length - available;
    const stockTotal = products.reduce((sum, product) => sum + product.stockTotal, 0);
    const stockAvailable = products.reduce((sum, product) => sum + product.stockDisponible, 0);
    return { available, unavailable, stockTotal, stockAvailable };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((product) => {
      return [product.nom, product.marque, product.modele, product.slug, product.moteurType, product.batterie]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [products, query]);

  async function refresh() {
    const res = await fetch("/api/admin/produits", { cache: "no-store" });
    if (res.ok) setProducts(await res.json());
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const inventories = stores.map((store) => ({
        storeId: store.id,
        totalQuantity: Number(form.inventories[store.id]?.totalQuantity ?? 0),
        availableQuantity: Number(form.inventories[store.id]?.availableQuantity ?? 0),
        isAvailable: Boolean(form.inventories[store.id]?.isAvailable ?? true),
      }));
      const stockTotal = inventories.reduce((sum, item) => sum + item.totalQuantity, 0);
      const stockDisponible = inventories.reduce((sum, item) => sum + item.availableQuantity, 0);

      const payload = {
        slug: form.slug,
        nom: form.nom,
        marque: form.marque,
        modele: form.modele,
        categorie: "ELECTRIQUE",
        moteurType: form.moteurType,
        batterie: form.batterie,
        vitesseMaxKmh: Number(form.vitesseMaxKmh),
        autonomieKm: Number(form.autonomieKm),
        stockTotal,
        stockDisponible,
        estDisponible: form.estDisponible,
        imageUrl: form.imageUrl || null,
        inventories,
        tarification: {
          prixVenteFcfa: Number(form.prixVenteFcfa) || 0,
          tarif24hFcfa: Number(form.tarif24hFcfa) || 0,
          tarifMatinFcfa: form.tarifMatinFcfa,
          tarifApresMidiFcfa: form.tarifApresMidiFcfa,
          tarifJourneeFcfa: form.tarifJourneeFcfa,
          kmInclus: form.kmInclus,
          tarifKmSupplementaire: form.tarifKmSupplementaire,
          moratoireActif: form.moratoireActif,
          moratoireAcompte: form.moratoireAcompte,
          moratoireSolde: form.moratoireSolde,
          moratoireDureeEnMois: form.moratoireDureeEnMois,
          rachatMontantJournalier: form.rachatMontantJournalier,
          rachatNombreJours: form.rachatNombreJours,
          rachatMontantTotal: form.rachatMontantTotal,
        },
      };

      const res = await fetch("/api/admin/produits", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form.id ? { id: form.id, data: payload } : payload),
      });

      if (!res.ok) throw new Error(await res.text());
      setForm(createEmptyForm(stores));
      await refresh();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm("Supprimer ce produit ?")) return;
    const res = await fetch("/api/admin/produits", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      alert("Erreur lors de la suppression.");
      return;
    }
    setProducts((prev) => prev.filter((product) => product.id !== id));
    await refresh();
  }

  async function toggleAvailability(product: Produit) {
    const nextValue = !product.estDisponible;
    patchProduct(product.id, (current) => ({ ...current, estDisponible: nextValue }));
    const res = await fetch("/api/admin/produits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: product.id, data: { estDisponible: nextValue } }),
    });
    if (!res.ok) {
      patchProduct(product.id, (current) => ({ ...current, estDisponible: product.estDisponible }));
      alert("Erreur lors de la mise à jour de la disponibilité.");
    }
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div
        style={{
          borderRadius: 24,
          padding: 24,
          background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #7c3aed 100%)",
          color: "white",
          boxShadow: "0 20px 45px rgba(15, 23, 42, 0.18)",
        }}
      >
        <div className="uk-grid uk-grid-medium" data-uk-grid>
          <div className="uk-width-expand@m">
            <div style={{ opacity: 0.85, letterSpacing: 0.4, textTransform: "uppercase", fontSize: 12 }}>Espace admin</div>
            <h2 style={{ margin: "8px 0 6px", fontSize: 32, lineHeight: 1.1, fontWeight: 800 }}>Gestion du catalogue scooter</h2>
            <p style={{ margin: 0, maxWidth: 720, opacity: 0.9 }}>
              Créez, modifiez et pilotez le stock par magasin depuis un espace clair, rapide et centré sur l’exploitation.
            </p>
          </div>

          <div className="uk-width-auto@m" style={{ display: "flex", alignItems: "center" }}>
            <div style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 18, padding: "14px 18px", minWidth: 220 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Recherche rapide</div>
              <input
                className="uk-input"
                placeholder="Nom, marque, modèle..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ marginTop: 8, borderRadius: 12, border: "none" }}
              />
            </div>
            <div style={{ marginLeft: 12 }}>
              <button onClick={handleLogout} className="uk-button uk-button-default" style={{ borderRadius: 12 }}>
                Se déconnecter
              </button>
            </div>
          </div>
        </div>

        <div className="uk-grid uk-grid-small uk-child-width-1-4@m uk-child-width-1-2@s" data-uk-grid style={{ marginTop: 22 }}>
          {[
            ["Produits", products.length, "#e0f2fe"],
            ["Disponibles", stats.available, "#dcfce7"],
            ["Indisponibles", stats.unavailable, "#fee2e2"],
            ["Stock total", stats.stockAvailable + "/" + stats.stockTotal, "#fef3c7"],
          ].map(([label, value, bg]) => (
            <div key={String(label)}>
              <div style={{ background: bg as string, color: "#0f172a", borderRadius: 18, padding: 16, minHeight: 92, boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)" }}>
                <div style={{ fontSize: 12, opacity: 0.75, textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="uk-grid uk-grid-large" data-uk-grid>
        <div className="uk-width-2-5@m">
          <div className="uk-card uk-card-default uk-card-body" style={{ borderRadius: 20, boxShadow: "0 16px 35px rgba(15, 23, 42, 0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>{form.id ? "Édition" : "Nouveau produit"}</div>
                <h3 className="uk-card-title" style={{ margin: "4px 0 0" }}>{form.id ? "Modifier le produit" : "Ajouter un produit"}</h3>
              </div>
              <div style={{ padding: "8px 12px", borderRadius: 999, background: form.estDisponible ? "#dcfce7" : "#fee2e2", color: form.estDisponible ? "#166534" : "#991b1b", fontWeight: 700, fontSize: 12 }}>
                {form.estDisponible ? "Disponible" : "Indisponible"}
              </div>
            </div>

            <form onSubmit={submit} className="uk-form-stacked">
              <div className="uk-grid uk-grid-small uk-child-width-1-2@s" data-uk-grid>
                {textFields.map(([key, label]) => (
                  <div key={String(key)}>
                    <div className="uk-margin">
                      <label className="uk-form-label">{label}</label>
                      <div className="uk-form-controls">
                        <input
                          className="uk-input"
                          value={form[key] as string}
                          onChange={(e) => updateField(key, e.target.value as never)}
                          style={{ borderRadius: 12 }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="uk-grid uk-grid-small uk-child-width-1-2@s" data-uk-grid>
                {numberFields.map(([key, label]) => (
                  <div key={String(key)}>
                    <div className="uk-margin">
                      <label className="uk-form-label">{label}</label>
                      <div className="uk-form-controls">
                        <input
                          type="number"
                          className="uk-input"
                          value={form[key] as number}
                          onChange={(e) => updateField(key, Number(e.target.value) as never)}
                          style={{ borderRadius: 12 }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="uk-margin-top" style={{ padding: 16, borderRadius: 16, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Stocks par magasin</div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>Mbour et Thiès sont déjà prêts. Chaque magasin garde son propre stock.</div>
                <div style={{ display: "grid", gap: 12 }}>
                  {stores.map((store) => (
                    <div key={store.id} style={{ background: "white", borderRadius: 14, padding: 12, border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{store.name}</div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>{store.city ?? "Magasin"}</div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: form.inventories[store.id]?.isAvailable ? "#166534" : "#991b1b" }}>
                          {form.inventories[store.id]?.isAvailable ? "Actif" : "Inactif"}
                        </div>
                      </div>

                      <div className="uk-grid uk-grid-small uk-child-width-1-3@s" data-uk-grid>
                        <div>
                          <label className="uk-form-label">Stock total</label>
                          <input
                            type="number"
                            className="uk-input"
                            value={form.inventories[store.id]?.totalQuantity ?? 0}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                inventories: {
                                  ...prev.inventories,
                                  [store.id]: {
                                    ...(prev.inventories[store.id] ?? { totalQuantity: 0, availableQuantity: 0, isAvailable: true }),
                                    totalQuantity: Number(e.target.value),
                                  },
                                },
                              }))
                            }
                            style={{ borderRadius: 12 }}
                          />
                        </div>
                        <div>
                          <label className="uk-form-label">Stock disponible</label>
                          <input
                            type="number"
                            className="uk-input"
                            value={form.inventories[store.id]?.availableQuantity ?? 0}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                inventories: {
                                  ...prev.inventories,
                                  [store.id]: {
                                    ...(prev.inventories[store.id] ?? { totalQuantity: 0, availableQuantity: 0, isAvailable: true }),
                                    availableQuantity: Number(e.target.value),
                                  },
                                },
                              }))
                            }
                            style={{ borderRadius: 12 }}
                          />
                        </div>
                        <div style={{ display: "flex", alignItems: "end" }}>
                          <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 600, marginBottom: 0 }}>
                            <input
                              type="checkbox"
                              checked={form.inventories[store.id]?.isAvailable ?? true}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  inventories: {
                                    ...prev.inventories,
                                    [store.id]: {
                                      ...(prev.inventories[store.id] ?? { totalQuantity: 0, availableQuantity: 0, isAvailable: true }),
                                      isAvailable: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                            Visible
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="uk-margin-top" style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13, color: "#475569" }}>
                <span>Total global: <strong>{stores.reduce((sum, store) => sum + (form.inventories[store.id]?.totalQuantity ?? 0), 0)}</strong></span>
                <span>Disponible global: <strong>{stores.reduce((sum, store) => sum + (form.inventories[store.id]?.availableQuantity ?? 0), 0)}</strong></span>
              </div>

              <div className="uk-margin" style={{ marginTop: 6 }}>
                <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={form.estDisponible}
                    onChange={(e) => updateField("estDisponible", e.target.checked)}
                  />
                  Produit disponible à la vente / affichage
                </label>
              </div>

              <div className="uk-margin-top" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="uk-button uk-button-danger" type="submit" disabled={saving} style={{ borderRadius: 12, paddingInline: 18 }}>
                  {saving ? "Enregistrement..." : form.id ? "Mettre à jour" : "Créer"}
                </button>
                {form.id && (
                  <button
                    type="button"
                    className="uk-button uk-button-small"
                    onClick={() => setForm(createEmptyForm(stores))}
                    style={{
                      borderRadius: 12,
                      paddingInline: 18,
                      background: "#e2e8f0",
                      color: "#0f172a",
                      border: "1px solid #cbd5e1",
                      fontWeight: 500
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#cbd5e1";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#e2e8f0";
                    }}
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        <div className="uk-width-expand@m">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>Inventaire</div>
              <h3 style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800 }}>Produits en base</h3>
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              {filteredProducts.length} résultat{filteredProducts.length > 1 ? "s" : ""}
            </div>
          </div>

          <div className="uk-grid uk-grid-medium uk-child-width-1-2@l uk-child-width-1-2@m" data-uk-grid>
            {filteredProducts.map((product) => {
              const fill = product.stockTotal > 0 ? Math.round((product.stockDisponible / product.stockTotal) * 100) : 0;
              return (
                <div key={product.id}>
                  <div
                    className="uk-card uk-card-default uk-card-body"
                    style={{
                      borderRadius: 20,
                      boxShadow: "0 16px 35px rgba(15, 23, 42, 0.08)",
                      border: product.estDisponible ? "1px solid rgba(22,163,74,0.18)" : "1px solid rgba(220,38,38,0.18)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4 }}>{product.marque}</div>
                        <h4 className="uk-card-title" style={{ margin: "6px 0 8px", fontWeight: 800 }}>{product.nom}</h4>
                        <p style={{ margin: 0, color: "#475569" }}>{product.modele} · {product.moteurType}</p>
                      </div>
                      <div style={{ padding: "7px 10px", borderRadius: 999, background: product.estDisponible ? "#dcfce7" : "#fee2e2", color: product.estDisponible ? "#166534" : "#991b1b", fontWeight: 700, fontSize: 12 }}>
                        {product.estDisponible ? "Disponible" : "Indisponible"}
                      </div>
                    </div>

                    <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155" }}>
                        <span>Stock</span>
                        <strong>{product.stockDisponible}/{product.stockTotal}</strong>
                      </div>
                      <div style={{ display: "grid", gap: 6, fontSize: 12, color: "#475569" }}>
                        {(product.inventories ?? []).map((inventory) => (
                          <div key={inventory.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <span>{inventory.store?.name ?? "Magasin"}</span>
                            <strong>
                              {inventory.availableQuantity}/{inventory.totalQuantity}
                            </strong>
                          </div>
                        ))}
                      </div>
                      <div style={{ height: 8, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ width: `${fill}%`, height: "100%", background: product.estDisponible ? "linear-gradient(90deg, #22c55e, #16a34a)" : "linear-gradient(90deg, #ef4444, #dc2626)", borderRadius: 999 }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155" }}>
                        <span>Prix vente</span>
                        <strong>{product.tarification?.prixVenteFcfa ?? "-"} FCFA</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155" }}>
                        <span>Tarif 24h</span>
                        <strong>{product.tarification?.tarif24hFcfa ?? "-"} FCFA</strong>
                      </div>
                    </div>

                    <div className="uk-margin-top" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button 
                        type="button" 
                        className="uk-button uk-button-small" 
                        onClick={() => setForm(toForm(product, stores))} 
                        style={{ 
                          borderRadius: 12,
                          background: "#e2e8f0",
                          color: "#0f172a",
                          border: "1px solid #cbd5e1",
                          fontWeight: 500
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#cbd5e1";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#e2e8f0";
                        }}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="uk-button uk-button-small uk-button-primary"
                        onClick={() => toggleAvailability(product)}
                        style={{ borderRadius: 12, background: product.estDisponible ? "#0f172a" : "#166534", borderColor: "transparent" }}
                      >
                        {product.estDisponible ? "Rendre indisponible" : "Rendre disponible"}
                      </button>
                      <button type="button" className="uk-button uk-button-small uk-button-danger" onClick={() => deleteProduct(product.id)} style={{ borderRadius: 12 }}>
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
