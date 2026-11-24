# Revue de code

Lot 7, comptabilité et exports. Revue complète le 2026-11-24, six contrôles, sur le diff depuis
`origin/staging`.

## Fichiers relus

```text
17d67e16fcfcbf3c5846798de2569bf29a0d83f7  apps/api/src/app.module.ts
f564c135c2ee9264869c4782de11cd56e3d6c153  apps/api/src/modules/accounting/accounting.controller.ts
bb321575974abb62fd706ef37a1475b2e3717f33  apps/api/src/modules/accounting/accounting.module.ts
87d9247d9ef52fbe5f93866ada5a172b2c02709a  apps/api/src/modules/accounting/accounting.queries.ts
701dc3c77aa136fab55decec99c5c0e64e774bc9  apps/api/src/modules/accounting/contracts/accounting.contract.ts
e0419231ad404d539dd1f07ac8f7e5065d565f0e  apps/api/src/modules/accounting/contracts/expense.contract.ts
9cb920bedfe1d18a98537f8a986dac68ff7f867b  apps/api/src/modules/accounting/contracts/period.contract.ts
843cfd383c096682b398bcf60c0126721eaa0806  apps/api/src/modules/accounting/csv.util.ts
792f92dfc6cfb2d19c89cfeae88ec7bd5680cdc4  apps/api/src/modules/accounting/entities/expense.entity.ts
d23de032d56f0adbb1ae7734ac86f07e7f4374b2  apps/api/src/modules/accounting/expense.mapper.ts
2ca5682e6c53f205bee3d36d9842c71e507bd256  apps/api/src/modules/accounting/expenses.service.ts
ff3660c52aec7dd4473c403a20f1e3fa5678f581  apps/api/src/modules/accounting/exports.service.ts
a07d17f9529938f06608dd4989073e85bb282b89  apps/api/src/modules/accounting/period.util.ts
9c0a84e1dde1e03b4c1385c61741543ff609e3d2  apps/api/src/modules/accounting/profit-and-loss.service.ts
dd1d2ffc0e72ac1ca511b7aded1628deaf3f2a40  apps/api/src/modules/accounting/tests/accounting-test-data.ts
251e9a7c22bf20365e1d32b1d75fa75721479943  apps/api/src/modules/accounting/tests/csv.util.spec.ts
1843ac7aaf215caa51956271fab3004f055e4f45  apps/api/src/modules/accounting/tests/expenses.controller.e2e-spec.ts
d0148daafdb4065abbe9feaebc89b24fbe283d8e  apps/api/src/modules/accounting/tests/exports.controller.e2e-spec.ts
dcfb5cb2fee8ddd2a5a006c45d6a08467062a3c3  apps/api/src/modules/accounting/tests/period.util.spec.ts
df00e8d8c74ab6fb5a084e49ae6ff7b9863bc481  apps/api/src/modules/accounting/tests/profit-and-loss.controller.e2e-spec.ts
2bea5fb8b2102156643d8c36e783389092b8b44f  apps/api/src/modules/db/migrations/Migration20261124151128.ts
55363697a1b63e7277231b1399e5d643740221e6  apps/api/src/seeders/e2e.seeder.ts
8e373a9581a901f4e0dcf7be45ad615d4495ad6a  apps/web-spa-e2e/tests/accounting.spec.ts
75022071c2586d6f51d5df85960b5e1033201ce8  apps/web-spa-e2e/tests/nav-smoke.spec.ts
eb90e1d23c6b92311c312256eebf6c998751bef9  apps/web-spa/app/features/admin-accounting/components/cancel-expense-dialog.tsx
534a45fab4abfad065ddc07552eb468c4ed44cd6  apps/web-spa/app/features/admin-accounting/components/expenses-page.tsx
54c2b7f55d0f7d88ed572720b2bbc9d4bd31ea20  apps/web-spa/app/features/admin-accounting/components/period-picker.tsx
c1dfaeb47cc711507edd110bc9dd2d90da61950e  apps/web-spa/app/features/admin-accounting/components/profit-and-loss-page.tsx
25cbc96d2ea282526a43104cf05f6c2c9d73cf4d  apps/web-spa/app/features/admin-accounting/components/record-expense-dialog.tsx
4084aefb1ba51b057a250dea92a9c0e910a52a25  apps/web-spa/app/features/admin-accounting/hooks/use-period.ts
1787709a403a367bbb490ab8710c8d7fc4598b7b  apps/web-spa/app/features/admin-accounting/utils/accounting-format.ts
04c6e32be52123727b2f5f412c1297e73420f9ff  apps/web-spa/app/features/admin-accounting/utils/admin-accounting-queries.ts
4bf11acc4089e466085c958f07d8bfb145ff49c5  apps/web-spa/app/features/admin-accounting/utils/expense-form.ts
4909de8f8a37a986950078723efc50ea6d88c12c  apps/web-spa/app/features/common/components/back-office-layout.tsx
539e71c1920c34ab74e9a0c77b5b5109c2c0a7ae  apps/web-spa/app/lib/i18n/locales/en/common.locales.en.json
21c03c41d23659c642dfea2ab98ac08382795cf7  apps/web-spa/app/lib/i18n/locales/fr/common.locales.fr.json
3995b59bc0fd47dfeb15bfee356898016d3968f9  apps/web-spa/app/routes.ts
```

