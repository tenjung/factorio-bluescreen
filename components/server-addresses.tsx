"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Addresses = {
  local: string;
  lan: string | null;
  external: string | null;
  port: number;
};

export function ServerAddresses({
  password,
  refreshKey,
}: {
  password: string;
  refreshKey: number;
}) {
  const [addresses, setAddresses] = useState<Addresses>();
  const [loadError, setLoadError] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/server-status?view=addresses", {
      cache: "no-store",
      headers: { "x-settings-password": password },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Address lookup failed");
        const result = await response.json();
        if (!controller.signal.aborted) {
          setAddresses(result);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, [password, refreshKey]);

  const rows = [
    {
      label: "서버 Mac에서 접속",
      value: addresses?.local,
      description: "서버를 실행하는 Mac의 게임에서 사용",
    },
    {
      label: "내부 접속 주소 (LAN)",
      value: addresses?.lan,
      description: "같은 공유기에 연결된 기기에서 사용",
    },
    {
      label: "외부 접속 주소",
      value: addresses?.external,
      description:
        "Factorio가 마지막으로 감지한 주소 · 외부 기기 접속은 미검증",
    },
  ];

  return (
    <Card className="mb-5">
      <CardHeader>
        <div>
          <CardTitle>게임 접속 주소</CardTitle>
          <p className="section-caption">
            Factorio에서 멀티플레이 → 주소로 연결에 입력하세요.
            {addresses && ` · UDP ${addresses.port}`}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {loadError ? (
          <p role="status">
            주소를 불러오지 못했습니다. 새로고침으로 다시 시도하세요.
          </p>
        ) : !addresses ? (
          <p>주소를 확인하는 중입니다.</p>
        ) : (
          <dl className="grid gap-3 md:grid-cols-3">
            {rows.map(({ label, value, description }) => (
              <div
                key={label}
                className="min-w-0 rounded-md border border-border p-3"
              >
                <dt className="font-medium">{label}</dt>
                <dd className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="break-all">{value ?? "확인되지 않음"}</code>
                  {value && (
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={`${label} 복사`}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(value);
                          setFeedback(`${label}를 복사했습니다.`);
                        } catch {
                          setFeedback(
                            "복사에 실패했습니다. 주소를 선택해 복사하세요.",
                          );
                        }
                      }}
                    >
                      복사
                    </Button>
                  )}
                </dd>
                <p className="section-caption">{description}</p>
              </div>
            ))}
          </dl>
        )}
        {feedback && (
          <p className="section-caption" role="status">
            {feedback}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
