import { formatEuros } from './_components/format-euros'
import { EmailLayout, EmailParagraph, type EmailBrand } from './_components/email-layout'
import { emailSamples, PREVIEW_BRAND } from './email-samples'

export interface UnderpaidTopupAdminEmailData {
  memberName: string
  membershipNumber: string
  requestedCents: number
  paidCents: number
  topupId: string
}

export default function UnderpaidTopupAdmin({
  brand,
  memberName,
  membershipNumber,
  requestedCents,
  paidCents,
  topupId,
}: { brand: EmailBrand } & UnderpaidTopupAdminEmailData) {
  return (
    <EmailLayout brand={brand} preview={`Paiement incomplet : ${memberName}`}>
      <EmailParagraph>
        {`${memberName} (adhérent n° ${membershipNumber}) a payé ${formatEuros(paidCents)} pour un rechargement de ${formatEuros(requestedCents)}.`}
      </EmailParagraph>
      <EmailParagraph>
        {`Rien n'a été crédité et le rechargement reste en attente (${topupId}). Il faut le suivre avec le payeur et dans l'espace HelloAsso.`}
      </EmailParagraph>
    </EmailLayout>
  )
}

UnderpaidTopupAdmin.PreviewProps = {
  brand: PREVIEW_BRAND,
  ...emailSamples.underpaidTopupAdmin,
}
