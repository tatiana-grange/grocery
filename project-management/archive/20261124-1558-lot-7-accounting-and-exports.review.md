# Revue de code

Lot 7, comptabilité et exports. Revue complète le 2026-11-24, six contrôles, sur le diff depuis
`origin/staging`.

## Fichiers relus

```text
17d67e16fcfcbf3c5846798de2569bf29a0d83f7  apps/api/src/app.module.ts
28feb8e6e42cbbb3b945b7133c73b8ac674f5f1a  apps/api/src/common/csv.util.spec.ts
108443f9facd631a454e098cde7a2c2b1695c7a9  apps/api/src/common/csv.util.ts
5a26a8e7952d18c14663972314675a174487009f  apps/api/src/main.ts
2e985b4b0a6225ed658cd64ea2b9574aeb2f9353  apps/api/src/modules/accounting/accounting.controller.ts
6e3f12c1527f6794a8a6086b39f744868b6b752f  apps/api/src/modules/accounting/accounting.module.ts
1031a59ec2558c0315da979f8f59375577caf70a  apps/api/src/modules/accounting/accounting.queries.ts
e6eaab45b12bb9c09ac1ffec188c31eda53cffb3  apps/api/src/modules/accounting/contracts/accounting.contract.ts
e0419231ad404d539dd1f07ac8f7e5065d565f0e  apps/api/src/modules/accounting/contracts/expense.contract.ts
aba0ec51e1491dc5faba5bb1a727cb294e002305  apps/api/src/modules/accounting/contracts/period.contract.ts
792f92dfc6cfb2d19c89cfeae88ec7bd5680cdc4  apps/api/src/modules/accounting/entities/expense.entity.ts
a0ce407422c1b356f784a8f08ca3e7f79dbd72b5  apps/api/src/modules/accounting/expense.mapper.ts
602de9f46c61828a48384f64f74cae494a2f4220  apps/api/src/modules/accounting/expenses.service.ts
d03262273f77010ecc29c52b19c7e2559de8973d  apps/api/src/modules/accounting/exports.service.ts
8bbdc03abcc377e30975c3f1aa4c05c006e33c2d  apps/api/src/modules/accounting/period.util.ts
bd43f0aa6b46da11cf1b5484c49bf09c4a72c7a3  apps/api/src/modules/accounting/profit-and-loss.mapper.ts
728444d11ed18d9284e2cb48d35e5887049d93bc  apps/api/src/modules/accounting/profit-and-loss.service.ts
dd1d2ffc0e72ac1ca511b7aded1628deaf3f2a40  apps/api/src/modules/accounting/tests/accounting-test-data.ts
028c68c812d788e1676f34817deadbdb895942f1  apps/api/src/modules/accounting/tests/expense.mapper.spec.ts
7525f379afdc128cd6d2b20b845dcdadd29483d9  apps/api/src/modules/accounting/tests/expenses.controller.e2e-spec.ts
6e4a4b566da043cee837d32d7eeedf6074f66aef  apps/api/src/modules/accounting/tests/expenses.service.spec.ts
20ba3b4b0c189f8f3eac282fffb9bb4286a69844  apps/api/src/modules/accounting/tests/exports.controller.e2e-spec.ts
dcfb5cb2fee8ddd2a5a006c45d6a08467062a3c3  apps/api/src/modules/accounting/tests/period.util.spec.ts
5fb54e2cdc589f6ba4992f3034fd691845446267  apps/api/src/modules/accounting/tests/profit-and-loss.controller.e2e-spec.ts
2bea5fb8b2102156643d8c36e783389092b8b44f  apps/api/src/modules/db/migrations/Migration20261124151128.ts
66a9cc26bf8e4c3929262bef0b50a4b3e2180e12  apps/api/src/modules/purchasing/purchasing.mapper.ts
55363697a1b63e7277231b1399e5d643740221e6  apps/api/src/seeders/e2e.seeder.ts
18de0f06e142a7a44eb4a537bf60cbc474cb1516  apps/web-spa-e2e/tests/accounting.spec.ts
75022071c2586d6f51d5df85960b5e1033201ce8  apps/web-spa-e2e/tests/nav-smoke.spec.ts
bd5e830c9885ac9ea9645117e35885b10ab350c4  apps/web-spa/app/features/admin-accounting/components/cancel-expense-dialog.tsx
ad157d19ab2c1f4527f57b3bf95f2f961c1d3cd2  apps/web-spa/app/features/admin-accounting/components/expenses-page.tsx
54c2b7f55d0f7d88ed572720b2bbc9d4bd31ea20  apps/web-spa/app/features/admin-accounting/components/period-picker.tsx
5c4c15cc1b8376635001a12ba0f7ab75318783a4  apps/web-spa/app/features/admin-accounting/components/profit-and-loss-page.tsx
71f004dcff5bf741d4c61f7ff1d4dce7ec0a26d8  apps/web-spa/app/features/admin-accounting/components/record-expense-dialog.tsx
130c8ac3a7f12c7b6012ed44315974b941ca9f80  apps/web-spa/app/features/admin-accounting/hooks/use-period.ts
1aa4778362b12fa94d3d8a0bd75b2ef08806f345  apps/web-spa/app/features/admin-accounting/utils/accounting-format.ts
719e95b9766195908fe67a27888690defd5038c6  apps/web-spa/app/features/admin-accounting/utils/admin-accounting-queries.ts
f7e26a5d45508b93b8d4724f10b499fbe2efb22c  apps/web-spa/app/features/admin-accounting/utils/expense-form.ts
e197c4fbaf4a0096f4a33bfb977939ed16262894  apps/web-spa/app/features/admin-participation/components/slot-form-dialog.tsx
f4c65e9c360dc2c39c05402b3f5e1b402b1df6ba  apps/web-spa/app/features/admin-participation/utils/slot-form.ts
53114f8311588c9f273d06c7364fa279cd6bb41d  apps/web-spa/app/features/admin-purchasing/utils/purchasing-queries.ts
4909de8f8a37a986950078723efc50ea6d88c12c  apps/web-spa/app/features/common/components/back-office-layout.tsx
24dfc0eaee7b3886f91b9a3d752fa4233d4deece  apps/web-spa/app/features/common/components/confirm-dialog.tsx
ff355350872db7f7d02f8ffc5a6495abdc1d3abe  apps/web-spa/app/features/common/lib/date-input.ts
534eba57b102180959c982baf4be55ecd7fa4cb5  apps/web-spa/app/features/common/lib/download-file.ts
1149bf88df3409f871b328f01364a4c5c3043cb4  apps/web-spa/app/lib/i18n/locales/en/common.locales.en.json
33be251b7ec55a66a8db4a54e489b198992ae605  apps/web-spa/app/lib/i18n/locales/fr/common.locales.fr.json
3995b59bc0fd47dfeb15bfee356898016d3968f9  apps/web-spa/app/routes.ts
```

