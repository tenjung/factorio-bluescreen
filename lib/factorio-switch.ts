import { execFile } from "node:child_process";
import { constants } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  utimes,
} from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";
import { loadedWorld } from "./factorio-loaded-world";

const run = promisify(execFile);
const worldName = /^world-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.zip$/;
const label = "com.factorio.server";
let switching = false;

export function reserveFactorioOperation() {
  if (switching) return null;
  switching = true;
  return () => {
    switching = false;
  };
}

export async function preparedWorlds(root: string) {
  const dir = join(root, "data/prepared-worlds");
  const entries = await readdir(dir, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const active = new Set(await readdir(join(root, "data/saves")));
  return entries
    .filter(
      (entry) =>
        entry.isFile() && worldName.test(entry.name) && !active.has(entry.name),
    )
    .map((entry) => entry.name)
    .sort()
    .reverse();
}

export async function switchWorld(
  root: string,
  name: unknown,
  confirmDisconnect: boolean,
  rollbackSource?: string,
) {
  if (typeof name !== "string" || !worldName.test(name))
    throw new Error("Invalid world");
  if (switching) throw new Error("Switch already running");
  switching = true;
  const rcon = async (command: string) =>
    (await run(join(root, "rcon.sh"), [command], { timeout: 2500 })).stdout;
  const controller = (...args: string[]) =>
    run("/bin/launchctl", args, { timeout: 8000 });
  const domain = `gui/${process.getuid?.()}`;
  const service = `${domain}/${label}`;
  const plist = join(homedir(), "Library/LaunchAgents", `${label}.plist`);
  const source = rollbackSource ?? join(root, "data/prepared-worlds", name);
  const saves = join(root, "data/saves");
  const target = join(saves, name);
  const staged = `${target}.pending`;
  const checkpoint = `before-switch-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const log = join(homedir(), "Library/Logs/factorio-server.log");
  let stopped = false;
  let copied = false;
  let started = false;
  let managed = false;
  let stagedCopy = false;
  try {
    if (!rollbackSource && !(await preparedWorlds(root)).includes(name))
      throw new Error("World missing");
    if (
      await stat(target).then(
        () => true,
        (error) => {
          if (error.code === "ENOENT") return false;
          throw error;
        },
      )
    )
      throw new Error("World already present in active saves");
    if (rollbackSource) {
      if (!(await lstat(source)).isFile()) throw new Error("Save missing");
      await copyFile(source, staged, constants.COPYFILE_EXCL);
      stagedCopy = true;
    }
    await run("/usr/bin/unzip", ["-tq", rollbackSource ? staged : source], {
      timeout: 5000,
    });
    const origin = join(root, `${label}.plist`);
    await copyFile(origin, plist, constants.COPYFILE_EXCL).catch((error) => {
      if (error.code !== "EEXIST") throw error;
    });
    if ((await readFile(plist, "utf8")) !== (await readFile(origin, "utf8")))
      throw new Error("Unexpected server service definition");
    const previousLogSize = rollbackSource ? 0 : (await stat(log)).size;
    const online = async () =>
      /^Online players \(0\):/m.test(await rcon("/players online"));
    if (!confirmDisconnect && !(await online()))
      throw new Error("Players still online");
    await rcon(`/save ${checkpoint}`);
    const checkpointFile = join(saves, `${checkpoint}.zip`);
    for (let i = 0; i < 20; i++) {
      const valid = await run("/usr/bin/unzip", ["-tq", checkpointFile], {
        timeout: 1000,
      }).then(
        () => true,
        () => false,
      );
      if (valid) break;
      if (i === 19) throw new Error("Checkpoint verification failed");
      await sleep(250);
    }
    if (!rollbackSource) {
      const archive = join(root, "data/backup", checkpoint);
      await mkdir(archive, { recursive: true, mode: 0o700 });
      for (const file of await readdir(saves, { withFileTypes: true })) {
        if (file.isFile() && file.name.endsWith(".zip")) {
          await copyFile(
            join(saves, file.name),
            join(archive, file.name),
            constants.COPYFILE_EXCL,
          );
        }
      }
    }
    if (!confirmDisconnect && !(await online()))
      throw new Error("Players still online");
    const listening = async () =>
      run("/usr/sbin/lsof", ["-nP", "-t", "-iTCP:27015", "-sTCP:LISTEN"], {
        timeout: 1500,
      }).then(
        () => true,
        (error) => {
          if (error.code === 1) return false;
          throw error;
        },
      );
    managed = await controller("print", service).then(
      () => true,
      () => false,
    );
    if (managed) await controller("bootout", service);
    else await rcon("/quit").catch(() => undefined);
    const locked = () =>
      run("/usr/sbin/lsof", ["-t", join(root, "data/.lock")], {
        timeout: 1500,
      }).then(
        () => true,
        (error) => {
          if (error.code === 1) return false;
          throw error;
        },
      );
    for (let i = 0; i < 30 && ((await listening()) || (await locked())); i++)
      await sleep(300);
    if ((await listening()) || (await locked()))
      throw new Error("Previous server still running");
    stopped = true;
    if (rollbackSource) {
      await rename(staged, target);
      stagedCopy = false;
    } else await copyFile(source, target, constants.COPYFILE_EXCL);
    copied = true;
    if (rollbackSource) {
      const now = new Date();
      await utimes(target, now, now);
    }
    for (const file of await readdir(saves, { withFileTypes: true })) {
      if (
        file.isFile() &&
        file.name.endsWith(".zip") &&
        file.name !== name &&
        (await stat(join(saves, file.name))).mtimeMs >=
          (await stat(target)).mtimeMs
      ) {
        const current = new Date();
        await utimes(target, current, new Date(current.getTime() + 1000));
        if (
          (await stat(join(saves, file.name))).mtimeMs >=
          (await stat(target)).mtimeMs
        )
          throw new Error("Unable to select world");
      }
    }
    await controller("bootstrap", domain, plist);
    started = true;
    for (let i = 0; i < 22; i++) {
      await sleep(500);
      const available = await listening();
      if (available && rollbackSource) {
        const running = await rcon("/players online").then(
          (reply) => /^Online players \(\d+\):/m.test(reply),
          () => false,
        );
        if (running && (await loadedWorld(root)) === name)
          return { name, backup: checkpoint };
      } else if (available) {
        const current = (await readFile(log))
          .subarray(previousLogSize)
          .toString();
        if (
          current
            .split("\n")
            .some((line) => line.includes("Loading map") && line.includes(name))
        ) {
          return { name, backup: checkpoint };
        }
      }
    }
    throw new Error("New world startup not verified");
  } catch (error) {
    if (stopped) {
      if (started) await controller("bootout", service);
      if (copied) await rm(target);
      const now = new Date();
      await utimes(join(saves, `${checkpoint}.zip`), now, now);
      await controller("bootstrap", domain, plist);
    }
    throw error;
  } finally {
    try {
      if (stagedCopy) await rm(staged, { force: true });
    } finally {
      switching = false;
    }
  }
}

export async function controlFactorio(root: string, action: unknown) {
  if (
    action !== "start" &&
    action !== "restart" &&
    action !== "stop" &&
    action !== "save"
  ) {
    throw new Error("Invalid server action");
  }
  if (switching) throw new Error("Another server operation is running");
  switching = true;
  const domain = `gui/${process.getuid?.()}`;
  const service = `${domain}/${label}`;
  const plist = join(homedir(), "Library/LaunchAgents", `${label}.plist`);
  const launch = (...args: string[]) =>
    run("/bin/launchctl", args, { timeout: 12000 });
  const rcon = (command: string) =>
    run(join(root, "rcon.sh"), [command], { timeout: 2000 });
  const pid = () =>
    launch("print", service).then(
      ({ stdout }) => Number(/^\s*pid = (\d+)$/m.exec(stdout)?.[1]) || null,
      () => null,
    );
  const ownsLock = () =>
    run("/usr/sbin/lsof", ["-t", join(root, "data/.lock")], {
      timeout: 1500,
    }).then(
      () => true,
      (error) => {
        if (error.code === 1) return false;
        throw error;
      },
    );
  try {
    const source = join(root, `${label}.plist`);
    if ((await readFile(plist, "utf8")) !== (await readFile(source, "utf8")))
      throw new Error("Unexpected service definition");
    const before = await pid();
    if (action === "start") {
      if (before || (await ownsLock()))
        throw new Error("Server already running");
      await launch("bootstrap", domain, plist);
    } else {
      if (!before) throw new Error("Managed server is not running");
      const name = `web-save-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      await rcon(`/save ${name}`);
      const save = join(root, "data/saves", `${name}.zip`);
      for (let i = 0; ; i++) {
        const ready = await run("/usr/bin/unzip", ["-tq", save], {
          timeout: 1000,
        }).then(
          () => true,
          () => false,
        );
        if (ready) break;
        if (i === 19) throw new Error("Save verification failed");
        await sleep(250);
      }
      if (action === "save") return { running: true, save: `${name}.zip` };
      await launch("bootout", service);
      for (let i = 0; i < 25 && (await ownsLock()); i++) await sleep(300);
      if (await ownsLock())
        throw new Error("Server has not released its data lock");
      if (action === "stop") return { running: false };
      await launch("bootstrap", domain, plist);
    }
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      const current = await pid();
      if (
        current &&
        current !== before &&
        (await rcon("/players online").then(
          ({ stdout }) => /^Online players \(\d+\):/m.test(stdout),
          () => false,
        ))
      )
        return { running: true };
    }
    throw new Error("Server startup was not verified");
  } finally {
    switching = false;
  }
}
