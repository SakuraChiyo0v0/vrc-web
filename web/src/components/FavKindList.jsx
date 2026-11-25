import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import Empty from '../components/Empty.jsx';

/**
 * 收藏折叠夹里的「群组收藏 / 模型收藏」共用列表。
 * 真机收藏夹四子项（好友收藏 / 群组收藏 / 世界收藏 / 模型收藏）都读同一张 favorite 表，
 * 按 kind 过滤；群组与模型目前采集器还没接入（VRChat 群组 / 模型接口需要账号令牌），
 * 所以这两页大多数时候是空态——文案直说原因，不放假数据。
 */
const KIND_TEXT = {
  group: {
    page: 'groupfav',
    title: '群组收藏',
    emptyTitle: '还没有收藏的群组',
    emptyHint: '采集器未接入 VRChat 群组接口，收藏入口暂时只能从 API 写入（kind=group）。'
  },
  avatar: {
    page: 'avatarfav',
    title: '模型收藏',
    emptyTitle: '还没有收藏的模型',
    emptyHint: '采集器未接入 VRChat 模型接口，收藏入口暂时只能从 API 写入（kind=avatar）。'
  }
};

export default function FavKindList({ kind }) {
  const t = KIND_TEXT[kind];
  const { data, isLoading } = useQuery({ queryKey: ['favorites'], queryFn: () => api('favorites') });
  const rows = (data?.favorites ?? []).filter((f) => f.kind === kind);
  const groups = data?.groups ?? [];
  return (
    <div className="p-4" data-page={t.page} data-kind={kind}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[12px] text-fg3">
          {kind === 'group' ? 'VRChat 群组' : 'VRChat 模型（Avatar）'} · 与好友收藏 / 世界收藏同一张收藏表
        </span>
        <span className="chip ml-auto" data-count={rows.length}>共 {rows.length} 条</span>
      </div>
      {!isLoading && rows.length === 0 ? (
        <Empty icon="star" title={t.emptyTitle} hint={t.emptyHint} />
      ) : (
        <ul className="space-y-1" data-list={kind}>
          {rows.map((f) => (
            <li key={f.id} className="card flex items-center gap-2 px-2.5 py-1.5" data-fav={f.id}>
              <span className="truncate text-[12px]">{f.name ?? f.target_id}</span>
              {f.group_id ? (
                <span className="chip ml-auto">{groups.find((g) => g.id === f.group_id)?.name ?? '分组'}</span>
              ) : null}
              <span className="text-[11px] text-fg3">{f.note ?? ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
