import { spawn } from "child_process";

const script1 = spawn("ts-node", ["./src/server.ts"]);
const script2 = spawn("ts-node", ["./src/main.ts"]);

script1.stdout.pipe(process.stdout);
script2.stdout.pipe(process.stdout);

script1.on("close", (code) => {
  console.log(`Script 1 exited with code ${code}`);
});

script2.on("close", (code) => {
  console.log(`Script 2 exited with code ${code}`);
});
