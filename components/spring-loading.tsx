/** 全站春意加载：旋转绿叶 + 萌芽点缀 */
export function SpringLoadingIndicator({
  label = "春意加载中…",
}: {
  label?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-10"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="spring-loading-mark" aria-hidden>
        <span className="spring-loading-leaf">🍃</span>
        <span className="spring-loading-sprout" />
      </div>
      <p className="text-sm font-medium text-emerald-800/75">{label}</p>
    </div>
  );
}
