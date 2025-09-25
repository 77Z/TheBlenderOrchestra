import { ipcRenderer } from "electron";

// keep copy of client configuration here?

ipcRenderer.on("client-connected", (e, clientIP) => {

});