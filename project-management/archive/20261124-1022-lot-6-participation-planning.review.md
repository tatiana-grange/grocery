# Revue de code

Lot 6, planning de participation. Revue complète du 2026-11-24, base `d3ec13e` (`staging`).
Les pages de doc et le client OpenAPI généré ne sont pas relus.

Tous les points ont été corrigés le même jour, sur la demande de l'humaine (« fix tout »). Choix
faits en corrigeant :

- `updatedAt` : ajouté à `slotSignup` avec sa migration (remplie depuis `createdAt`), plutôt
  qu'une exception dans la constitution.
- « Membre suspendu » : le projet n'a pas ce statut ; le test utilise `terminated` (un membre qui
  a quitté la coopérative), le cas que le plan vise.
- Les messages d'assertion en anglais ne touchent que le code de la feature ; les titres des tests
  navigateur restent en français, comme le reste de la suite.
- Le test « créneaux passés » crée son créneau passé par l'API : le formulaire n'en fait pas.
- Les tests navigateur cherchent l'adhérent par son prénom seul : le parcours profil renomme le
  compte seedé, et la remise à zéro garde les tables de comptes.

Contrôles après correction : lint vert, 604 tests API, 135 tests navigateur.

## Fichiers relus

```text
9d8e4fe951cced51fb2ac5267af533f644ec8537  apps/api/src/app.module.ts
348d8845c92d0ad807f9c0002bf9042c4b741ab5  apps/api/src/modules/db/migrations/Migration20261124093029.ts
e5630205521893bb5fecd88dd8e0768455f0282c  apps/api/src/modules/db/migrations/Migration20261124140000.ts
f22e703b185cc3bf8be041c37b69368673d67f4b  apps/api/src/modules/participation/contracts/slot.contract.ts
8778c456156d026d98facd3eb4a87dc5983477f0  apps/api/src/modules/participation/entities/slot-signup.entity.ts
33f809bb4ea65202fcc5fa906b3df766212df02b  apps/api/src/modules/participation/entities/slot.entity.ts
9041ad17e02c70d9159702a2d955310bf1ffed12  apps/api/src/modules/participation/participation.controller.ts
071fc0d4e022422fe72772b1dc6bf813d7d82e55  apps/api/src/modules/participation/participation.mapper.ts
6ff543384a75a56a17b2d9c48e794a67bae64963  apps/api/src/modules/participation/participation.module.ts
61e9f88eeb577c7e6ecac9e00034972bddfb115d  apps/api/src/modules/participation/participation.service.ts
c686e2a936cf1ed761eda723db8c2e4a24b7fa62  apps/api/src/modules/participation/participation.util.ts
b7fe823d3efc90c10b92cbc91c96f6cd2e13c1c1  apps/api/src/modules/participation/tests/participation.controller.e2e-spec.ts
15716f7929c1a8420751d3fde5e524ef4e0ac7c3  apps/api/src/modules/participation/tests/participation.service.spec.ts
91a99b4e7746d6126d751a8536789911c68fba88  apps/api/src/modules/participation/tests/participation.util.spec.ts
712600b34523f2de989bf7e8907a039f21cbf6ae  apps/api/src/seeders/e2e.fixtures.ts
5e9c762a4499cff8fb9cbcd1d41f7353db452649  apps/api/src/seeders/e2e.seeder.ts
757deac9fc9e53ca494015213e307ee724a33b37  apps/web-spa-e2e/env.ts
2c0fad6005b53626b5cc1d8a44d3bf3486d589b9  apps/web-spa-e2e/fixtures.ts
0d0c4abad49cb5a1f6fca79e4ba08900fef289b4  apps/web-spa-e2e/participation.ts
cc72b7aeab61f9953ca1f929657ceb441b04ee89  apps/web-spa-e2e/tests/nav-smoke.spec.ts
b178cf68ae853fb52772dba760444d81f3de393a  apps/web-spa-e2e/tests/participation-admin.spec.ts
7b2ca8046cee901e614a8ba2bb31efc5497ba6ea  apps/web-spa-e2e/tests/participation-member.spec.ts
525c988aab56c13c3223c40e87cfe9dd03f876bd  apps/web-spa-e2e/tests/wallet-correction.spec.ts
0a0c160f57aeefa53d72d7a0a10ee8cf0be2e7d8  apps/web-spa-e2e/tests/wallet-refund.spec.ts
ef5a9f5d5f70886b7b53731cfccb7a5cb2656562  apps/web-spa/app/features/admin-participation/components/add-member-dialog.tsx
7cfa4b9fd68866d52c7298a6841516892e2137e9  apps/web-spa/app/features/admin-participation/components/cancel-slot-dialog.tsx
4e2e64ccb3fa4e51fde508fb644d0f7e7ccd934b  apps/web-spa/app/features/admin-participation/components/delete-slot-dialog.tsx
95bad4441bada696ae566709fb8d73459f202793  apps/web-spa/app/features/admin-participation/components/slot-detail-page.tsx
fb4b8a3f49d8864b958ef33ad809d27c787b43a3  apps/web-spa/app/features/admin-participation/components/slot-form-dialog.tsx
607352331de1f10fd09d817eb999967908deb500  apps/web-spa/app/features/admin-participation/components/slots-list-page.tsx
af2799e7c652545e3b6c736edb256c326cc51a13  apps/web-spa/app/features/admin-participation/utils/admin-participation-queries.ts
315a210d1b0f66bdf1400579bd20b5d9966be9c4  apps/web-spa/app/features/admin-participation/utils/slot-form.ts
d4c2823972300c5f783f19d3e29ca78b6c519eb1  apps/web-spa/app/features/common/components/back-office-layout.tsx
101873bf6cd236301795e5814fd18062c9ac40ac  apps/web-spa/app/features/common/components/confirm-dialog.tsx
4cc29451a5916118d8a4b09cbe1d637f1657b6b8  apps/web-spa/app/features/common/components/site-header.tsx
4ccc98c8e539030db73687947e0f224dc6b5f3e2  apps/web-spa/app/features/participation/components/leave-dialog.tsx
d86ccb4dbce26628fc3bca0d6d3f32249639eb7d  apps/web-spa/app/features/participation/components/my-signup-row.tsx
d3bfb1b59afd32f126b0c8f29607f7f12deb8402  apps/web-spa/app/features/participation/components/participation-page.tsx
ef37e65ef394d1a5a3e3c249c2d5799bfc1944f6  apps/web-spa/app/features/participation/components/slot-card.tsx
d15e3d92e59b5933dd6389b669ec7da46152f727  apps/web-spa/app/features/participation/utils/participation-format.ts
d21f00eecad52cc066c723309f3bf39ff9a0a8a9  apps/web-spa/app/features/participation/utils/participation-queries.ts
42ac863a4137882fe9503db4d5045527aff72947  apps/web-spa/app/features/participation/utils/participation-refusal.ts
29bfd428e6f7878a5bddc45a82a9a848f7f4fdc8  apps/web-spa/app/lib/i18n/locales/en/common.locales.en.json
a6c4ca9d339dd1b83b8fb5fac6e5e3bc6804bafe  apps/web-spa/app/lib/i18n/locales/fr/common.locales.fr.json
c639155097d38f0e0c6668804b22bfb31d499c71  apps/web-spa/app/routes.ts
```

