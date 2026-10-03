# Farmclaw 资料索引

更新日期：2026-09-02

| 编号 | 标题 | 类型 | 位置 | 负责人 | 可信度 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REF-0001 | 立项说明 | 内部文档 | `docs/project/01-project-brief.md` |  | primary | active |  |
| REF-0002 | 用户融合要求 | 原始需求 | 当前 Codex 会话 | 用户 | primary | active | 指定 gyrate/digitalFarm 作为基座 |
| REF-0003 | digitalFarm 上游仓库 | 外部源码 | `https://github.com/gyrate/digitalFarm` | gyrate | external | pinned | 固定提交 c8f47dcb；未声明许可证 |
| REF-0004 | 第三方来源说明 | 内部文档 | `docs/THIRD_PARTY_NOTICES.md` | Farmclaw | secondary | active | 记录引入范围与授权风险 |
| REF-0005 | OpenFreeMap | 官方服务 | `https://openfreemap.org/` | OpenFreeMap | external | active | 无需注册和 API Key；生产 SLA 待自评估 |
| REF-0006 | MapLibre GL JS | 官方文档 | `https://maplibre.org/maplibre-gl-js/docs/` | MapLibre | external | active | BSD-3-Clause，承载矢量瓦片和 GeoJSON 图层 |
| REF-0007 | OSM Tile Usage Policy | 官方政策 | `https://operations.osmfoundation.org/policies/tiles/` | OSMF | external | active | 说明为何不把 OSM 标准 raster tile 当作无限制 CDN |
| REF-0008 | 安防演示数据 | 内部数据 | `farmclaw-dashboard/public/static/mock/security.geojson` | Farmclaw | secondary | active | 4 个围栏、8 个摄像头；投产前需替换 |
| REF-0009 | 四时前端功能审查与汇报方案 | 内部报告 | `docs/project/2026-09-02-sishi-frontend-function-audit-report.md` | 四时 | primary | active | 当前能力、P0/P1/P2 缺口、90 天路线和验收指标 |
| REF-0010 | 四时逐页汇报稿 | 内部报告 | `docs/project/2026-09-02-sishi-report-deck.md` | 四时 | primary | active | 12 页汇报结构、讲稿、演示和常见问答 |
| REF-0011 | 四时信息架构包 | 设计文档 | `docs/ia/` | 四时 | primary | proposed | 站点图、导航、内容模型、现状清单、分类和决策记录 |
| REF-0012 | 全国智慧农业行动计划（2024-2028年） | 官方政策 | `https://app.www.gov.cn/govdata/gov/202410/27/521072/article.html` | 农业农村部 | external | active | 智慧农场、基础模型、生产托管和全产业链数字化依据 |
| REF-0013 | 雄小农农业行业大模型 | 官方案例 | `https://www.xiongan.gov.cn/20250228/8bad33753ede42cf8048ff71119748ba/c.html` | 雄安新区农业农村局 | external | active | “首个”宣传范围核验样本 |
| REF-0014 | 神农大模型 3.0 多智能体体系 | 官方案例 | `https://www.digitalchina.gov.cn/2025/xwzx/qwfb/202510/t20251015_5149853.htm` | 数字中国建设峰会 | external | active | 农业多智能体与现场闭环参照 |
| REF-0015 | 农耕大模型 1.0 智能体集群 | 官方案例 | `https://nyncw.cq.gov.cn/ztzl_161/rdzt/dscqgtrpc_347647/pcgz_347649/202512/t20251209_15222555_wap.html` | 重庆市农业农村委员会 | external | active | 耕地全生命周期与智能体集群参照 |
| REF-0016 | 四时数字孪生地图视觉升级 | 实现与汇报补充 | `docs/project/2026-09-02-sishi-map-visual-upgrade.md` | 四时 | primary | active | 地图空间层级、专题聚焦、卫星模式、选中反馈与验证结果 |

## 可信度说明

- `primary`：一手事实来源或用户提供资料。
- `secondary`：派生摘要、分析或实现说明。
- `external`：第三方或供应商资料。
- `stale-risk`：有用但容易过期，使用前需要重新核验。

## 收录规则

- 新需求、截图、日志、会议纪要、外部文档、设计稿和生成物都要登记到这里。
- 保留原始文件；摘要、状态和解释单独写入文档。
- 过期资料标记为 `archived`，不要直接删除历史。
