import type { TimeframeId } from "@/lib/timeframes";

export function TimeframeSelector({
  active,
  basePath,
}: {
  active: TimeframeId;
  basePath: string;
}) {
  // Stub — full implementation in Task 5.
  void basePath;
  return <div data-stub-active={active} aria-hidden="true" />;
}