## Règles métier et tests

- [x] apps/web-spa/app/features/participation/components/my-signup-row.tsx:31 — Quand il est trop tard pour se désinscrire, la ligne dit « Vous pouvez vous désinscrire jusqu'au {{date}} » avec une date déjà passée (clé `participation.leaveUntil`, en et fr, ligne 741). Correction : une phrase au passé dans les deux langues (« Désinscription possible jusqu'au {{date}}, ce délai est passé. »).
- [x] apps/web-spa/app/features/admin-participation/utils/slot-form.ts:39 — Le formulaire refuse une heure de fin avant l'heure de début, même quand les heures sont verrouillées. Un créneau qui passe minuit, créé hors du formulaire, ne peut donc plus voir son libellé ni ses places modifiés depuis l'écran. Limite déjà notée dans la doc du lot 6 (« Not in lot 6 »). Correction : ne pas appliquer cette règle quand les heures sont verrouillées.
- [x] apps/web-spa/app/lib/i18n/locales/en/common.locales.en.json:805 — Le dialogue d'annulation est aussi proposé pour un créneau sans inscrit, et dit alors « 0 members signed up will see it marked as cancelled » (fr : « 0 inscrit le verra… »). Correction : n'afficher cette phrase que s'il y a au moins un inscrit.
- [x] apps/api/src/modules/participation/tests/participation.service.spec.ts:145 — Pas de test pour le cas limite du plan « un admin baisse les places pendant qu'un membre s'inscrit ». Correction : ajouter une course `updateSlot` contre `signUp` sur deux entity managers, et vérifier que les inscrits ne dépassent jamais les places.
- [x] apps/api/src/modules/participation/tests/participation.controller.e2e-spec.ts:150 — Les limites du format d'un créneau ne sont testées que d'un côté : rien ne vérifie qu'une place et un libellé de 120 caractères passent, ni qu'un libellé de 121 est refusé, ni qu'une modification avec un corps invalide répond 400. Correction : compléter le `it.each` de création et ajouter un cas 400 pour la modification.
- [x] apps/api/src/modules/participation/tests/participation.controller.e2e-spec.ts:677 — Pas de test pour « un admin peut inscrire ou retirer un membre suspendu », ni pour une inscription par un admin sur un créneau annulé (`slot_cancelled`). Correction : ajouter les deux cas au bloc « admin acts on a member ».
- [x] apps/api/src/modules/participation/tests/participation.controller.e2e-spec.ts:544 — Le refus 403 pour un membre en attente n'est vérifié que sur deux routes membre sur quatre (pas sur la désinscription ni sur « mes inscriptions »). Correction : ajouter ces deux routes au `Promise.all`.
- [x] apps/api/src/modules/participation/tests/participation.controller.e2e-spec.ts:795 — Pas de test pour le choix du plan « un créneau commencé mais pas fini reste dans mes inscriptions ». Correction : ajouter ce cas, avec `canLeave: false`.
- [x] apps/web-spa-e2e/tests/participation-admin.spec.ts:44 — Aucun test navigateur ne couvre l'inscription d'un membre par un admin, la modification réussie d'un créneau, ni le bouton « Afficher les créneaux passés ». Correction : ajouter au moins les deux premiers parcours dans ce fichier.