## Règles métier et tests

- [x] apps/api/src/modules/accounting/expenses.service.ts:83 — Le `catch` qui transforme une violation d'unicité en `already_cancelled` (deux admins qui annulent en même temps) n'est atteint par aucun test : le test d'index reçoit son refus du `count` placé avant. Correction : ajouter `apps/api/src/modules/accounting/tests/expenses.service.spec.ts` avec un test où le `count` répond 0 alors qu'une annulation existe, puis vérifier `already_cancelled` et une seule ligne d'annulation. **Fait : `tests/expenses.service.spec.ts`. Vu rouge quand le `catch` est retiré.**
- [x] apps/api/src/modules/accounting/tests/expenses.controller.e2e-spec.ts:284 — Le test du jour d'annulation lit l'horloge réelle au lieu de passer `now` : il ne prouve pas qu'une annulation à 23:30 UTC compte le lendemain à Paris, et il peut échouer autour de minuit. Correction : dans `tests/expenses.service.spec.ts`, appeler `cancel` avec `now: 2026-03-31T22:30:00Z` et vérifier `spentOn === '2026-04-01'`, puis un cas en heure d'hiver. **Fait : le test d'annulation à `now` fixé est dans `tests/expenses.service.spec.ts` ; le test à l'horloge réelle est retiré du fichier E2E. Vu rouge avant le vert.**
- [x] apps/api/src/seeders/e2e.seeder.ts:128 — La porte fermée « le seeder E2E n'écrit aucune annulation » n'est vérifiée qu'à la main, alors que l'étape 3 est cochée. Correction : dans `apps/web-spa-e2e/tests/accounting.spec.ts`, après la remise à zéro, vérifier 0 `expense-reason` et 0 `expense-cancelled-badge`.
- [x] apps/web-spa-e2e/tests/accounting.spec.ts:73 — Critère `screens-for-admin` : aucun test ne change la période ; le compte de résultat n'est lu que sur l'année par défaut. Correction : choisir une période sans aujourd'hui avec `period-from`/`period-to`, vérifier `pnl-expenses-total` à `0.00 €` et l'URL `?from=&to=`.
- [x] apps/web-spa-e2e/tests/accounting.spec.ts:101 — Critère `screens-for-admin` : un seul des cinq exports est téléchargé dans le navigateur. Correction : boucler sur les cinq boutons et vérifier le nom du fichier et l'en-tête.
- [x] apps/api/src/modules/accounting/tests/expenses.controller.e2e-spec.ts:105 — Ce test et celui de la ligne 194 lancent deux requêtes en parallèle (`Promise.all`), ce qui a déjà donné `ECONNRESET` dans ce lot (une seule connexion de test). Correction : appeler les routes l'une après l'autre.
- [x] apps/api/src/modules/accounting/tests/ — Pas de `expenses.service.spec.ts` ni de `expense.mapper.spec.ts`, contrairement aux autres modules (backend.mdx, « Write unit tests for services »). Correction : les ajouter ; le mapper vérifie `isCancelled`, `cancelledByExpenseId` et `hasMore`.
- [x] apps/web-spa/app/features/admin-accounting/components/profit-and-loss-page.tsx:143 — Ajout hors spec : une note dit que l'argent des porte-monnaie n'est pas sur le compte de résultat ; personne ne l'a validée. Correction : la valider dans « Corrections at the reading », ou la retirer. **Fait : la note est approuvée par l'Architecte dans « Corrections at the reading », point 5. Elle reste.**

