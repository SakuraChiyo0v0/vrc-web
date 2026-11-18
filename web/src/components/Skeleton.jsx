/**
 * 99 首屏骨架（真机列表加载时给占位行，不白屏、不跳高度）
 *
 *   {isLoading ? <Skeleton rows={8} cols={4} /> : <Table ... />}
 *
 * 骨架行高 44px，跟 .tbl tbody td 的 40px + 边框对齐，数据回来时列表不跳。
 */
export default function Skeleton({ rows = 8, cols = 4, className = '' }) {
  return (
    <div className={`card sk-wrap ${className}`} data-skeleton="1" aria-busy="true" aria-label="加载中">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="sk-row" key={i} style={{ opacity: 1 - i * 0.06 }}>
          {Array.from({ length: cols }).map((__, j) => (
            <span
              key={j}
              className="sk-bar"
              style={{
                flex: j === 0 ? '0 0 22%' : j === cols - 1 ? '1 1 auto' : `0 0 ${8 + ((i + j * 2) % 3) * 4}%`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
