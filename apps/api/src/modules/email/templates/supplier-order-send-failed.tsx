import { EmailButton } from './_components/email-button'
import {
  EmailLayout,
  EmailLinkFallback,
  EmailParagraph,
  type EmailBrand,
} from './_components/email-layout'
import { emailSamples, PREVIEW_BRAND } from './email-samples'

export interface SupplierOrderSendFailedEmailData {
  supplierName: string
  orderId: string
  /** The day the order was created, as French text. Left out when unknown. */
  orderDay?: string
  mode: 'automatic' | 'manual'
  reason: 'no_address' | 'mail_error'
  /** The back-office address of the order, absolute. */
  orderUrl: string
}

export default function SupplierOrderSendFailed({
  brand,
  supplierName,
  orderId,
  orderDay,
  mode,
  reason,
  orderUrl,
}: { brand: EmailBrand } & SupplierOrderSendFailedEmailData) {
  const created = orderDay ? ` du ${orderDay}` : ''
  const how = mode === 'automatic' ? "l'envoi automatique" : "l'envoi à la main"
  const why =
    reason === 'no_address'
      ? "le fournisseur n'a pas d'adresse e-mail"
      : "le serveur d'e-mail a refusé le message"
  return (
    <EmailLayout brand={brand} preview={`Commande non envoyée : ${supplierName}`}>
      <EmailParagraph>
        {`La commande${created} de ${supplierName} (${orderId}) n'est pas partie : ${how} a échoué, ${why}.`}
      </EmailParagraph>
      <EmailParagraph>
        La commande reste en brouillon et rien ne sera réessayé tout seul. Il faut la renvoyer à la
        main.
      </EmailParagraph>
      <EmailButton href={orderUrl}>Voir la commande</EmailButton>
      <EmailLinkFallback url={orderUrl} />
    </EmailLayout>
  )
}

SupplierOrderSendFailed.PreviewProps = {
  brand: PREVIEW_BRAND,
  ...emailSamples.supplierOrderSendFailed,
}