## Principes et sécurité

- [x] apps/web-spa/app/features/admin-accounting/utils/admin-accounting-queries.ts:77 — L'URL du fichier est révoquée juste après `anchor.click()` ; Safari, et Firefox parfois, peuvent produire un fichier vide. Même défaut déjà dans `purchasing-queries.ts:83`. Correction : révoquer plus tard (`setTimeout`), dans un utilitaire commun aux deux exports.

## Duplication

- [x] apps/api/src/modules/accounting/csv.util.ts:10 — La protection contre les formules et la mise entre guillemets copient `csvCell` de `apps/api/src/modules/purchasing/purchasing.mapper.ts:35`, et les deux écrivains divergent déjà (fin de ligne, guillemets). Correction : déplacer `toCsv` dans `apps/api/src/common/csv.util.ts` et l'utiliser dans `PurchasingMapper.toExport`. **Fait : `toCsv` et `toCsvLines` sont dans `apps/api/src/common/csv.util.ts`. Le mapper d'achats garde son format (tout entre guillemets, fin de ligne LF, pas de fin finale) grâce à l'option `alwaysQuote` et à `toCsvLines`, pour que ses tests existants passent sans changement.**
- [x] apps/api/src/modules/accounting/exports.service.ts:180 — Les jointures copient la constante `SALE_LINES_FROM` de `accounting.queries.ts:10`, faite pour que le compte de résultat et les exports ne divergent pas. Correction : écrire `from ${SALE_LINES_FROM}`.
- [x] apps/api/src/modules/accounting/accounting.queries.ts:20 — `'distribution'` et `'distribution_reversal'` sont recopiés de `STOCK_MOVEMENT_REASONS`. Correction : des constantes typées (`satisfies StockMovementReason`).
- [x] apps/api/src/modules/accounting/profit-and-loss.service.ts:43 — L'appel `getConnection().execute(...)` est écrit à la main alors que `sum` (ligne 73) et `ExportsService.query` l'enveloppent déjà. Correction : un helper privé `query<T>`, et `sum` construit dessus.
- [x] apps/web-spa/app/features/admin-accounting/utils/admin-accounting-queries.ts:72 — Le code de téléchargement copie `downloadSupplierOrderExport` (`admin-purchasing/utils/purchasing-queries.ts:78`). Correction : un `downloadFile(fileName, content, type)` dans `features/common/lib/`.
- [x] apps/web-spa/app/features/admin-accounting/utils/admin-accounting-queries.ts:75 — Le navigateur reconstruit le nom du fichier que le serveur envoie déjà dans `Content-Disposition`. Correction : lire l'en-tête, ou documenter la copie gardée sous le test E2E. **Fait : le nom vient de `Content-Disposition`. L'API l'expose pour le navigateur (`exposedHeaders` dans `main.ts`).**
- [x] apps/web-spa/app/features/admin-accounting/components/cancel-expense-dialog.tsx:57 — Le dialogue copie `ConfirmDialog` (`features/common/components/confirm-dialog.tsx`). Correction : donner à `ConfirmDialog` un `children` et un `confirmDisabled`, puis l'utiliser.
- [x] apps/web-spa/app/features/admin-accounting/utils/accounting-format.ts:16 — `toDayInput` copie `toDateInput` de `admin-participation/utils/slot-form.ts:59`. Correction : un utilitaire partagé.
- [x] apps/web-spa/app/features/admin-accounting/hooks/use-period.ts:26 — `setPeriod` copie `updateParams` de `app/hooks/use-list-search-params.ts`. Correction : utiliser `useListSearchParams`.
- [x] apps/web-spa/app/features/admin-accounting/hooks/use-period.ts:8 — La regex `DAY` copie `zCalendarDay` du client généré. Correction : `zCalendarDay.safeParse`.
- [x] apps/web-spa/app/features/admin-accounting/components/expenses-page.tsx:55 — Le lien `?from=&to=` est écrit deux fois (copie dans `profit-and-loss-page.tsx:71`). Correction : un helper `periodSearch(period)`.
- [x] apps/api/src/modules/accounting/tests/profit-and-loss.controller.e2e-spec.ts:33 — L'interface `Pnl` copie `ProfitAndLoss` du contrat, et `exports.controller.e2e-spec.ts:175` la recopie. Correction : importer le type du contrat.
- [x] apps/api/src/modules/accounting/tests/profit-and-loss.controller.e2e-spec.ts:489 — Une `WalletEntry` construite à la main alors que `insertWalletEntry` existe. Correction : appeler le helper.
- [x] apps/api/src/modules/accounting/tests/expenses.controller.e2e-spec.ts:390 — L'annulation construite à la main (ici et ligne 372) copie `insertExpenseCancellation`. Correction : appeler le helper.
- [x] apps/web-spa-e2e/tests/accounting.spec.ts:37 — L'enregistrement d'une dépense copie `recordExpenseOnScreen` (ligne 13). Correction : un `method` optionnel sur le helper.

