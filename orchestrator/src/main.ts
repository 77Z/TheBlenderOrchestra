import { app, BrowserWindow, ipcMain } from "electron";
import { WebSocketServer } from "ws";

let win: BrowserWindow;

const wss = new WebSocketServer({ port: 8080 });

wss.on("listening", () => {
	// document.getElementById("serverStatus")!.innerText = "Orchestrator server online!";
});

wss.on("connection", (ws, request) => {
	console.log("Client connected");

	const clientIP = request.socket.remoteAddress?.replace("::ffff:", "");
	console.log("Client IP:", clientIP);

	ipcMain.emit("client-connected", clientIP);

	ws.on("message", (message) => {
		console.log("Received:", message);
	});

	ws.on("close", () => {
		console.log("Client disconnected");
	});
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