## Règles métier et tests

- [ ] apps/api/src/modules/accounting/expenses.service.ts:83 — Le `catch` qui transforme une violation d'unicité en `already_cancelled` (deux admins qui annulent en même temps) n'est atteint par aucun test : le test d'index reçoit son refus du `count` placé avant. Correction : ajouter `apps/api/src/modules/accounting/tests/expenses.service.spec.ts` avec un test où le `count` répond 0 alors qu'une annulation existe, puis vérifier `already_cancelled` et une seule ligne d'annulation.
- [ ] apps/api/src/modules/accounting/tests/expenses.controller.e2e-spec.ts:284 — Le test du jour d'annulation lit l'horloge réelle au lieu de passer `now` : il ne prouve pas qu'une annulation à 23:30 UTC compte le lendemain à Paris, et il peut échouer autour de minuit. Correction : dans `tests/expenses.service.spec.ts`, appeler `cancel` avec `now: 2026-03-31T22:30:00Z` et vérifier `spentOn === '2026-04-01'`, puis un cas en heure d'hiver.
- [ ] apps/api/src/seeders/e2e.seeder.ts:128 — La porte fermée « le seeder E2E n'écrit aucune annulation » n'est vérifiée qu'à la main, alors que l'étape 3 est cochée. Correction : dans `apps/web-spa-e2e/tests/accounting.spec.ts`, après la remise à zéro, vérifier 0 `expense-reason` et 0 `expense-cancelled-badge`.
- [ ] apps/web-spa-e2e/tests/accounting.spec.ts:73 — Critère `screens-for-admin` : aucun test ne change la période ; le compte de résultat n'est lu que sur l'année par défaut. Correction : choisir une période sans aujourd'hui avec `period-from`/`period-to`, vérifier `pnl-expenses-total` à `0.00 €` et l'URL `?from=&to=`.
- [ ] apps/web-spa-e2e/tests/accounting.spec.ts:101 — Critère `screens-for-admin` : un seul des cinq exports est téléchargé dans le navigateur. Correction : boucler sur les cinq boutons et vérifier le nom du fichier et l'en-tête.
- [ ] apps/api/src/modules/accounting/tests/expenses.controller.e2e-spec.ts:105 — Ce test et celui de la ligne 194 lancent deux requêtes en parallèle (`Promise.all`), ce qui a déjà donné `ECONNRESET` dans ce lot (une seule connexion de test). Correction : appeler les routes l'une après l'autre.
- [ ] apps/api/src/modules/accounting/tests/ — Pas de `expenses.service.spec.ts` ni de `expense.mapper.spec.ts`, contrairement aux autres modules (backend.mdx, « Write unit tests for services »). Correction : les ajouter ; le mapper vérifie `isCancelled`, `cancelledByExpenseId` et `hasMore`.
- [ ] apps/web-spa/app/features/admin-accounting/components/profit-and-loss-page.tsx:143 — Ajout hors spec : une note dit que l'argent des porte-monnaie n'est pas sur le compte de résultat ; personne ne l'a validée. Correction : la valider dans « Corrections at the reading », ou la retirer.

## Principes et sécurité

- [ ] apps/web-spa/app/features/admin-accounting/utils/admin-accounting-queries.ts:77 — L'URL du fichier est révoquée juste après `anchor.click()` ; Safari, et Firefox parfois, peuvent produire un fichier vide. Même défaut déjà dans `purchasing-queries.ts:83`. Correction : révoquer plus tard (`setTimeout`), dans un utilitaire commun aux deux exports.

## Duplication

