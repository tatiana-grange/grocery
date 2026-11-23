# HelloAsso Checkout: research for slice 01 (online top-up)

Date: 2026-11-23. Sources are only the official HelloAsso developer pages. Each page was read through its `.md` version listed in https://dev.helloasso.com/llms.txt. The Swagger UI at https://api.helloasso.com/v5/swagger could not be read (404 on the UI path I tried), so the schemas below come from the API reference pages on dev.helloasso.com, which are built from the same OpenAPI file. The reader tool paraphrased some descriptions. Field names are exact.

Short answer: notifications CAN be signed, but only for partners. Our own project is not shown to be a partner. See section 5.

## 1. Request body of POST checkout-intents

Source: https://dev.helloasso.com/reference/post_organizations-organizationslug-checkout-intents.md

Endpoint: `POST /v5/organizations/{organizationSlug}/checkout-intents`. It uses OAuth2 client credentials. The client needs the Checkout permission.

Required fields (type `InitCheckoutBody`):
- `totalAmount`: integer, cents, taxes included. It must equal `initialAmount` plus the sum of all `terms` amounts.
- `initialAmount`: integer, cents. The first payment.
- `itemName`: string, 1 to 250 characters.
- `backUrl`: string, minimum length 1.
- `errorUrl`: string, minimum length 1.
- `returnUrl`: string, minimum length 1.
- `containsDonation`: boolean.

Optional fields:
- `terms`: array of `{ "amount": int cents, "date": date-time }`, both required inside each term. Nullable.
- `payer`: object. Fields `firstName`, `lastName`, `email` (max 255 each), `dateOfBirth`, `address`, `city`, `zipCode`, `country` (exactly 3 characters), `companyName` (max 255). All nullable.
- `metadata`: free JSON object, at most 20,000 characters. Nullable.
- `paymentOptions`: object with `enableSepa` (boolean).

Our own reference: yes, use `metadata`. The page "Fonctionnement technique" says metadata comes back in payment or order notifications, only when we issued the checkout, and the GET answer also returns it. Source: https://dev.helloasso.com/docs/intégrer-le-paiement-sur-votre-site.md

Example request (the page marks it illustrative):
```json
{
  "totalAmount": 3000,
  "initialAmount": 1000,
  "itemName": "3 tickets",
  "backUrl": "https://example.org/back",
  "errorUrl": "https://example.org/error",
  "returnUrl": "https://example.org/return",
  "containsDonation": false,
  "metadata": { "orderRef": "ABC-42" }
}
```

Caution: the notification examples show a top-level `metadata` that holds only `{ "id": <notification id> }`, not our metadata. See section 5.

## 2. Creation answer

Source: https://dev.helloasso.com/reference/post_organizations-organizationslug-checkout-intents.md

Type `InitCheckoutResponse`:
- `id`: integer. This is the checkout intent id.
- `redirectUrl`: string, nullable. The page to send the payer to.

Error codes listed: 200, 401 (bad or missing Bearer token), 403 (missing privileges), 409 (association not verified). The "Fonctionnement technique" page also lists 400 for bad parameters and 409 when the association cannot receive payments.

## 3. GET checkout-intents/{checkoutIntentId}

Source: https://dev.helloasso.com/reference/get_organizations-organizationslug-checkout-intents-checkoutintentid.md

Type `CheckoutIntentResponse`:
- `id` (integer), `redirectUrl` (string, nullable), `metadata` (object, nullable, present only if we sent it), `order` (type `OrderDetail`).
- The page says the order is returned only when the payment is authorized.

`order` fields: `id`, `date`, `amount` (`total`, `vat`, `discount`, in cents), `payer`, `items[]`, `payments[]`, `formSlug`, `formType`, `organizationName`, `organizationSlug`, `organizationType`, `organizationIsUnderColucheLaw`, `checkoutIntentId`, `meta`. The order has no `state` field.

`order.payments[]` fields: `id`, `amount` (cents), `amountTip` (cents, nullable), `date`, `state`, `type`, `paymentMeans`, `installmentNumber`, `isRefundable`, `cashOutState`, `paymentReceiptUrl`, `refundOperations[]`, `items[]`, `meta`.

