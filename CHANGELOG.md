# Changelog

## [0.0.4](https://github.com/tatiana-grange/grocery/compare/v0.0.3...v0.0.4) (2026-11-26)


### Added

* **api:** ✨ add association expenses, the profit-and-loss account and five CSV exports ([0336cfc](https://github.com/tatiana-grange/grocery/commit/0336cfc34a7ead42459f6d8b878ebd0f1917c1a7))
* **api:** ✨ add online top-up, payment correction and refunds ([e0adf89](https://github.com/tatiana-grange/grocery/commit/e0adf89aeb75c10a29e36d7f6b467a7afea87730))
* **api:** ✨ distribution, wallet, and the distributor table ([#22](https://github.com/tatiana-grange/grocery/issues/22)) ([d60d559](https://github.com/tatiana-grange/grocery/commit/d60d55900136c2ada66dc745cc685409d15bdf9b))
* **api:** ✨ give members a balance and a ledger, and let staff record their payments ([d60d559](https://github.com/tatiana-grange/grocery/commit/d60d55900136c2ada66dc745cc685409d15bdf9b))
* **api:** ✨ plan participation slots and let members sign up ([8aabe59](https://github.com/tatiana-grange/grocery/commit/8aabe59a560d46c96e4fa59f92e20d54006ae0aa))
* **frontend:** ✨ add the distribution table, and show members their balance ([d60d559](https://github.com/tatiana-grange/grocery/commit/d60d55900136c2ada66dc745cc685409d15bdf9b))
* **frontend:** ✨ add the expenses, profit-and-loss and exports screens to the back office ([0336cfc](https://github.com/tatiana-grange/grocery/commit/0336cfc34a7ead42459f6d8b878ebd0f1917c1a7))
* **frontend:** ✨ add the member participation screen and the back-office slot screens ([8aabe59](https://github.com/tatiana-grange/grocery/commit/8aabe59a560d46c96e4fa59f92e20d54006ae0aa))
* **frontend:** ✨ give every space the neighbourhood market look ([0336cfc](https://github.com/tatiana-grange/grocery/commit/0336cfc34a7ead42459f6d8b878ebd0f1917c1a7))


### Fixed

* **api:** 🐛 align the session and account foreign keys with the database ([dff7c52](https://github.com/tatiana-grange/grocery/commit/dff7c52274c3678d247576ddb8925ad8ff8b472d))


### Documentation

* **tooling:** 📝 close the UI market redesign and apply its retro ([#25](https://github.com/tatiana-grange/grocery/issues/25)) ([6e385dc](https://github.com/tatiana-grange/grocery/commit/6e385dc9a56af5a4a5c0dad077fc425e632b65a6))


### Changed

* **api:** ♻️ share one helper for 409 refusals and refusal messages ([ca6c0e8](https://github.com/tatiana-grange/grocery/commit/ca6c0e8fea1136754bb01ed4d82884a56d4d890f))

## [0.0.3](https://github.com/tatiana-grange/grocery/compare/v0.0.2...v0.0.3) (2026-09-12)


### Added

* **api:** ✨ the shop category endpoint now returns `parentId` and a direct ([d82de31](https://github.com/tatiana-grange/grocery/commit/d82de31f519f899ec06c73d2a6550e1756613439))
* **api:** aggregate pre-orders, receive deliveries, and track stock and cost price ([#15](https://github.com/tatiana-grange/grocery/issues/15)) ([7e9b3dd](https://github.com/tatiana-grange/grocery/commit/7e9b3dd09d564f04c829550cd19966f7ac6659cd))
* **api:** seed a dedicated purchasing supplier with pending pre-orders for the web-spa e2e suite ([7e9b3dd](https://github.com/tatiana-grange/grocery/commit/7e9b3dd09d564f04c829550cd19966f7ac6659cd))
* **frontend:** ✨ a shop you can browse, search, and add to from anywhere ([#18](https://github.com/tatiana-grange/grocery/issues/18)) ([d82de31](https://github.com/tatiana-grange/grocery/commit/d82de31f519f899ec06c73d2a6550e1756613439))
* **frontend:** ✨ selection unit and step fields on the admin product form ([d82de31](https://github.com/tatiana-grange/grocery/commit/d82de31f519f899ec06c73d2a6550e1756613439))
* **frontend:** ✨ show the selection unit on each cart line ([d82de31](https://github.com/tatiana-grange/grocery/commit/d82de31f519f899ec06c73d2a6550e1756613439))
* **frontend:** add a Close action and the received/closed distinction to the supplier order page ([7e9b3dd](https://github.com/tatiana-grange/grocery/commit/7e9b3dd09d564f04c829550cd19966f7ac6659cd))
* **frontend:** add Send and Export actions to the supplier order detail page ([7e9b3dd](https://github.com/tatiana-grange/grocery/commit/7e9b3dd09d564f04c829550cd19966f7ac6659cd))
* **frontend:** add the back-office inventory area (stock list + product stock detail) ([7e9b3dd](https://github.com/tatiana-grange/grocery/commit/7e9b3dd09d564f04c829550cd19966f7ac6659cd))
* **frontend:** add the back-office purchasing area (supplier orders list + detail) ([7e9b3dd](https://github.com/tatiana-grange/grocery/commit/7e9b3dd09d564f04c829550cd19966f7ac6659cd))
* **frontend:** add the line-by-line reception form and reception history to the supplier order page ([7e9b3dd](https://github.com/tatiana-grange/grocery/commit/7e9b3dd09d564f04c829550cd19966f7ac6659cd))


### Documentation

* **tooling:** 📝 add the v0.0.3 release note ([#19](https://github.com/tatiana-grange/grocery/issues/19)) ([3440636](https://github.com/tatiana-grange/grocery/commit/3440636adcbb45f6dd312fdfda80da8c1f06b1a1))
* **tooling:** 📝 settle the agent instructions on one rule set ([#17](https://github.com/tatiana-grange/grocery/issues/17)) ([928bb69](https://github.com/tatiana-grange/grocery/commit/928bb697769a22c2a861c4fbc98da870d6c1be6b))
* **tooling:** 📝 sync the Cursor copies of the shared skills ([928bb69](https://github.com/tatiana-grange/grocery/commit/928bb697769a22c2a861c4fbc98da870d6c1be6b))


### Changed

* **tooling:** ♻️ point Spec-Kit's agent-context writers at CLAUDE.md ([928bb69](https://github.com/tatiana-grange/grocery/commit/928bb697769a22c2a861c4fbc98da870d6c1be6b))

## [0.0.2](https://github.com/tatiana-grange/grocery/compare/v0.0.1...v0.0.2) (2026-09-05)


### Added

* **api:** add the public shop, cart, and checkout ([#14](https://github.com/tatiana-grange/grocery/issues/14)) ([ccbe55f](https://github.com/tatiana-grange/grocery/commit/ccbe55fb60c5516158676013409f751ae33bd789))
* **api:** member lifecycle, access roles, and catalogue foundation (lot 1) ([#7](https://github.com/tatiana-grange/grocery/issues/7)) ([3bc9582](https://github.com/tatiana-grange/grocery/commit/3bc9582526bfcc373de5d4aa65b2bdafb83ce4c9))

## Changelog

This file is generated by [release-please](https://github.com/googleapis/release-please) from conventional squash commits. Do not edit it by hand. Rationale lives in commit bodies (`git show`).
