"use client";

import { Button } from "@/components/ui/button";

export function HistoryToggle({
  expanded,
  pending,
  error,
  onClick,
}: {
  expanded: boolean;
  pending: boolean;
  error: boolean;
  onClick: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        aria-expanded={expanded}
        onClick={onClick}
      >
        {pending ? "불러오는 중…" : expanded ? "접기" : "더 보기"}
      </Button>
      {error && (
        <span className="text-sm text-muted-foreground" role="status">
          이전 기록을 불러오지 못했습니다.
        </span>
      )}
    </div>
  );
}
