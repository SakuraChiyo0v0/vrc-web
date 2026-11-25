import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import Empty from '../components/Empty.jsx';

/**
 * 我的模型（真机侧栏 row 18）。真机列的是账号下的 Avatar 列表（名字 / 缩略图 / 是否收藏）。
 * 我们采集器只存好友当前用的 avatar_id，没有自己的模型库，所以服务端 /api/avatars 读 vrc.avatar 表，
 * 表在、但采集器没接入 VRChat 模型接口时就是空的——空态直说，不编数据。
 */
export default function MyModelsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['avatars'], queryFn: () => api('avatars') });
  const rows = data?.avatars ?? [];
  return (
    <div className="p-4" data-page="models">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[12px] text-fg3">账号下的 VRChat 模型（Avatar）。</span>
        <span className="chip ml-auto" data-count={rows.length}>共 {rows.length} 个</span>
      </div>
      {!isLoading && rows.length === 0 ? (
        <Empty icon="vr" title="还没有模型记录" hint="采集器未接入 VRChat 模型接口（需要账号令牌），接入后自动出现。" />
      ) : (
        <div className="world-grid" data-grid="models">
          {rows.map((a) => (
            <div key={a.id} className="card p-2.5" data-avatar={a.id}>
              <div className="truncate text-[12px]">{a.name ?? a.id}</div>
              <div className="mt-1 text-[11px] text-fg3">{a.author_name ?? '未知作者'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