## Conventions

- [x] apps/api/src/modules/accounting/entities/expense.entity.ts:67 — Pas d'`updatedAt`, alors que la constitution (« Data rules ») le demande ; l'écart, voulu pour une ligne append-only, n'est pas écrit dans la spec (« Governance »). Correction : l'écrire dans la spec, comme pour `WalletEntry`. **Fait : l'écart est écrit dans les « Implementation Decisions » de la spec (Architecte), aucun code changé.**
- [x] apps/api/src/modules/accounting/expenses.service.ts:114 — `row.cancelsExpense!.id` fait taire le compilateur (constitution, « Full-Stack Type Safety »). Correction : un filtre qui affine le type.
- [x] apps/api/src/modules/accounting/profit-and-loss.service.ts:27 — Le service renvoie le contrat que le contrôleur expose tel quel, sans mapper (constitution, « Module Boundaries » ; backend.mdx, « Services »). Correction : un type interne et un mapper.
- [x] apps/api/src/modules/accounting/contracts/accounting.contract.ts:5 — `expensesByCategoryItemSchema` n'exporte pas son type déduit (constitution, « Full-Stack Type Safety »). Correction : `export type ExpensesByCategoryItem`.
- [x] apps/api/src/modules/accounting/contracts/period.contract.ts:5 — `calendarDaySchema` n'exporte pas son type déduit. Correction : `export type CalendarDay`.
- [x] apps/api/src/modules/accounting/exports.service.ts:136 — Les cinq lecteurs privés n'ont pas de type de retour (general.mdx, « Basic Principles »). Correction : une interface nommée pour `{ header, rows }`.
- [x] apps/api/src/modules/accounting/expenses.service.ts:89 — `toAlreadyCancelledRefusal()` sans type de retour. Correction : `: ConflictException`.
- [x] apps/api/src/modules/accounting/accounting.controller.ts:48 — `list`, `record`, `cancel` et `getProfitAndLoss` sans type de retour. Correction : les déclarer.
- [x] apps/web-spa/app/features/admin-accounting/utils/admin-accounting-queries.ts:30 — Les cinq fonctions sans type de retour. Correction : les déclarer.
- [x] apps/web-spa/app/features/admin-accounting/hooks/use-period.ts:19 — `usePeriod` sans type de retour. Correction : une interface `UsePeriodResult`.
- [x] apps/web-spa/app/features/admin-accounting/utils/expense-form.ts:21 — `createExpenseFormSchema` sans type de retour. Correction : le déclarer.

