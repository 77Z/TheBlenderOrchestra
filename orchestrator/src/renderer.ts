import { ipcRenderer } from "electron";

// keep copy of client configuration here?

// centralize interfaces??
interface TopologicalMachine {
	machineName: string;
	address: string;
};

interface ClientConfig {
	orchestratorAddress: string;
	blenderBinary: string;
	topology: TopologicalMachine[];
};

function redrawComputeNodes() {
	const nodes = document.getElementById("nodes");

	for () {
		document.createElement("p");
	}
}

ipcRenderer.on("client-connected", (e, clientIP) => {

});