export const money = (value?: number | null) =>
  value ? `${value.toLocaleString("fr-FR")} F` : "-";
