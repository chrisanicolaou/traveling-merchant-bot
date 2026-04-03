import { spawn } from "node:child_process";

const composeArgs = ["compose", "-f", "docker-compose.local.yaml"];
const containerName = "postgres";
const timeoutMs = 30_000;
const pollIntervalMs = 1_000;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

function runCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} exited with code ${code}\n${stderr.trim()}`,
        ),
      );
    });
  });
}

async function waitForHealthyContainer() {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const status = await runCapture("docker", [
        "inspect",
        "--format",
        "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}",
        containerName,
      ]);

      if (status === "healthy" || status === "running") {
        return;
      }
    } catch {
      // The container may not exist yet on the first few polls.
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Timed out after ${timeoutMs / 1000}s waiting for ${containerName} to become healthy.`,
  );
}

await run("docker", [...composeArgs, "up", "-d", "postgres"]);
await waitForHealthyContainer();
