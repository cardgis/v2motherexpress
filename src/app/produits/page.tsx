import { headers } from "next/headers";

type Tarification = {
  prixVenteFcfa: number;
  tarif24hFcfa: number;
  moratoireActif: boolean;
  tarifMatinFcfa?: number;
  tarifApresMidiFcfa?: number;
  tarifJourneeFcfa?: number;
};

type Produit = {
  id: string;
  slug: string;
  nom: string;
  marque: string;
  vitesseMaxKmh: number;
  autonomieKm: number;
  estDisponible: boolean;
  imageUrl?: string | null;
  tarification?: Tarification | null;
};

const money = (value?: number | null) => (value ? `${value.toLocaleString("fr-FR")} FCFA` : "-");

export default async function ProduitsPage() {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") || headersList.get("host") || "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") || "http";
  const baseUrl = `${protocol}://${host}`;

  const response = await fetch(`${baseUrl}/api/produits`, { cache: "no-store" });
  const produits: Produit[] = response.ok ? await response.json() : [];

  return (
    <main className="min-h-screen bg-white py-10">
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Catalogue REVOO</h1>
          <p className="mt-2 text-gray-600">Scooters électriques disponibles à la location et à l'achat</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {produits.map((produit) => (
            <article key={produit.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="aspect-[4/3] w-full bg-gray-100">
                <img
                  src={produit.imageUrl || "/assets/img/product-default.jpg"}
                  alt={produit.nom}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{produit.nom}</h2>
                    <p className="text-sm text-gray-500">{produit.marque}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      produit.estDisponible ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {produit.estDisponible ? "Disponible" : "Indisponible"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                  <div className="rounded-lg bg-gray-50 p-2">Vitesse: {produit.vitesseMaxKmh} km/h</div>
                  <div className="rounded-lg bg-gray-50 p-2">Autonomie: {produit.autonomieKm} km</div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Prix de vente</p>
                  <p className="text-lg font-bold text-gray-900">{money(produit.tarification?.prixVenteFcfa)}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Tarif location 24h</p>
                  <p className="text-lg font-bold text-amber-700">{money(produit.tarification?.tarif24hFcfa)}</p>
                </div>

                {produit.tarification?.moratoireActif && (
                  <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    Moratoire disponible
                  </span>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                    Louer
                  </button>
                  <button type="button" className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">
                    Acheter
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
