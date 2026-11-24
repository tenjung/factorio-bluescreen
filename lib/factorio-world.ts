import { execFile } from "node:child_process";
import {
  access,
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const relativeBin =
  "steamapps/common/Factorio/factorio.app/Contents/MacOS/factorio";
let generating = false;

async function findBinary() {
  const candidates = [
    process.env.FACTORIO_BIN,
    ...[
      "/Volumes/External2TB/SteamLibrary",
      "/Volumes/data/SteamLibrary",
      join(homedir(), "Library/Application Support/Steam"),
    ].map((path) => join(path, relativeBin)),
  ];
  const checks = await Promise.all(
    candidates.map(
      async (path) =>
        path &&
        (await access(path, constants.X_OK).then(
          () => path,
          () => undefined,
        )),
    ),
  );
  const bin = checks.find(Boolean);
  if (!bin) throw new Error("Factorio binary unavailable");
  return bin;
}

export async function factorioWorld(root: string, request: Request) {
  const base = JSON.parse(
    await readFile(join(root, "map-gen-settings.json"), "utf8"),
  );
  const bin = await findBinary();
  const installed = JSON.parse(
    await readFile(
      join(dirname(bin), "../data/map-settings.example.json"),
      "utf8",
    ),
  );
  const protectedDefaults = Object.fromEntries(
    [
      "enemy_expansion",
      "enemy_evolution",
      "pollution",
      "difficulty_settings",
    ].map((key) => [key, installed[key]]),
  );
  if (request.method === "GET") {
    return {
      ...base,
      starting_area: Math.min(base.starting_area ?? 1, 1),
      peaceful_mode: false,
      protectedDefaults,
    };
  }

  const input = await request.json();
  if (generating) throw new Error("Map generation already running");
  const integer = (value: unknown, min: number, max: number) =>
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max;
  const multiplier = (value: unknown) =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 6;
  if (
    !input ||
    (input.seed !== null && !integer(input.seed, 0, 4294967295)) ||
    !integer(input.width, 0, 2000000) ||
    !integer(input.height, 0, 2000000) ||
    !multiplier(input.starting_area) ||
    input.starting_area > 1 ||
    input.peaceful_mode !== false ||
    !input.autoplace_controls ||
    typeof input.autoplace_controls !== "object"
  ) {
    throw new Error("Invalid world settings");
  }
  for (const key of Object.keys(base.autoplace_controls)) {
    if (["enemy-base", "gleba_enemy_base", "trees"].includes(key)) continue;
    const values = input.autoplace_controls[key];
    if (
      !values ||
      ![values.frequency, values.size, values.richness].every(multiplier) ||
      values.frequency > 5
    )
      throw new Error("Invalid resource settings");
    base.autoplace_controls[key] = {
      frequency: values.frequency,
      size: values.size,
      richness: values.richness,
    };
  }
  for (const key of ["enemy-base", "gleba_enemy_base", "trees"])
    delete base.autoplace_controls[key];
  delete base.no_enemies_mode;
  Object.assign(base, {
    seed: input.seed,
    width: input.width,
    height: input.height,
    starting_area: input.starting_area,
    peaceful_mode: input.peaceful_mode,
  });
  if (typeof input.noCliffs !== "boolean")
    throw new Error("Invalid cliff setting");
  if (input.noCliffs)
    base.cliff_settings = { ...base.cliff_settings, richness: 0 };
  else {
    delete base.cliff_settings;
    for (const key of Object.keys(base.autoplace_controls).filter((key) =>
      key.endsWith("_cliff"),
    )) {
      if (base.autoplace_controls[key].size === 0)
        delete base.autoplace_controls[key];
    }
  }

  generating = true;
  let room: string | undefined;
  try {
    room = await mkdtemp(join(tmpdir(), "factorio-world-"));
    const config = join(room, "config.ini");
    const generation = join(room, "map-gen-settings.json");
    const save = join(room, "world.zip");
    const mods = join(room, "mods");
    await cp(join(root, "data/mods"), mods, { recursive: true });
    await writeFile(
      config,
      `[path]\nread-data=__PATH__system-read-data__\nwrite-data=${room}\n\n[other]\ncheck-updates=false\n`,
    );
    await writeFile(generation, JSON.stringify(base, null, 2));
    await run(
      bin,
      [
        "--config",
        config,
        "--mod-directory",
        mods,
        "--create",
        save,
        "--map-gen-settings",
        generation,
      ],
      { timeout: 45000, maxBuffer: 1024 * 1024 },
    );
    await run("/usr/bin/unzip", ["-tq", save], { timeout: 3000 });
    const directory = join(root, "data", "prepared-worlds");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const name = `world-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
    await copyFile(save, join(directory, name), constants.COPYFILE_EXCL);
    return { name };
  } finally {
    if (room) await rm(room, { recursive: true, force: true });
    generating = false;
  }
}
