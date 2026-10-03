/**
 * 预警中心演示模型。
 * 气候与虫害结论均为离线演示基线，不代表真实气象预报或病虫害识别结果。
 */

export const ALERT_TYPE_LABELS = Object.freeze({ climate: '气候预警', pest: '虫害预警' })
export const ALERT_SEVERITY_LABELS = Object.freeze({ warning: '高风险', attention: '需关注', normal: '低风险', pending: '待采集' })

const FIELD_ALERTS = Object.freeze({
  'greenhouse-1': [
    { id: 'climate-heat-gh1', type: 'climate', severity: 'warning', title: '高温闷棚风险', window: '演示规则 · 6h', confidence: 82, scope: '1号温室', evidence: '午后升温与棚内湿度叠加', recommendation: '开启顶窗通风，避开正午灌溉' },
    { id: 'climate-storm-gh1', type: 'climate', severity: 'attention', title: '强对流关注', window: '演示规则 · 12h', confidence: 71, scope: '核心温室区', evidence: '局地阵风与短时降雨条件', recommendation: '复核卷膜、排水沟与备用电源' },
    { id: 'pest-whitefly-gh1', type: 'pest', severity: 'attention', title: '粉虱活动风险', window: '本轮巡检', confidence: 78, scope: '东侧 2 排', evidence: '叶片背面疑似虫卵斑', recommendation: '安排叶背复核并检查诱虫板' }
  ],
  'field-a': [
    { id: 'climate-dry-field-a', type: 'climate', severity: 'warning', title: '高温干旱风险', window: '演示规则 · 24h', confidence: 86, scope: 'A区露地', evidence: '高温、低降水概率与土壤失墒叠加', recommendation: '分时补水并检查滴灌压力' },
    { id: 'pest-aphid-field-a', type: 'pest', severity: 'warning', title: '蚜虫扩散风险', window: '演示规则 · 48h', confidence: 84, scope: '西南角 0.6 ha', evidence: '新梢卷曲与边缘行聚集点', recommendation: '优先巡检边缘行，按植保方案处置' }
  ],
  'orchard-b': [
    { id: 'climate-rain-orchard-b', type: 'climate', severity: 'attention', title: '持续降雨关注', window: '演示规则 · 18h', confidence: 76, scope: 'B区果园', evidence: '连续降雨可能提高叶面湿润时长', recommendation: '清理排水口并延后叶面作业' },
    { id: 'pest-psyllid-orchard-b', type: 'pest', severity: 'normal', title: '柑橘木虱监测', window: '演示规则 · 48h', confidence: 66, scope: '北侧 12 株', evidence: '诱捕板计数轻微上升', recommendation: '维持诱捕监测并在 48 小时后复核' }
  ]
})

export function buildAlertCenterModel({ activeField = 'greenhouse-1' } = {}) {
  const alerts = (FIELD_ALERTS[activeField] || [
    { id: `pending-${activeField}`, type: 'climate', severity: 'pending', title: '等待预警数据', window: '尚未同步', confidence: null, scope: activeField, evidence: '当前田块未配置演示预警基线', recommendation: '接入气象与病虫害识别服务后更新' }
  ]).map((item) => ({ ...item, severityLabel: ALERT_SEVERITY_LABELS[item.severity], typeLabel: ALERT_TYPE_LABELS[item.type], source: 'demo-baseline' }))
  const counts = {
    total: alerts.length,
    climate: alerts.filter((item) => item.type === 'climate').length,
    pest: alerts.filter((item) => item.type === 'pest').length,
    warning: alerts.filter((item) => item.severity === 'warning').length,
    attention: alerts.filter((item) => item.severity === 'attention').length
  }
  return { activeField, alerts, counts, source: 'demo-baseline' }
}
