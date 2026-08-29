import { createApp } from 'vue'
import { plugin, defaultConfig } from '@formkit/vue'
import '@formkit/themes/genesis'
import './theme.css'
import App from './App.vue'
import formKitConfig from './formkit.config'

createApp(App).use(plugin, defaultConfig(formKitConfig)).mount('#app')