Payment `state` values named in the reference: Pending, Authorized, Refused, Registered, Refunded. The full list is on https://dev.helloasso.com/docs/etats-des-paiements.md : Pending, WaitingBankValidation, Authorized, Refused, Unknow (sic), Registered, Refunded, Refunding, Contested.

Example of a paid payment (the page says the JSON is illustrative, built from the schema, not a sample from the docs):
```json
"payments": [{ "id": 999, "amount": 5000, "amountTip": 0, "state": "Authorized", "paymentMeans": "Card" }]
```

Does the paid amount include the voluntary contribution (tip)? Could not verify. The schema has both `amount` ("total payment amount") and a separate `amountTip`, which hints that `amount` is the total and the tip is a part of it, but no page says so. Also the guide page says nothing about it. Do not rely on it. Test in the sandbox.

Unpaid, refused or expired intent: could not verify as distinct values. The validation page says the GET returns `order` only if the order was created and the payment succeeded. So an unpaid intent has no `order`. Source: https://dev.helloasso.com/docs/validation-de-vos-paiements.md . That page says the docs list no separate value for refused or expired. It also says that after 45 minutes with no authorized-payment notification or payment found, the checkout may be treated as abandoned. The states page does not mention expiry or abandon.

## 4. OAuth2 token

Source: https://dev.helloasso.com/docs/getting-started.md and https://dev.helloasso.com/docs/environnements-production-et-sandbox-test.md

