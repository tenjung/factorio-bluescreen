"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Resource = { frequency: number; size: number; richness: number };
type World = {
  seed: number | null;
  width: number;
  height: number;
  starting_area: number;
  peaceful_mode: boolean;
  protectedDefaults: Record<string, Record<string, number | boolean | string>>;
  cliff_settings?: { richness?: number };
  autoplace_controls: Record<string, Resource>;
};
const endpoint = "/api/server-status?view=world";
const resourceLabels: Record<string, string> = {
  "iron-ore": "철광석",
  "copper-ore": "구리 광석",
  stone: "돌",
  coal: "석탄",
  "crude-oil": "원유",
  "uranium-ore": "우라늄",
  scrap: "고철",
};
const axes = [
  ["frequency", "빈도"],
  ["size", "크기"],
  ["richness", "매장량"],
] as const;

const maxima = { frequency: 5, size: 6, richness: 6 } as const;
const bulkChoices = [0.5, 1, 1.5, 2, 3, 4, 5, 6];

function isResource(key: string) {
  return (
    !key.endsWith("_cliff") &&
    !["enemy-base", "gleba_enemy_base", "trees", "water"].includes(key)
  );
}

export function NewWorld({ password }: { password: string }) {
  const [world, setWorld] = useState<World>();
  const [noCliffs, setNoCliffs] = useState(false);
  const [bulk, setBulk] = useState<Resource>({ ...maxima });

  function applyResources(values: Partial<Resource>) {
    setWorld(
      (current) =>
        current && {
          ...current,
          autoplace_controls: Object.fromEntries(
            Object.entries(current.autoplace_controls).map(
              ([key, resource]) => [
                key,
                isResource(key) ? { ...resource, ...values } : resource,
              ],
            ),
          ),
        },
    );
  }

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function request(create: boolean) {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: create ? "POST" : "GET",
        headers: {
          "x-settings-password": password,
          "Content-Type": "application/json",
        },
        body: create ? JSON.stringify({ ...world, noCliffs }) : undefined,
      });
      if (!response.ok) throw new Error("World request failed");
      if (create) {
        const result = await response.json();
        setMessage(`새 월드를 생성했습니다. ${result.name} · 서버 전환 대기`);
      } else {
        const defaults: World = await response.json();
        setWorld(defaults);
        setNoCliffs(defaults.cliff_settings?.richness === 0);
      }
    } catch {
      setMessage(
        create
          ? "월드를 생성하지 못했습니다."
          : "맵 생성 기본값을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-5">
      <CardHeader>
        <div>
          <CardTitle>새 월드 만들기</CardTitle>
          <p className="section-caption">
            서버의 맵 생성 기본값을 불러와 새 세이브를 준비합니다.
          </p>
        </div>
        {!world && (
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void request(false)}
          >
            기본값 불러오기
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {world && (
          <form
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              void request(true);
            }}
          >
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Label className="grid gap-2">
                시드 (빈칸은 무작위)
                <Input
                  type="number"
                  min={0}
                  max={4294967295}
                  value={world.seed ?? ""}
                  onChange={(event) =>
                    setWorld({
                      ...world,
                      seed:
                        event.target.value === ""
                          ? null
                          : event.target.valueAsNumber,
                    })
                  }
                />
              </Label>
              {(
                [
                  ["width", "너비"],
                  ["height", "높이"],
                  ["starting_area", "시작 지역 배율"],
                ] as const
              ).map(([key, label]) => (
                <Label className="grid gap-2" key={key}>
                  {label}
                  <Input
                    type="number"
                    required
                    min={0}
                    max={key === "starting_area" ? 1 : 2000000}
                    step={key === "starting_area" ? "any" : 1}
                    value={world[key]}
                    onChange={(event) =>
                      setWorld({ ...world, [key]: event.target.valueAsNumber })
                    }
                  />
                </Label>
              ))}
            </div>
            <p className="section-caption">
              너비·높이에서 0은 제한 없음입니다.
            </p>
            <div className="flex flex-wrap gap-6">
              <Label>
                <input
                  type="checkbox"
                  checked={noCliffs}
                  onChange={(event) => setNoCliffs(event.target.checked)}
                />{" "}
                절벽 비활성화
              </Label>
            </div>
            <details className="rounded-md border border-border p-4">
              <summary className="cursor-pointer font-medium">
                적 · 확장 · 진화 · 오염 설정
              </summary>
              <p className="section-caption">
                업적 조건 보호를 위해 평화 모드와 적 없음은 꺼짐, 적 기지와
                나무는 기본값으로 유지합니다.
              </p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {Object.entries(world.protectedDefaults).map(
                  ([group, values]) => (
                    <details
                      key={group}
                      className="rounded-md border border-border p-3"
                    >
                      <summary className="cursor-pointer">
                        {{
                          enemy_expansion: "적 확장",
                          enemy_evolution: "적 진화",
                          pollution: "오염",
                          difficulty_settings: "난이도",
                        }[group] ?? group}{" "}
                        · 기본값 유지
                      </summary>
                      <dl className="mt-2 grid gap-2 text-sm">
                        {Object.entries(values)
                          .filter(([key]) => !key.startsWith("_"))
                          .map(([key, value]) => (
                            <div
                              className="flex flex-wrap justify-between gap-x-3"
                              key={key}
                            >
                              <dt>
                                {(
                                  {
                                    enabled: "활성화",
                                    max_expansion_distance: "최대 확장 거리",
                                    min_expansion_distance: "최소 확장 거리",
                                    settler_group_min_size: "최소 확장 무리",
                                    settler_group_max_size: "최대 확장 무리",
                                    min_expansion_cooldown:
                                      "최소 확장 간격 (분)",
                                    max_expansion_cooldown:
                                      "최대 확장 간격 (분)",
                                    time_factor: "시간에 따른 진화",
                                    destroy_factor: "기지 파괴에 따른 진화",
                                    pollution_factor: "오염에 따른 진화",
                                    diffusion_ratio: "오염 확산 비율",
                                    ageing: "오염 흡수 배율",
                                    enemy_attack_pollution_consumption_modifier:
                                      "공격에 필요한 오염 배율",
                                  } as Record<string, string>
                                )[key] ?? key}
                              </dt>
                              <dd>
                                {typeof value === "boolean"
                                  ? value
                                    ? "켜짐"
                                    : "꺼짐"
                                  : key.endsWith("expansion_cooldown") &&
                                      typeof value === "number"
                                    ? value / 3600
                                    : String(value)}
                              </dd>
                            </div>
                          ))}
                      </dl>
                    </details>
                  ),
                )}
              </div>
            </details>
            <section className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium">자원 일괄 조절</h3>
                  <p className="section-caption">
                    모든 행성의 자원에 적용됩니다. 아래에서 자원별로 다시 조정할
                    수 있습니다.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    setBulk({ ...maxima });
                    applyResources(maxima);
                    setNoCliffs(true);
                  }}
                >
                  자원 풍부 · 업적 조건 유지
                </Button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {axes.map(([axis, label]) => (
                  <div
                    className="rounded-md border border-border p-3"
                    key={axis}
                  >
                    <Label htmlFor={`bulk-${axis}`}>전체 {label}</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <select
                        id={`bulk-${axis}`}
                        className="log-select"
                        value={bulk[axis]}
                        onChange={(event) =>
                          setBulk({
                            ...bulk,
                            [axis]: Number(event.target.value),
                          })
                        }
                      >
                        {bulkChoices
                          .filter((value) => value <= maxima[axis])
                          .map((value) => (
                            <option key={value} value={value}>
                              {value}배{value === maxima[axis] ? " (최대)" : ""}
                            </option>
                          ))}
                      </select>
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => applyResources({ [axis]: bulk[axis] })}
                      >
                        전체 적용
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="section-caption">
                풍부 설정은 빈도 5배, 크기·매장량 6배, 절벽 꺼짐으로 맞춥니다.
                적 확장·진화·오염·난이도는 기본값을 사용합니다.
              </p>
            </section>
            <details>
              <summary className="cursor-pointer font-medium">
                자원별 세부 설정
              </summary>
              {Object.entries(world.autoplace_controls)
                .filter(([key]) => isResource(key))
                .map(([key, resource]) => (
                  <div
                    className="grid grid-cols-3 gap-3 border-b border-border py-3 md:grid-cols-4"
                    key={key}
                  >
                    <strong className="col-span-3 md:col-span-1">
                      {resourceLabels[key] ?? key}
                    </strong>
                    {axes.map(([axis, label]) => (
                      <Label key={axis} className="grid gap-2">
                        {label}
                        <Input
                          type="number"
                          required
                          min={0}
                          max={maxima[axis]}
                          step="any"
                          value={
                            Number.isNaN(resource[axis]) ? "" : resource[axis]
                          }
                          onBlur={() => {
                            if (
                              axis !== "frequency" ||
                              !(resource.frequency > 5)
                            )
                              return;
                            setWorld(
                              (current) =>
                                current && {
                                  ...current,
                                  autoplace_controls: {
                                    ...current.autoplace_controls,
                                    [key]: {
                                      ...current.autoplace_controls[key],
                                      frequency: 5,
                                    },
                                  },
                                },
                            );
                          }}
                          onChange={(event) => {
                            setWorld({
                              ...world,
                              autoplace_controls: {
                                ...world.autoplace_controls,
                                [key]: {
                                  ...resource,
                                  [axis]: event.target.valueAsNumber,
                                },
                              },
                            });
                          }}
                        />
                      </Label>
                    ))}
                  </div>
                ))}
            </details>
            <div>
              <Button type="submit" disabled={loading}>
                {loading ? "생성 중…" : "새 월드 생성"}
              </Button>
            </div>
          </form>
        )}
        {message && (
          <p className="mt-4" role="status">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
