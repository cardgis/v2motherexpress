"use client";

import { Fragment } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function RouteBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <Fragment key={pathname}>{children}</Fragment>;
}
