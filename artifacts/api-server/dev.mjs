import { spawn } from "node:child_process";

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: "inherit",
      shell: true,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

await run("pnpm", ["run", "build"]);
await run("pnpm", ["run", "start"]);
