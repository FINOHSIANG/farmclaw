import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/components/FarmclawHud.vue', import.meta.url), 'utf8')
const workspace = await readFile(new URL('../src/style/workspace.css', import.meta.url), 'utf8')
for (const implementation of [
  'productionProfiles',
  'productionChecks',
  'productionHealthLabel',
  'productionHealthStatus',
  'pestWarningProfiles',
  'pestWarning',
  '作物档案',
  '阶段进度',
  '生产健康：{{ productionHealthLabel }}',
  '基于当前遥测快照'
]) assert.equal(source.includes(implementation), true, `缺少生产态势详情：${implementation}`)

assert.equal(source.includes('ORG-2024-01'), true, '生产批次必须可见')
assert.equal(source.includes('有机番茄 春茬'), true, '当前作物必须可见')
assert.equal(source.includes('坐果期'), true, '生产阶段必须可见')
assert.equal(workspace.includes('overflow:auto; overscroll-behavior:contain;'), true, '移动端生产面板必须可滚动')
assert.equal(source.includes('虫害预警'), true, '生产态势必须展示虫害预警')
assert.equal(source.includes('demo-baseline'), true, '虫害预警必须标注演示数据来源')
assert.equal(source.includes('演示预警 · 尚未接入病虫害识别服务'), true, '虫害预警必须明确说明非真实识别结果')
assert.equal(source.includes('处置建议'), true, '虫害预警必须提供处置建议字段')
assert.equal(source.includes('v-if="attachments.length || fileError"'), true, '附件校验错误必须在无有效附件时仍可见')
assert.equal(source.includes('mobilePanelExpanded.value = false'), true, '移动端切换专题必须恢复紧凑分析面板')
assert.equal(source.includes('aria-hidden="true" hidden multiple'), true, '原生文件输入必须从无障碍树隐藏，由可见上传按钮承担入口')
assert.equal(source.includes(':aria-controls="activeTopic === item.id ? selectedObject ? \'workspace-object-detail\' : `topic-panel-${item.id}` : undefined"'), true, '仅激活专题可引用当前存在的专题或对象详情 tabpanel')
assert.equal(source.includes("'has-attachments': attachments.length"), true, '附件状态必须同步到 HUD 根容器')
assert.equal(workspace.includes('top:var(--workspace-header); bottom:auto;'), true, '专题导航必须固定在顶栏下方，不再受底部附件影响')
assert.equal(workspace.includes('.map-tools'), true, '地图工具必须有共享布局规范')
assert.equal(workspace.includes('.has-attachments [role="tabpanel"] { bottom:144px;'), true, '移动端附件态面板必须避让命令栏')

console.log('Production dashboard validation passed: profile, batch, stage progress, telemetry checks, health summary, and responsive overflow guard verified')
