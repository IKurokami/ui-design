import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './app/App.vue'
import { router } from './app/router'
import { configureAuthAdapter } from './features/auth/services/auth.service'
import { createHttpAuthAdapter } from './features/auth/services/http-auth.adapter'
import './styles/tokens.css'
import './styles/global.css'

// 1. Configure the real HTTP Auth Adapter
configureAuthAdapter(createHttpAuthAdapter())

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// The initial route guard restores the cookie session before choosing a page.
router.isReady().then(() => app.mount('#app'))