## Principes et sécurité

- [x] apps/api/src/modules/participation/entities/slot-signup.entity.ts:32 — `SlotSignup` a `createdAt` mais pas `updatedAt`, alors que la constitution (« Data rules ») demande les deux sur chaque entité. À noter : la ligne n'est jamais modifiée, et huit autres entités du projet qui ne sont jamais modifiées font de même (`wallet-entry`, `stock-movement`…). Correction : ajouter le champ et sa migration, ou inscrire cette exception (lignes jamais modifiées) dans la constitution.

Contrôle d'accès, verrous, injection et données privées : aucun point.

## Duplication

- [x] apps/api/src/modules/participation/participation.service.ts:310 — `getMemberForUser` recopie `MembersService.getMemberByUserId` (members.service.ts:111). Correction : importer `MembersModule` et appeler ce service.
- [x] apps/api/src/modules/participation/participation.mapper.ts:8 — `PageWindow` et `PageRequest` (service.ts:26) redéfinissent `SlotPagination` du contrat. Correction : utiliser `SlotPagination` et supprimer les deux interfaces.
- [x] apps/api/src/modules/participation/participation.service.ts:204 — La conversion d'un `Slot` en faits pour les règles est écrite à la main quatre fois (service.ts:204 et 270, mapper.ts:20 et 90). Correction : un seul helper `toSlotFacts(slot)` dans participation.util.ts.
- [x] apps/api/src/modules/participation/participation.service.ts:343 — La règle « le créneau est fini » et son message existent en trois copies (`assertNotEnded`, util.ts:40 et :57). Correction : un `hasEnded(slot, now)` dans participation.util.ts et un seul message.
- [x] apps/api/src/modules/participation/participation.util.ts:75 — `doRangesOverlap` n'est appelé par aucun code de production ; la vraie règle est le filtre SQL (service.ts:248), déjà testé. Correction : supprimer la fonction et ses tests.
- [x] apps/api/src/modules/participation/tests/participation.controller.e2e-spec.ts:30 — `uniqueEmail` est copié du test des recharges, alors que `createUserData` génère déjà un e-mail unique (aussi dans participation.service.spec.ts:36). Correction : ne plus passer d'e-mail et supprimer ces helpers.
- [x] apps/api/src/modules/participation/tests/participation.controller.e2e-spec.ts:106 — `memberRowOf` relit en base des membres que `createMemberData` a déjà renvoyés. Correction : garder ces membres dans des variables et supprimer `memberRowOf`.
- [x] apps/web-spa/app/features/admin-participation/utils/slot-form.ts:5 — `MAX_PLACES` et `MAX_LABEL_LENGTH` sont recopiés à la main ; 120 l'est aussi dans slot-form-dialog.tsx:120 et dans le message `adminParticipation.form.error.roleLabel`. Correction : lire les bornes depuis `zSlotInput` du client généré, et passer `{{max}}` au message.
- [x] apps/web-spa/app/features/participation/components/leave-dialog.tsx:46 — Trois dialogues de confirmation ont le même balisage (leave, cancel-slot, delete-slot). Correction : un seul composant de confirmation, ou la primitive `AlertDialog` de packages/ui.
- [x] apps/web-spa/app/features/admin-participation/components/slot-form-dialog.tsx:88 — L'invalidation des deux clés de requête est recopiée cinq fois. Correction : une fonction `invalidateParticipation(queryClient)` dans admin-participation-queries.ts.
- [x] apps/web-spa/app/features/participation/components/slot-card.tsx:26 — Le texte « jour, heures » est assemblé à la main trois fois (aussi my-signup-row.tsx:28 et slot-detail-page.tsx:66). Correction : un `formatSlotWhen` dans participation-format.ts.
- [x] apps/web-spa-e2e/tests/participation-admin.spec.ts:61 — Les sélecteurs de carte et de ligne « mes inscriptions » recopient `slotCard` et `mySignup` du test membre. Correction : les déplacer dans apps/web-spa-e2e/participation.ts.
- [x] apps/web-spa-e2e/tests/participation-admin.spec.ts:28 — `memberPage` est une troisième copie du contexte navigateur « membre » (aussi dans wallet-refund et wallet-correction). Correction : un helper `newRolePage(browser, role)` dans apps/web-spa-e2e/fixtures.ts.
- [x] apps/web-spa-e2e/tests/participation-admin.spec.ts:8 — `MEMBER_FIRST_NAME = 'Milo'` recopie le nom du compte seedé (`E2E_USERS.member.name`). Correction : exposer les noms seedés depuis apps/web-spa-e2e/env.ts.

