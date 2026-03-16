import { createApp } from 'vue';
import { Quasar, Notify, Dialog } from 'quasar';
import { createPinia } from 'pinia';

import '@quasar/extras/roboto-font/roboto-font.css';
import '@quasar/extras/material-icons/material-icons.css';
import '@quasar/extras/fontawesome-v6/fontawesome-v6.css';
import quasarIconSet from 'quasar/icon-set/material-icons';

import 'quasar/src/css/index.sass';

import App from './App.vue';
import router from './router';

import { registerSW } from 'virtual:pwa-register';


const app = createApp(App);

app.use(createPinia());
app.use(router);

app.use(Quasar, {
  plugins: { Notify, Dialog },
  iconSet: quasarIconSet,
});
app.mount('#app');

registerSW({
  onRegisteredSW(swScriptUrl) {
    console.log('Service Worker geladen:', swScriptUrl);
  },
  onOfflineReady() {
    console.log('App ist offline verfügbar!');
  },
});
