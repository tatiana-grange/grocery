import { join } from 'node:path'

/** Content id of the logo attached to a mail. The HTML points at it with `cid:`. */
export const EMAIL_LOGO_CID = 'logo@grocery'
export const EMAIL_LOGO_SRC = `cid:${EMAIL_LOGO_CID}`
/** The logo file. The build copies `templates/static/` beside the compiled code. */
export const EMAIL_LOGO_PATH = join(__dirname, 'templates', 'static', 'logo.jpg')
