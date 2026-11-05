# Image de production de La Mother Express — indépendante de l'hébergeur.
#
# Tourne à l'identique sur Azure Container Apps, OVHcloud (Managed Kubernetes
# ou VPS), Scaleway Serverless Containers, ou tout serveur avec Docker.
#
#   docker build -t lme-app .
#   docker build -t lme-migrations --target migrations .
#
# Les migrations sont une image SÉPARÉE, lancée une fois avant chaque
# déploiement : l'application en production n'a pas le droit de modifier le
# schéma de la base.

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ── Dépendances ─────────────────────────────────────────────────────────────
FROM base AS dependances
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# ── Compilation ─────────────────────────────────────────────────────────────
FROM base AS compilation
COPY --from=dependances /app/node_modules ./node_modules
COPY . .
ENV NEXT_OUTPUT=standalone
RUN npx prisma generate && npm run build

# ── Migrations (image à usage ponctuel) ─────────────────────────────────────
FROM compilation AS migrations
CMD ["npx", "prisma", "migrate", "deploy"]

# ── Exécution ───────────────────────────────────────────────────────────────
FROM base AS execution
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# L'application ne tourne jamais en root : une faille ne donnerait pas la
# main sur le conteneur.
RUN addgroup -S lme && adduser -S lme -G lme

COPY --from=compilation --chown=lme:lme /app/.next/standalone ./
COPY --from=compilation --chown=lme:lme /app/.next/static ./.next/static
COPY --from=compilation --chown=lme:lme /app/public ./public

USER lme
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/sante || exit 1

CMD ["node", "server.js"]
