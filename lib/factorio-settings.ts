import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const fields = {
  maxPlayers: ["max-players", "max_players", 0, 65535],
  autosave: ["autosave-interval", "autosave_interval", 1, 1440],
  afk: ["afk-auto-kick", "afk_autokick_interval", 0, 1440],
  adminPause: ["only-admins-can-pause", "only_admins_can_pause_the_game", 0, 0],
} as const;
type Key = keyof typeof fields;

async function command(root: string, text: string) {
  return (
    await run(join(root, "rcon.sh"), [text], { timeout: 2200 })
  ).stdout.trim();
}

export function parseSetting(key: Key, text: string) {
  if (key === "adminPause") {
    const match = /^Only admins can pause: (true|false)\.$/i.exec(text);
    if (match) return match[1].toLowerCase() === "true";
  } else {
    if (key === "afk" && /^AFK auto-kick is disabled\.$/i.test(text)) return 0;
    const match =
      key === "maxPlayers"
        ? /^(\d+)$/.exec(text)
        : /\b(\d+) minutes?\b/i.exec(text);
    if (match) return Number(match[1]);
  }
  throw new Error("Unexpected RCON response");
}

async function read(root: string, key: Key) {
  return parseSetting(
    key,
    await command(root, `/config get ${fields[key][0]}`),
  );
}

let pending = false;
export async function factorioSettings(root: string, request: Request) {
  if (request.method === "GET") {
    return Object.fromEntries(
      await Promise.all(
        (Object.keys(fields) as Key[]).map(async (key) => [
          key,
          await read(root, key),
        ]),
      ),
    );
  }
  const input = await request.json();
  if (
    !input ||
    typeof input.key !== "string" ||
    !Object.hasOwn(fields, input.key)
  )
    throw new Error("Invalid setting");
  const key = input.key as Key;
  const value: unknown = input.value;
  const [option, fileKey, min, max] = fields[key];
  if (
    key === "adminPause"
      ? typeof value !== "boolean"
      : typeof value !== "number" ||
        !Number.isInteger(value) ||
        value < min ||
        value > max
  ) {
    throw new Error("Invalid value");
  }
  if (pending) throw new Error("Settings update already running");
  pending = true;
  const file = join(root, "server-settings.json");
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const previous = await read(root, key);
    const original = await readFile(file, "utf8");
    const config = JSON.parse(original);
    config[fileKey] = value;
    await writeFile(temporary, JSON.stringify(config, null, 2) + "\n", {
      mode: (await stat(file)).mode & 0o777,
      flag: "wx",
    });
    try {
      if (previous !== value)
        await command(root, `/config set ${option} ${value}`);
      if ((await read(root, key)) !== value)
        throw new Error("RCON verification failed");
      if ((await readFile(file, "utf8")) !== original)
        throw new Error("Config changed concurrently");
      await rename(temporary, file);
    } catch (error) {
      if (previous !== value) {
        await command(root, `/config set ${option} ${previous}`);
        if ((await read(root, key)) !== previous)
          throw new Error("Rollback failed");
      }
      throw error;
    }
    return { [key]: value };
  } finally {
    pending = false;
    await rm(temporary, { force: true });
  }
}
