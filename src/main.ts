import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource-variable/source-serif-4/opsz.css";
import "@fontsource-variable/source-serif-4/opsz-italic.css";
import "./app.css";

import { mount } from "svelte";
import App from "./App.svelte";

const target = document.getElementById("app");
if (!target) throw new Error("Thiếu phần tử #app");

export default mount(App, { target });
