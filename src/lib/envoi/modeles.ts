/**
 * Textes des messages envoyés aux clients.
 *
 * Bilingues français / anglais : une partie de la clientèle est de passage au
 * Sénégal. Le SMS reste sous 160 caractères et sans accent (alphabet GSM-7),
 * sinon il est découpé et facturé en plusieurs segments.
 */

import type { ButOtp } from "@/generated/prisma";
import type { Message } from "./index";

export function messageCode(params: {
  destinataire: string;
  code: string;
  but: ButOtp;
  validiteMinutes: number;
  canal: "SMS" | "EMAIL";
}): Message {
  const { destinataire, code, but, validiteMinutes, canal } = params;

  if (canal === "SMS") {
    const objet = but === "SIGNATURE" ? "code de signature" : "code";
    return {
      destinataire,
      sujet: "",
      texte:
        `La Mother Express - ${objet} : ${code} (valable ${validiteMinutes} min). ` +
        "Ne le partagez pas. Do not share.",
    };
  }

  const [actionFr, actionEn] =
    but === "SIGNATURE"
      ? ["signer votre contrat", "sign your contract"]
      : ["vous connecter", "sign in"];

  // Le code n'est fait que de chiffres : aucune donnée externe n'entre dans
  // le HTML, il n'y a donc rien à échapper.
  return {
    destinataire,
    sujet: `${code} — votre code La Mother Express`,
    texte:
      `Votre code pour ${actionFr} : ${code}\n` +
      `Il est valable ${validiteMinutes} minutes. Ne le communiquez à personne, ` +
      "La Mother Express ne vous le demandera jamais.\n\n" +
      `Your code to ${actionEn}: ${code}\n` +
      `Valid for ${validiteMinutes} minutes. Never share it.\n\n` +
      "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
    html:
      `<div style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:auto;color:#0f172a">` +
      `<p style="font-size:15px">Votre code pour ${actionFr} :</p>` +
      `<p style="font-size:34px;font-weight:800;letter-spacing:8px;margin:12px 0">${code}</p>` +
      `<p style="font-size:14px;color:#475569">Valable ${validiteMinutes} minutes. ` +
      `Ne le communiquez à personne, La Mother Express ne vous le demandera jamais.</p>` +
      `<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">` +
      `<p style="font-size:14px;color:#475569">Your code to ${actionEn}: <strong>${code}</strong>. ` +
      `Valid for ${validiteMinutes} minutes. Never share it.</p>` +
      `<p style="font-size:12px;color:#94a3b8">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>` +
      `</div>`,
  };
}
