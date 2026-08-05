import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mode = process.argv[2] === "start" ? "start" : "dev";
const basePort = readPort(process.env.PORT) ?? 3002;
const host = process.env.HOSTNAME || undefined;

function readPort(value) {
  if (!value) {
    return undefined;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT debe ser un numero entre 1 y 65535. Valor recibido: ${value}`);
  }

  return port;
}

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, host);
  });
}

async function findAvailablePort(startPort) {
  const maxPort = Math.min(startPort + 100, 65535);

  for (let port = startPort; port <= maxPort; port += 1) {
    if (await canListen(port)) {
      return port;
    }
  }

  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.once("listening", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
        } else {
          reject(new Error("No se pudo detectar un puerto libre."));
        }
      });
    });
    server.listen(0, host);
  });
}

const port = await findAvailablePort(basePort);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const nextArgs = [nextBin, mode, "-p", String(port)];

if (host) {
  nextArgs.push("-H", host);
}

console.log(`Next.js ${mode} en puerto libre: http://localhost:${port}`);

const child = spawn(process.execPath, nextArgs, {
  cwd: projectRoot,
  env: { ...process.env, PORT: String(port) },
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
