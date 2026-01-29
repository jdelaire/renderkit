import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { hydrateStore, startPersistence } from "./state/store";

async function bootstrap() {
  await hydrateStore();
  startPersistence();
  createApp(App).mount("#app");
}

bootstrap();
