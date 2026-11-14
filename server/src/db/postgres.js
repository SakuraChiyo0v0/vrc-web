import pg from 'pg';

/** 把 `?` 占位符翻成 $1..$n（两边都只写 `?`，适配层负责翻译） */
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export async function open(url) {
  const pool = new pg.Pool({ connectionString: url, max: 6 });
  const norm = (params) =>
    (params ?? []).map((v) => (v instanceof Date ? v : v));

  return {
    dialect: 'postgres',
    tbl: (name) => `vrc.${name}`,
    async query(sql, params) {
      const r = await pool.query(toPg(sql), norm(params));
      return r.rows;
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async close() {
      await pool.end();
    },
    raw: pool,
  };
}
