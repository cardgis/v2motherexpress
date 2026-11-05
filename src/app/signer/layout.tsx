import type { ReactNode } from "react";
import CadreSimple from "@/components/espace/CadreSimple";

/** Signature par lien : sans session, sans navigation, une seule tâche. */
export default function LayoutSignature({ children }: { children: ReactNode }) {
  return <CadreSimple mention="Signature sécurisée">{children}</CadreSimple>;
}
