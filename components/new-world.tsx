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

export function NewWorld({ password }: { password: string }) {
  const [world, setWorld] = useState<World>();
  const [noCliffs, setNoCliffs] = useState(false);
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
                    max={key === "starting_area" ? 6 : 2000000}
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
                  checked={world.peaceful_mode}
                  onChange={(event) =>
                    setWorld({ ...world, peaceful_mode: event.target.checked })
                  }
                />{" "}
                평화 모드
              </Label>
              <Label>
                <input
                  type="checkbox"
                  checked={noCliffs}
                  onChange={(event) => setNoCliffs(event.target.checked)}
                />{" "}
                절벽 비활성화
              </Label>
            </div>
            <details>
              <summary className="cursor-pointer font-medium">
                자원 생성 세부 설정
              </summary>
              {Object.entries(world.autoplace_controls)
                .filter(([key]) => !key.endsWith("_cliff"))
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
                          max={6}
                          step="any"
                          value={resource[axis]}
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
