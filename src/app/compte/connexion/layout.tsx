import type { ReactNode } from "react";
import CadreSimple from "@/components/espace/CadreSimple";

export default function LayoutConnexion({ children }: { children: ReactNode }) {
  return <CadreSimple mention="Espace client">{children}</CadreSimple>;
}
