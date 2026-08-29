// FormKit config — TIS Smart Form: Intake
// Genesis theme + Pro plugin + pt-PT locale
// Referências: ADR-100 (Vue+FormKit), ADR-101 (whitelist server-side)

import { pt } from '@formkit/i18n'
import { generateClasses } from '@formkit/themes'
import { genesisIcons } from '@formkit/icons'
import { createProPlugin, autocomplete, colorpicker, datepicker, dropdown, mask, rating, repeater, slider, taglist, toggle, transferlist } from '@formkit/pro'
import type { DefaultConfigOptions } from '@formkit/vue'

// Pro key emitida pelo dashboard FormKit
const proPlugin = createProPlugin('fk-6774fdff0c', {
  autocomplete,
  colorpicker,
  datepicker,
  dropdown,
  mask,
  rating,
  repeater,
  slider,
  taglist,
  toggle,
  transferlist,
})

const config: DefaultConfigOptions = {
  locales: { pt },
  locale: 'pt',
  icons: { ...genesisIcons },
  plugins: [proPlugin],
  // Classes automáticas via genesis theme; override extra em theme.css
  config: {
    classes: generateClasses({
      global: {
        outer: 'formkit-outer',
        label: 'formkit-label',
        inner: 'formkit-inner',
        input: 'formkit-input',
        help: 'formkit-help',
        messages: 'formkit-messages',
        message: 'formkit-message',
      },
    }),
  },
}

export default config