## Commentaires

- [x] apps/api/src/modules/accounting/accounting.module.ts:11 — Le commentaire commence par « Lot 7 accounting » au lieu de dire ce que fait le module. Correction : « The accounting module: the association expense ledger, the profit-and-loss account and the CSV exports. It owns one table, `expense`, and only reads the tables of the other modules. »
- [x] apps/api/src/modules/accounting/contracts/accounting.contract.ts:20 — « Sales minus cost of goods sold. » répète le nom. Correction : Supprimer.
- [x] apps/api/src/modules/accounting/exports.service.ts:82 — Répète la signature de `toTextCell`. Correction : Supprimer.
- [x] apps/api/src/modules/accounting/exports.service.ts:97 — Cinq lignes qui répètent le code. Correction : « The five CSV exports. They share the period filters and the cost expression of the P&L (`accounting.queries.ts`). »
- [x] apps/api/src/modules/accounting/expense.mapper.ts:5 — Répète le nom de la classe. Correction : Supprimer.
- [x] apps/api/src/modules/accounting/period.util.ts:24 — Répète le corps de `formatDay`. Correction : Supprimer.
- [x] apps/api/src/modules/accounting/period.util.ts:46 — Répète le nom `toParisDay`. Correction : Supprimer.
- [x] apps/web-spa/app/features/admin-accounting/hooks/use-period.ts:10 — Répète le corps de `yearPeriod`. Correction : Supprimer.
- [x] apps/web-spa/app/features/admin-accounting/utils/admin-accounting-queries.ts:58 — Répète une règle déjà écrite sur la route et le dialogue. Correction : Supprimer.
- [x] apps/web-spa/app/features/admin-accounting/utils/admin-accounting-queries.ts:63 — Répète `downloadExport`. Correction : Supprimer.
- [x] apps/api/src/modules/accounting/tests/exports.controller.e2e-spec.ts:163 — Répète la ligne qui suit. Correction : Supprimer.
- [x] apps/web-spa-e2e/tests/accounting.spec.ts:7 — Répète `expenseRow`. Correction : Supprimer.

## i18n

- [x] apps/web-spa/app/features/admin-accounting/components/expenses-page.tsx:103 — La date s'affiche brute (`2026-03-01`), pas au format de la langue comme sur les autres écrans. Correction : la formater avec le helper des autres écrans.
- [x] apps/web-spa/app/lib/i18n/locales/fr/common.locales.fr.json:864 — « Ce que l'association a dépensé » (et « What the association spent » en anglais) : partout ailleurs, c'est « la coopérative ». Correction : « Ce que la coopérative a dépensé » / « What the cooperative spent ».
- [x] apps/web-spa/app/lib/i18n/locales/fr/common.locales.fr.json:908 — « Les jours sont lus à l'heure de Paris » est un mot à mot. Correction : « Les dates sont comptées à l'heure de Paris. »
- [x] apps/web-spa/app/lib/i18n/locales/fr/common.locales.fr.json:864 — « une seconde ligne qui l'annule » (et ligne 892) n'emploie pas le mot comptable. Correction : « une seconde ligne qui la contrepasse ».
