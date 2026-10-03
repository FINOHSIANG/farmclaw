import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import '@/style/reset.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@/style/theme.css'

createApp(App).use(router).mount('#app')
