import { app, BrowserWindow } from "electron";
import { IncomingMessage } from "http";

import { WebSocketServer } from "ws";

let win: BrowserWindow;

const wss = new WebSocketServer({ port: 8080 });


// wss.on("listening", () => {
// 	win?.webContents.send("ws-listening");
// });

wss.on("connection", (ws, request, client: any) => {
	ws.on("error", console.error);

	ws.on("message", (data) => {
		console.log("received: %s", data);
	});

	ws.send("something");
});

const createWindow = () => {
	win = new BrowserWindow({
		width: 800,
		height: 600,
		fullscreen: true,
		webPreferences: {
			contextIsolation: false,
			nodeIntegration: true
		}
	});

	win.loadFile("main.html");
};

app.whenReady().then(() => {
	createWindow();
});