## Conventions

- [x] apps/api/src/modules/participation/participation.mapper.ts:34 — `toAdminSlotList`, `toMemberSlotList`, `toMySignupList` et `toMeta` ne déclarent pas de type de retour (general.mdx, « Basic Principles »). Correction : exporter les types `z.infer` des schémas de liste et les déclarer.
- [x] apps/api/src/modules/participation/participation.mapper.ts:41 — `toMemberSlotList` et `toMySignupList` prennent quatre paramètres positionnels (general.mdx, « Functions » : RO-RO). Correction : un seul objet en paramètre, comme `toProductsList` du catalogue.
- [x] apps/api/src/modules/participation/participation.service.ts:316 — `signUpRefusal`, `removalRefusal` et `now()` ne commencent pas par un verbe (general.mdx, « Specific Naming Patterns »). Correction : `buildSignUpRefusal`, `buildRemovalRefusal`, `getNow`.
- [x] apps/web-spa/app/features/participation/utils/participation-refusal.ts:8 — `participationRefusalMessage` ne commence pas par un verbe. Correction : `getParticipationRefusalMessage`.
- [x] apps/web-spa-e2e/participation.ts:7 — `apiAs` et `slotIdByLabel` ne commencent pas par un verbe. Correction : `createApiContextAs`, `findSlotIdByLabel`.
- [x] apps/web-spa-e2e/participation.ts:19 — Les messages d'assertion des nouveaux tests sont en français, alors que le code doit être en anglais (general.mdx, « General philosophy »). Les anciens tests navigateur font déjà de même. Correction : passer les nouveaux messages en anglais, ou inscrire l'exception dans AGENTS.md.

