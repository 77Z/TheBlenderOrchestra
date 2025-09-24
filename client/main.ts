const CLIENT_CONFIG_URL = "https://";

interface TopologicalMachine {
	machineName: string;
	address: string;
};

interface ClientConfig {
	orchestratorAddress: string;
	blenderBinary: string;
	topology: TopologicalMachine[];
};

function sleepSync(ms: number) {
	const sab = new SharedArrayBuffer(1024);
	const i32a = new Int32Array(sab);
	Atomics.wait(i32a, 0, 0, ms);
}

async function fetchConfig(url: string): Promise<ClientConfig> {
	while (true) {
		try {
			const response = await fetch(url);
			if (!response.ok)
				throw new Error(`HTTP error! status: ${response.status}`);

			const data = await response.json();

			return data;
		} catch (error) {
			console.error("Failed to fetch data:", error);
			console.log("Retrying in 30 seconds...");

			
			await new Promise((resolve) => setTimeout(resolve, 30000));
		}
	}
}

function canBlenderUseCuda(blenderBinary: string): boolean {

	// Messy impl but it does the job
	const cmd = new Deno.Command(blenderBinary, {
		args: [`-b`, `--python-expr`, `"import bpy; bpy.context.preferences.addons['cycles'].preferences.get_devices(); print('CUDA' in [d.type for d in bpy.context.preferences.addons['cycles'].preferences.devices])"`]
	});

	const { code, stdout } = cmd.outputSync();

	if (code !== 0) throw new Error("Can't determine if blender has cuda support");

	if (new TextDecoder().decode(stdout).includes("True"))
		return true;

	return false;
}

const config: ClientConfig = await fetchConfig(CLIENT_CONFIG_URL);

const cudaSupported = canBlenderUseCuda(config.blenderBinary);

// const ws = new WebSocket("ws://" + config.orchestratorAddress);


console.log(cudaSupported);