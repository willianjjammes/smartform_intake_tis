// FormKit config — TIS Smart Form: Intake
// Genesis theme + Pro plugin + pt-PT locale
// v0.2 (2026-08-29): removidos autocomplete/repeater das Pro features - ADR-101 v0.2
// bloqueia repeater e if no server; nao vale a pena imports que nao usamos.
// Referências: ADR-100 (Vue+FormKit), ADR-101 v0.2 (whitelist server-side)

import { pt } from '@formkit/i18n'
import { generateClasses } from '@formkit/themes'
import { genesisIcons } from '@formkit/icons'
import { createProPlugin, datepicker, dropdown, mask, rating, slider, taglist, toggle, transferlist } from '@formkit/pro'
import type { DefaultConfigOptions } from '@formkit/vue'

// Pro key emitida pelo dashboard FormKit
// NOTA: com CSP restritiva + apenas Pro (sem Enterprise), repeater e `if` sao desactivados
// pelo FormKit (mostra warning "Enterprise license required for restrictive CSP").
// Whitelist server-side (ADR-101 v0.2) rejeita ambos preventivamente.
const proPlugin = createProPlugin('fk-6774fdff0c', {
  datepicker,
  dropdown,
  mask,
  rating,
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
