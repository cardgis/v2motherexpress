export type Tarification = {
  prixVenteFcfa?: number | null;
  kmInclus?: number | null;
  tarifKmSupplementaire?: number | null;
  tarifMatinFcfa?: number | null;
  tarifApresMidiFcfa?: number | null;
  tarifJourneeFcfa?: number | null;
  tarif24hFcfa?: number | null;
};

export type ProduitHome = {
  id: string;
  slug: string;
  nom: string;
  marque: string;
  imageUrl?: string | null;
  moteurType?: string | null;
  vitesseMaxKmh?: number | null;
  autonomieKm?: number | null;
  batterie?: string | null;
  estDisponible: boolean;
  tarification?: Tarification | null;
};

export type InventoryHome = {
  produitId: string;
  isAvailable: boolean;
  availableQuantity: number;
  store?: { name?: string | null } | null;
};

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  documents?: Document[];
}

export interface Document {
  id: string;
  type: 'id_card' | 'address_proof' | 'income_proof' | 'photo';
  url: string;
  verified: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  rentalPrice?: number;
  category: string;
  stock: number;
  images: string[];
  characteristics: Record<string, string>;
}

export interface CartItem {
  productId: string;
  quantity: number;
  type: 'sale' | 'rental';
  duration?: number; // for rental
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered';
  paymentPlan?: PaymentPlan;
}

export interface PaymentPlan {
  id: string;
  orderId: string;
  installments: PaymentInstallment[];
}

export interface PaymentInstallment {
  id: string;
  amount: number;
  dueDate: Date;
  status: 'pending' | 'paid' | 'overdue';
}

export interface Contract {
  id: string;
  orderId: string;
  content: string;
  signature?: string;
  signedAt?: Date;
}