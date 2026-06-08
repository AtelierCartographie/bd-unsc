# UNSC Votes Since 1946

Interface de consultation et d'analyse de la base de données des votes au Conseil de sécurité des Nations Unies depuis 1946.

## Contenu

La base recense les votes individuels de chaque État ayant siégé au Conseil de sécurité depuis sa création. Elle couvre les résolutions adoptées, celles rejetées faute de majorité, et celles bloquées par un veto.

L'interface propose trois modes d'exploration :

- **Browse** — tableau filtrable par pays, période et type de vote
- **Trends** — visualisations chronologiques des votes d'un ou plusieurs États
- **Compare** — comparaison directe des profils de vote entre États membres

Les données proviennent de la [Bibliothèque numérique des Nations Unies](https://digitallibrary.un.org/search?ln=en&cc=Security%20Council&p=&f=&rm=&ln=en&sf=&so=d&rg=100&c=Security%20Council&c=&of=hb&fti=0&fct__1=Voting%20Data&fct__2=Security%20Council&fti=0).

## Citation

> "UNSC votes since 1946 Database", MARTIN, Benoît, 2026, données issues des Voting Data de la Bibliothèque numérique des Nations Unies.

Licence [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Stack technique

- [SvelteKit](https://kit.svelte.dev/) — framework frontend
- [Observable Plot](https://observablehq.com/plot/) — visualisations
- [`@sveltejs/adapter-static`](https://github.com/sveltejs/kit/tree/main/packages/adapter-static) — export en site statique
- Déploiement via GitHub Actions → GitHub Pages

## Développement

```sh
pnpm install
pnpm dev
```

Le script `scripts/process-data.js` génère `static/data/votes.json` depuis le CSV source avant chaque build. Il est exécuté automatiquement par `pnpm dev` et `pnpm build`.