- Production URL: `POST https://api.helloasso.com/oauth2/token`
- Sandbox URL: `https://api.helloasso-sandbox.com/oauth2/token` (sandbox page). Sandbox API base: `https://api.helloasso-sandbox.com/v5` (https://dev.helloasso.com/docs/api-overview.md).
- Content type: `application/x-www-form-urlencoded`.
- Client credentials form fields: `client_id`, `client_secret`, `grant_type=client_credentials`.
- Refresh form fields: `grant_type=refresh_token`, `refresh_token`.
- Answer fields: `access_token`, `refresh_token`, `token_type` (always `bearer`), `expires_in` (seconds).
- Access token lifetime: half an hour (1799 seconds). The page forbids requesting a new token on every call.
- Refresh token lifetime: 30 days. Each refresh returns a new refresh token.

## 5. Notifications (Order and Payment)

Sources: https://dev.helloasso.com/docs/notifications-webhook.md , https://dev.helloasso.com/docs/secure-webhook.md , https://dev.helloasso.com/docs/paiement-autorisé-sur-un-checkout.md , https://dev.helloasso.com/docs/commandes-créé-sur-un-paiement-checkout-avec-des-échéances.md , https://dev.helloasso.com/docs/commande-créé-sur-un-formulaire-de-don.md

Shape: `{ "data": { ... }, "eventType": "Payment" | "Order", "metadata": { "id": <number> } }`.
- Payment `data` (from the "Paiement autorisé sur un checkout" example): `id`, `amount` (cents), `date`, `state` ("Authorized"), `paymentMeans`, `installmentNumber`, `cashOutState`, `paymentReceiptUrl`, `payer`, `items[]`, `order` (with `id`, `formType` "Checkout", organization fields), `refundOperations`, `meta`.
- Refund example (https://dev.helloasso.com/docs/paiement-remboursé.md): `eventType` "Payment", `data.state` "Refunded", `data.amount` 2000.
- Top-level `metadata` in the examples holds only `id` (the notification id, example 75698555). It does not hold our metadata in those examples.
- The page for the order with installments says: "vous y trouverez le `checkoutIntentId` ainsi que les metadata envoyés dans l'appel initial". Its example shows `checkoutIntentId` (24768) inside `data`. The validation page also says our metadata comes back in each notification. The exact place of our own metadata inside the JSON is could not verify (the examples I could read do not show it). Check with a real sandbox notification.
- The Payment example I could read does not show `checkoutIntentId`. Could not verify for Payment. The order inside it can be matched later through GET.

Delivery: the receiver must answer HTTP 200. Otherwise HelloAsso retries, interval `min(48h, 3 * 2 ** attempt)`, 16 retries, schedule ends around 27 hours. Up to 5 notification URLs per association or 5 global URLs. Setup is by PUT `/v5/partners/me/api-notifications` (partners) or in the account under "Intégrations et API" (associations).

Signatures: yes, they exist, with limits. Source: https://dev.helloasso.com/docs/secure-webhook.md
- Header: `x-ha-signature`, a hex value.
- Method: HMAC-SHA256 of the raw request body, using the `SignatureKey`, lowercase hex, compared to the header.
- The `SignatureKey` comes back in the answer when a notification URL is set through the partner endpoint PUT `partners/me/api/notifications`. The page says signing is available only to partners.
- IP allow-list given: production 51.138.206.200, test 4.233.135.234.
- If our account is a plain association key (not a partner), no signature key is shown in the docs. Whether it can get one: could not verify. Then the safe design is to treat a notification as a hint only and confirm with GET checkout-intents using our own token. The docs themselves say to validate through the reconciliation process and not to trust return URL parameters.

## 6. Return URLs

Source: https://dev.helloasso.com/docs/intégrer-le-paiement-sur-votre-site.md

- `backUrl`, `errorUrl` and `returnUrl` are all marked "Https uniquement" (HTTPS only).
- http://localhost or http://127.0.0.1 in the sandbox: could not verify. No page mentions localhost. The only http link in the sandbox page is the sandbox website. Test it, and plan for an https tunnel if refused.
- Query parameters on success (`returnUrl`): `checkoutIntentId`, `code` (value `succeeded`), `orderId`. Example from the page: `https://www.partnertest.com/return.php?checkoutIntentId=3&code=succeeded&orderId=462873`.
- Query parameters on technical error (`errorUrl`): `checkoutIntentId`, and `error` when the cause is known.
- `backUrl` gets no documented parameters. It is for a buyer who wants to change the cart.
- The page warns these parameters can be forged and must not prove payment. Source: https://dev.helloasso.com/docs/validation-de-vos-paiements.md

## 7. Redirect URL validity

Source: https://dev.helloasso.com/docs/intégrer-le-paiement-sur-votre-site.md

The page says: "L'URL de redirection a une durée de validité de 15 minutes." Yes, 15 minutes is confirmed.
What happens after 15 minutes: could not verify. The page does not say. The validation page only says a checkout with no payment after 45 minutes may be treated as abandoned.

## 8. Constraints on slug, amounts and terms

- `organizationSlug`: required path string. Described as the lowercase organization name without special characters (https://dev.helloasso.com/reference/get_organizations-organizationslug-checkout-intents-checkoutintentid.md). No other format rule found.
- The association must be verified. Since June 2025 an unverified association gets a 409 on checkout creation. `GET /organizations/{organizationSlug}` returns `isCashInCompliant`, but only to an `OrganizationAdmin` role. A notification `Organization.IsCashinCompliant` is sent on change. Source: https://dev.helloasso.com/docs/guide-dintégration.md
- Minimum amount: could not verify. No page states one.
- Amounts are integers in cents (int32), taxes included.
- `terms`: optional. `totalAmount` must equal `initialAmount` plus the sum of the terms. Each term needs `amount` and `date`. For a one-off top-up, omit `terms` and set `totalAmount` equal to `initialAmount`.
- `metadata` maximum 20,000 characters once serialized.
- Sandbox: the test association must first be validated with fictitious documents before a first payment (https://dev.helloasso.com/docs/environnements-production-et-sandbox-test.md). Sandbox helper endpoints are in the API Toolbox, for example https://dev.helloasso.com/reference/verifyorganization.md .
- Payments through Checkout do not generate tax receipts automatically (guide-dintégration page).
- Refunds: the reference lists `POST /payments/{paymentId}/refund` (https://dev.helloasso.com/reference/post_payments-paymentid-refund.md). I did not read its body. Could not verify the details.
