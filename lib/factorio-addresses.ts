import { execFile } from "node:child_process";
import { isIPv4 } from "node:net";
import { homedir, networkInterfaces } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export async function factorioAddresses() {
  const [route, log] = await Promise.allSettled([
    run("/sbin/route", ["-n", "get", "default"], { timeout: 1500 }),
    run(
      "/usr/bin/tail",
      ["-n", "5000", join(homedir(), "Library/Logs/factorio-server.log")],
      {
        timeout: 2000,
        maxBuffer: 4 * 1024 * 1024,
      },
    ),
  ]);
  const network =
    route.status === "fulfilled"
      ? /^\s*interface:\s*(\S+)/m.exec(route.value.stdout)?.[1]
      : undefined;
  const lan = network
    ? networkInterfaces()[network]?.find(
        (entry) => entry.family === "IPv4" && !entry.internal,
      )?.address
    : undefined;
  const lines = log.status === "fulfilled" ? log.value.stdout : "";
  const host = [
    ...lines.matchAll(/Hosting game at IP ADDR:\(\{[^}]+:(\d+)\}\)/g),
  ].at(-1);
  const port = Number(host?.[1] ?? 34197);
  const currentStartup =
    host?.index === undefined ? "" : lines.slice(host.index);
  const external = [
    ...currentStartup.matchAll(
      /Own address is IP ADDR:\(\{([\d.]+):(\d+)\}\)/g,
    ),
  ].at(-1);
  const externalPort = Number(external?.[2]);
  return {
    local: `127.0.0.1:${port}`,
    lan: lan ? `${lan}:${port}` : null,
    external:
      external &&
      isIPv4(external[1]) &&
      externalPort > 0 &&
      externalPort <= 65535
        ? `${external[1]}:${externalPort}`
        : null,
    port,
  };
}