## Commentaires

- [x] apps/api/src/modules/participation/entities/slot-signup.entity.ts:15 — « in this lot » renvoie au plan. Correction : « The row is deleted when the member leaves or is removed, so no history is kept. The unique pair is the backstop for the one-sign-up rule. »
- [x] apps/api/src/modules/participation/participation.module.ts:10 — Commence par « Lot 6 » et répète le commentaire de `Clock` du service. Correction : supprimer.
- [x] apps/api/src/seeders/e2e.fixtures.ts:84 — Commence par « Lot 6 ». Correction : « Participation fixtures: three slots dated from the seeding moment, so they are always in the future when the suite runs. None holds a sign-up. »
- [x] apps/api/src/seeders/e2e.seeder.ts:485 — Le séparateur nomme « lot 6 ». Correction : « // --- participation: three coming slots, dated from now, with no sign-up --- ».
- [x] apps/api/src/modules/participation/tests/participation.controller.e2e-spec.ts:1 — L'en-tête de 5 lignes répète le nom du fichier et les titres des `describe`. Correction : « /** The clock is real, so slot dates are built relative to now. */ ».
- [x] apps/api/src/modules/participation/tests/participation.controller.e2e-spec.ts:93 — « for the routes that do not exist yet » est périmé. Correction : « /** Sign-ups written straight to the database, to bypass the sign-up rules. */ ».
- [x] apps/api/src/modules/participation/tests/participation.controller.e2e-spec.ts:105 — Répète le nom `memberRowOf`. Correction : supprimer (la fonction part de toute façon avec le point de duplication).
- [x] apps/api/src/modules/participation/participation.util.ts:47 — Les trois dernières lignes redisent les quatre `if` qui suivent. Correction : « /** Whether a sign-up may be removed, or the reason it may not. */ ».
- [x] apps/api/src/modules/participation/participation.service.ts:90 — La phrase sur le créneau annulé redit le commentaire de `cancelSlot`. Correction : « A cancelled slot is never edited. »
- [x] apps/api/src/modules/participation/participation.service.ts:185 — La phrase sur `checkSignUp` redit le commentaire de cette fonction. Correction : supprimer cette phrase.

## i18n

- [x] apps/web-spa/app/lib/i18n/locales/fr/common.locales.fr.json:737 — Le français n'emploie que le masculin (« Vous êtes inscrit », aussi lignes 727, 738, 740, 753, 754), alors que l'app écrit déjà de façon inclusive (« identifié·e », « prévenu·e »). Correction : « inscrit·e » / « désinscrit·e » dans ces six phrases.
- [x] apps/web-spa/app/lib/i18n/locales/en/common.locales.en.json:726 — « My coming sign-ups », « Coming slots », « No coming slot for now. » (lignes 726, 730, 731) sont du mot à mot. Correction : « upcoming ».
- [x] apps/web-spa/app/lib/i18n/locales/fr/common.locales.fr.json:724 — « Les horaires sont ceux de votre navigateur. » (aussi ligne 765) perd le sens de l'anglais et ne dit pas la même chose que le formulaire. Correction : « Les horaires sont affichés dans le fuseau horaire de votre navigateur. »
- Le point « leaveUntil » est rangé dans « Règles métier et tests ».
