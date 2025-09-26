// Server prerequisites
// I expect a working directory at /opt/blender-work
// I expect a working directory at /opt/blender-output
// I expect a working directory at /opt/blender-usb


interface ConnectedNode {
	id: string;
	status: "idle" | "rendering";
	currentTask: string | null;
	advertisesHardwareAcceleration: boolean;
	ws: WebSocket | null;
}

const connectedNodes: Map<string, ConnectedNode> = new Map();

// sets don't have atomic operations :(
// const blendFilesAvailable: Set<string> = new Set();
const blendFilesAvailable: string[] = [];

// periodically check for disconnected nodes and remove them
setInterval(() => {
	connectedNodes.forEach((node) => {
		if (node.ws && node.ws.readyState === WebSocket.CLOSED) {
			connectedNodes.delete(node.id);
			console.log(`Removed disconnected node: ${node.id}`);
		}
	});
}, 3000);

Deno.serve((req, connectionInfo) => {
	if (req.headers.get("upgrade") != "websocket") {
		return new Response(null, { status: 426 });
	}

	const { socket, response } = Deno.upgradeWebSocket(req);

	socket.addEventListener("open", () => {
		console.log("a client connected!");
	});

	socket.addEventListener("message", (event) => {
		try {
			const data = JSON.parse(event.data);
			switch (data.type) {
				case "register": {
					console.log("Client Registering...");

					if (data.clientType == "UI") {
						console.log("UI layer connected");
					} else if (data.clientType == "worker") {
						console.log("Worker node connected");

						const node: ConnectedNode = {
							id: data.id,
							status: "idle",
							currentTask: null,
							advertisesHardwareAcceleration:
								data.advertisesHardwareAcceleration,
							ws: socket,
						};
						connectedNodes.set(data.id, node);
					}
					break;
				}

				// Worker functions
				case "requestJob": {
					if (blendFilesAvailable.length == 0) {
						console.log("No blend files available to assign, not sending anything");
						break;
					}

					console.log("Assigning job to worker");

					// ATOMIC OPERATION!! Very important
					const firstFile = blendFilesAvailable.shift();
					
					socket.send(
						JSON.stringify({
							type: "jobAssigned",
							blendFile: firstFile,
						}),
					);

					break;
				}
				case "jobComplete": {
					break;
				}

				// UI functions
				case "pollSystemStatus": {
					const status = Array.from(connectedNodes.values()).map((node) => ({
						id: node.id,
						status: node.status,
						currentTask: node.currentTask,
						advertisesHardwareAcceleration:
							node.advertisesHardwareAcceleration,
					}));
					socket.send(
						JSON.stringify({ type: "systemStatus", status: status, blendFilesAvailable: blendFilesAvailable }),
					);
					break;
				}

				case "pullFromUSB": { pullFromUSB(); break; }

				case "startCompute": {
					console.log("Crushing all nodes!");

					connectedNodes.forEach((node) => {
						if (node.status === "idle" && node.ws && node.ws.readyState === WebSocket.OPEN) {
							node.ws.send(JSON.stringify({ type: "startWorking" }));
							node.status = "rendering";
							node.currentTask = "exampleTaskId";
						}
					});

					break;
				}

				default:
					console.log("Unknown message type:", data.type);
			}
		} catch (error) {
			console.error("Malformed packet from client:", error);
		}
	});

	return response;
});


function findAUSBDrive(): string | null {
	new Deno.Command("bash", {
		args: ["-c", `lsblk -p -S | grep "usb" | awk '{print $1}'`],
		stdout: "piped",
	}).output().then(({ code, stdout, stderr }) => {
		if (code !== 0) {
			console.error("Error finding USB drive:", new TextDecoder().decode(stderr));
			return null;
		}

		const output = new TextDecoder().decode(stdout).trim();
		if (output) {
			// Return the first found mount point
			return output.split("\n")[0];
		} else {
			return null;
		}
	});

	return null;
}

async function copyBlendFilesFromUSB(usbMountPoint: string) {
	try {
		const sourceDir = usbMountPoint;
		const destDir = "/opt/blender-work";

		// Ensure destination directory exists
		// await Deno.mkdir(destDir, { recursive: true });

		for await (const dirEntry of Deno.readDir(sourceDir)) {
			if (dirEntry.isFile && dirEntry.name.endsWith(".blend")) {
				const sourcePath = `${sourceDir}/${dirEntry.name}`;
				const destPath = `${destDir}/${dirEntry.name}`;

				await Deno.copyFile(sourcePath, destPath);
				blendFilesAvailable.push(dirEntry.name);
				console.log(`Copied ${dirEntry.name} to working directory.`);
			}
		}
	} catch (error) {
		console.error("Error copying blend files from USB:", error);
	}
}

function pullFromUSB() {
	const usbDrive = findAUSBDrive();

	if (!usbDrive) {
		console.error("---------------------------");
		console.error("    No USB drive found.");
		console.error("---------------------------");
		return;
	}

	mountUSBDrive(usbDrive).then((mountPoint) => {
		if (mountPoint) {
			copyBlendFilesFromUSB(mountPoint).then(() => {
				// Unmount after copying
				new Deno.Command("udisksctl", { args: ["unmount", mountPoint] }).output().then(({ code, stderr }) => {
					if (code !== 0) {
						console.error("Error unmounting USB drive:", new TextDecoder().decode(stderr));
					} else {
						console.log("USB drive unmounted successfully.");
					}
				});
			});
		}
	});
}

async function mountUSBDrive(usbDevice: string): Promise<string | null> {
	let mountPoint = ""; // unknown still
	try {
		const { code, stdout, stderr } = await new Deno.Command("udisksctl", { args: ["mount", "-b", `${usbDevice}1`] }).output();
		if (code !== 0) {
			console.error("Error mounting USB drive:", new TextDecoder().decode(stderr));
			return null;
		}
		mountPoint = new TextDecoder().decode(stdout).trim().split(" at ")[1];
		console.log(`USB drive mounted at ${mountPoint}`);
		return mountPoint;
	} catch (error) {
		console.error("Error creating mount point:", error);
		return null;
	}
}