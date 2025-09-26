// prereqs: sshfs mounted /mnt/remote-blend-files to some remote storage with blend files
//          sshfs mounted /mnt/remote-video-files to some remote storage with video files
//           blender in /opt/blender/blender
//           deno installed

const CLIENT_CONFIG_URL = "https://gist.github.com/77Z/7274de673588cc81af99d272bfb245e1/raw/d4723d76e6e3fefdd0fceb16dafbb0a8e93b61ca/clientConfig.json";

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

function triggerRender(blendFile: string, outputFile: string, useCuda: boolean) {
	const args = [
		`-b`, blendFile,
		`-o`, outputFile,
		`-F`, `FFMPEG`,
		`-a` // render all frames
	];

	if (useCuda) {
		args.push(`--`, `--cycles-device`, `CUDA`);
	}

	const cmd = new Deno.Command("/opt/blender/blender", {
		args: args,
		stdout: "piped",
		stderr: "piped"
	});
	const child = cmd.spawn();

	child.status.then((status) => {
		if (status.code === 0) {
			console.log(`Render of ${blendFile} completed successfully.`);
		} else {
			console.error(`Render of ${blendFile} failed with code ${status.code}.`);
		}

		Deno.removeSync("./currentJob.blend");

		Deno.copyFile(`./${blendFile}.mp4`, `/mnt/remote-video-files/${blendFile}.mp4`);
		Deno.removeSync(`./${blendFile}.mp4`);

		console.log(`Completed work on ${blendFile}`);

		ws.send(JSON.stringify({ type: "requestJob" }));
	});
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

	const cmd = new Deno.Command(blenderBinary, {
		args: [`-b`, `--python-expr`, `import bpy; bpy.context.preferences.addons['cycles'].preferences.get_devices(); print('CUDA' in [d.type for d in bpy.context.preferences.addons['cycles'].preferences.devices])`]
	});

	const { code, stdout } = cmd.outputSync();

	if (code !== 0) throw new Error("Can't determine if blender has cuda support");

	if (new TextDecoder().decode(stdout).includes("True"))
		return true;

	return false;
}

const config: ClientConfig = await fetchConfig(CLIENT_CONFIG_URL);

const cudaSupported = canBlenderUseCuda(config.blenderBinary);

let ws: WebSocket;

const onOpen = (ev: Event) => {
	console.log("Connected to orchestrator");

	ws.send( JSON.stringify({
		type: "register",
		clientType: "worker",
		id: Deno.hostname(),
		advertisesHardwareAcceleration: cudaSupported,
	}));

	console.log("waiting for instructions!");
}

const onMessage = (ev: MessageEvent) => {
	const data = JSON.parse(ev.data);

	switch (data.type) {
		case "startWorking": {
			console.log("Received instruction to start working!");

			// need to request what jobs are available from orchestrator
			ws.send(JSON.stringify({ type: "requestJob" }));

			break;
		}

		case "jobAssigned": {
			console.log("Received job assignment!");

			// need to start working on the assigned job
			const blendFile = data.blendFile;
			console.log(`Starting work on ${blendFile}`);

			Deno.copyFile("/mnt/remote-blend-files/" + blendFile, "./currentJob.blend");

			triggerRender("./currentJob.blend", `./${blendFile}.mp4`, cudaSupported);

			break;
		}
	}
}

while (true) {
	try {
		ws = new WebSocket("ws://" + config.orchestratorAddress + ":8000");
		
		await new Promise((resolve, reject) => {
			ws.onopen = onOpen;
			ws.onmessage = onMessage;
			// should this resolve? probably
			ws.onclose = () => { console.log("Connection to orchestrator closed"); reject(new Error("socket connection closed")); };
			ws.onerror = () => reject(new Error("socket connection failed"));
		});
		
		break; // Connection successful, exit loop
	} catch (error) {
		console.error("socket connection failed:", error);
		console.log("Retrying in 20 seconds...");
		await new Promise((resolve) => setTimeout(resolve, 20000));
	}
}

console.log(cudaSupported);