- [ ] apps/api/src/modules/accounting/csv.util.ts:10 — La protection contre les formules et la mise entre guillemets copient `csvCell` de `apps/api/src/modules/purchasing/purchasing.mapper.ts:35`, et les deux écrivains divergent déjà (fin de ligne, guillemets). Correction : déplacer `toCsv` dans `apps/api/src/common/csv.util.ts` et l'utiliser dans `PurchasingMapper.toExport`.
- [ ] apps/api/src/modules/accounting/exports.service.ts:180 — Les jointures copient la constante `SALE_LINES_FROM` de `accounting.queries.ts:10`, faite pour que le compte de résultat et les exports ne divergent pas. Correction : écrire `from ${SALE_LINES_FROM}`.
- [ ] apps/api/src/modules/accounting/accounting.queries.ts:20 — `'distribution'` et `'distribution_reversal'` sont recopiés de `STOCK_MOVEMENT_REASONS`. Correction : des constantes typées (`satisfies StockMovementReason`).
- [ ] apps/api/src/modules/accounting/profit-and-loss.service.ts:43 — L'appel `getConnection().execute(...)` est écrit à la main alors que `sum` (ligne 73) et `ExportsService.query` l'enveloppent déjà. Correction : un helper privé `query<T>`, et `sum` construit dessus.
- [ ] apps/web-spa/app/features/admin-accounting/utils/admin-accounting-queries.ts:72 — Le code de téléchargement copie `downloadSupplierOrderExport` (`admin-purchasing/utils/purchasing-queries.ts:78`). Correction : un `downloadFile(fileName, content, type)` dans `features/common/lib/`.
- [ ] apps/web-spa/app/features/admin-accounting/utils/admin-accounting-queries.ts:75 — Le navigateur reconstruit le nom du fichier que le serveur envoie déjà dans `Content-Disposition`. Correction : lire l'en-tête, ou documenter la copie gardée sous le test E2E.
- [ ] apps/web-spa/app/features/admin-accounting/components/cancel-expense-dialog.tsx:57 — Le dialogue copie `ConfirmDialog` (`features/common/components/confirm-dialog.tsx`). Correction : donner à `ConfirmDialog` un `children` et un `confirmDisabled`, puis l'utiliser.
- [ ] apps/web-spa/app/features/admin-accounting/utils/accounting-format.ts:16 — `toDayInput` copie `toDateInput` de `admin-participation/utils/slot-form.ts:59`. Correction : un utilitaire partagé.
- [ ] apps/web-spa/app/features/admin-accounting/hooks/use-period.ts:26 — `setPeriod` copie `updateParams` de `app/hooks/use-list-search-params.ts`. Correction : utiliser `useListSearchParams`.
- [ ] apps/web-spa/app/features/admin-accounting/hooks/use-period.ts:8 — La regex `DAY` copie `zCalendarDay` du client généré. Correction : `zCalendarDay.safeParse`.
- [ ] apps/web-spa/app/features/admin-accounting/components/expenses-page.tsx:55 — Le lien `?from=&to=` est écrit deux fois (copie dans `profit-and-loss-page.tsx:71`). Correction : un helper `periodSearch(period)`.
- [ ] apps/api/src/modules/accounting/tests/profit-and-loss.controller.e2e-spec.ts:33 — L'interface `Pnl` copie `ProfitAndLoss` du contrat, et `exports.controller.e2e-spec.ts:175` la recopie. Correction : importer le type du contrat.
- [ ] apps/api/src/modules/accounting/tests/profit-and-loss.controller.e2e-spec.ts:489 — Une `WalletEntry` construite à la main alors que `insertWalletEntry` existe. Correction : appeler le helper.
- [ ] apps/api/src/modules/accounting/tests/expenses.controller.e2e-spec.ts:390 — L'annulation construite à la main (ici et ligne 372) copie `insertExpenseCancellation`. Correction : appeler le helper.
- [ ] apps/web-spa-e2e/tests/accounting.spec.ts:37 — L'enregistrement d'une dépense copie `recordExpenseOnScreen` (ligne 13). Correction : un `method` optionnel sur le helper.

## Conventions

