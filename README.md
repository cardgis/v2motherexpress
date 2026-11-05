This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Administration

- Un seul compte administrateur, désigné par
  `npm run admin:designer -- "<mobile ou e-mail>" "Prénom NOM"`.
- Il se connecte sur `/compte/connexion` avec cet identifiant (code à usage
  unique) et arrive sur `/admin` : chiffres, feuille de suivi, boutiques et
  équipes, catalogue.
- L'ancien accès par e-mail et mot de passe (`/admin/login`, `/catalogue`)
  n'existe plus.

### Database sync

If you change the Prisma schema, run:

```bash
npx prisma db push
npx prisma generate
```

The current setup already supports:

- admin-only catalog management
- store-based inventory for Mbour and Thiès
- public badges showing product availability by store

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

