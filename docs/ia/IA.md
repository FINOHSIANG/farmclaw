# 四时信息架构说明

## IA Thesis

用户主要围绕农场对象和当天任务工作，而不是围绕地图专题工作。四时以“今日任务”作为入口，以农场、地块、作物批次和设备作为稳定对象，以 AI 作为跨对象协作者，地图作为空间上下文；复杂能力通过对象详情和任务流程逐步展开。

## Organizing Principle

主组织原则：任务优先（task-first）。

对象承载上下文：农场 → 地块/温室 → 作物批次 → 任务/告警/记录。AI 建议必须落到对象、负责人、时间和结果上。

## Definition of Done

- 值守人员进入系统后 10 秒内知道最重要的待办和风险。
- 生产负责人可以从地块或批次直接进入趋势、任务、投入品和追溯。
- 农艺师可以查看 AI 依据、修改建议并发起人工复核。
- 巡检人员可以在移动端只围绕当前任务完成拍照、定位和反馈。
- 管理者可以通过批次、资源和结果报告判断投入是否产生价值。

## Related Deliverables

- `../project/2026-09-02-sishi-frontend-function-audit-report.md`
- `../project/2026-09-02-sishi-report-deck.md`
- `SITEMAP.mmd`
- `NAVIGATION.md`
- `CONTENT_MODEL.md`
- `CONTENT_INVENTORY.csv`
- `TAXONOMY.csv`
- `DECISIONS.md`