- [ ] apps/api/src/modules/accounting/entities/expense.entity.ts:67 — Pas d'`updatedAt`, alors que la constitution (« Data rules ») le demande ; l'écart, voulu pour une ligne append-only, n'est pas écrit dans la spec (« Governance »). Correction : l'écrire dans la spec, comme pour `WalletEntry`.
- [ ] apps/api/src/modules/accounting/expenses.service.ts:114 — `row.cancelsExpense!.id` fait taire le compilateur (constitution, « Full-Stack Type Safety »). Correction : un filtre qui affine le type.
- [ ] apps/api/src/modules/accounting/profit-and-loss.service.ts:27 — Le service renvoie le contrat que le contrôleur expose tel quel, sans mapper (constitution, « Module Boundaries » ; backend.mdx, « Services »). Correction : un type interne et un mapper.
- [ ] apps/api/src/modules/accounting/contracts/accounting.contract.ts:5 — `expensesByCategoryItemSchema` n'exporte pas son type déduit (constitution, « Full-Stack Type Safety »). Correction : `export type ExpensesByCategoryItem`.
- [ ] apps/api/src/modules/accounting/contracts/period.contract.ts:5 — `calendarDaySchema` n'exporte pas son type déduit. Correction : `export type CalendarDay`.
- [ ] apps/api/src/modules/accounting/exports.service.ts:136 — Les cinq lecteurs privés n'ont pas de type de retour (general.mdx, « Basic Principles »). Correction : une interface nommée pour `{ header, rows }`.
- [ ] apps/api/src/modules/accounting/expenses.service.ts:89 — `toAlreadyCancelledRefusal()` sans type de retour. Correction : `: ConflictException`.
- [ ] apps/api/src/modules/accounting/accounting.controller.ts:48 — `list`, `record`, `cancel` et `getProfitAndLoss` sans type de retour. Correction : les déclarer.
- [ ] apps/web-spa/app/features/admin-accounting/utils/admin-accounting-queries.ts:30 — Les cinq fonctions sans type de retour. Correction : les déclarer.
- [ ] apps/web-spa/app/features/admin-accounting/hooks/use-period.ts:19 — `usePeriod` sans type de retour. Correction : une interface `UsePeriodResult`.
- [ ] apps/web-spa/app/features/admin-accounting/utils/expense-form.ts:21 — `createExpenseFormSchema` sans type de retour. Correction : le déclarer.

## Commentaires

- [ ] apps/api/src/modules/accounting/accounting.module.ts:11 — Le commentaire commence par « Lot 7 accounting » au lieu de dire ce que fait le module. Correction : « The accounting module: the association expense ledger, the profit-and-loss account and the CSV exports. It owns one table, `expense`, and only reads the tables of the other modules. »
- [ ] apps/api/src/modules/accounting/contracts/accounting.contract.ts:20 — « Sales minus cost of goods sold. » répète le nom. Correction : Supprimer.
- [ ] apps/api/src/modules/accounting/exports.service.ts:82 — Répète la signature de `toTextCell`. Correction : Supprimer.
- [ ] apps/api/src/modules/accounting/exports.service.ts:97 — Cinq lignes qui répètent le code. Correction : « The five CSV exports. They share the period filters and the cost expression of the P&L (`accounting.queries.ts`). »
- [ ] apps/api/src/modules/accounting/expense.mapper.ts:5 — Répète le nom de la classe. Correction : Supprimer.
- [ ] apps/api/src/modules/accounting/period.util.ts:24 — Répète le corps de `formatDay`. Correction : Supprimer.
- [ ] apps/api/src/modules/accounting/period.util.ts:46 — Répète le nom `toParisDay`. Correction : Supprimer.
- [ ] apps/web-spa/app/features/admin-accounting/hooks/use-period.ts:10 — Répète le corps de `yearPeriod`. Correction : Supprimer.
- [ ] apps/web-spa/app/features/admin-accounting/utils/admin-accounting-queries.ts:58 — Répète une règle déjà écrite sur la route et le dialogue. Correction : Supprimer.
- [ ] apps/web-spa/app/features/admin-accounting/utils/admin-accounting-queries.ts:63 — Répète `downloadExport`. Correction : Supprimer.
- [ ] apps/api/src/modules/accounting/tests/exports.controller.e2e-spec.ts:163 — Répète la ligne qui suit. Correction : Supprimer.
- [ ] apps/web-spa-e2e/tests/accounting.spec.ts:7 — Répète `expenseRow`. Correction : Supprimer.

## i18n

- [ ] apps/web-spa/app/features/admin-accounting/components/expenses-page.tsx:103 — La date s'affiche brute (`2026-03-01`), pas au format de la langue comme sur les autres écrans. Correction : la formater avec le helper des autres écrans.
- [ ] apps/web-spa/app/lib/i18n/locales/fr/common.locales.fr.json:864 — « Ce que l'association a dépensé » (et « What the association spent » en anglais) : partout ailleurs, c'est « la coopérative ». Correction : « Ce que la coopérative a dépensé » / « What the cooperative spent ».
- [ ] apps/web-spa/app/lib/i18n/locales/fr/common.locales.fr.json:908 — « Les jours sont lus à l'heure de Paris » est un mot à mot. Correction : « Les dates sont comptées à l'heure de Paris. »
- [ ] apps/web-spa/app/lib/i18n/locales/fr/common.locales.fr.json:864 — « une seconde ligne qui l'annule » (et ligne 892) n'emploie pas le mot comptable. Correction : « une seconde ligne qui la contrepasse ».
