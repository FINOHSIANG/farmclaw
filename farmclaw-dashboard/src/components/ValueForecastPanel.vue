<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import TablerIcon from '@/components/TablerIcon.vue'

const props = defineProps({
  model: { type: Object, default: null }
})

const emit = defineEmits(['filter'])
const activeIndustry = ref('all')
const activeCategoryKey = ref('all')

const industries = computed(() => [
  { id: 'all', label: '全部产业', count: props.model?.totalPoints || 0, average: props.model?.overallAverage || 0 },
  ...(props.model?.industries || [])
])
const categories = computed(() => (props.model?.categories || []).filter((item) => activeIndustry.value === 'all' || item.industry === activeIndustry.value))
const selectedCategory = computed(() => categories.value.find((item) => `${item.industry}:${item.category}` === activeCategoryKey.value))
const selectedCount = computed(() => selectedCategory.value?.count ?? (activeIndustry.value === 'all'
  ? props.model?.totalPoints || 0
  : props.model?.industries?.find((item) => item.id === activeIndustry.value)?.count || 0))

watch(activeIndustry, () => {
  activeCategoryKey.value = 'all'
  emitFilter()
})

function emitFilter() {
  emit('filter', { industry: selectedCategory.value?.industry || activeIndustry.value, category: selectedCategory.value?.category || 'all' })
}

function selectCategory(item) {
  const key = `${item.industry}:${item.category}`
  activeCategoryKey.value = activeCategoryKey.value === key ? 'all' : key
  emitFilter()
}

onMounted(emitFilter)
</script>

<template>
  <aside class="value-panel" aria-label="产值预测分类">
    <header>
      <div class="workspace-panel-title">
        <TablerIcon name="activity" :size="19" aria-hidden="true" />
        <div>
        <span>VALUE FORECAST / CATEGORY</span>
        <h2>产值预测</h2>
        </div>
      </div>
      <em>演示指数</em>
    </header>

    <section v-if="model" class="forecast-overview">
      <div>
        <small>综合预测指数</small>
        <strong>{{ model.overallAverage }}</strong>
      </div>
      <dl>
        <div><dt>预测点</dt><dd>{{ model.totalPoints }}</dd></div>
        <div><dt>高潜力点</dt><dd>{{ model.highPotential }}</dd></div>
        <div><dt>当前筛选</dt><dd>{{ selectedCount }}</dd></div>
      </dl>
    </section>

    <div v-if="model" class="industry-tabs" aria-label="产业分类" role="group">
      <button
        v-for="industry in industries"
        :key="industry.id"
        :class="{ active: activeIndustry === industry.id }"
        :aria-pressed="activeIndustry === industry.id"
        type="button"
        @click="activeIndustry = industry.id"
      >
        <span>{{ industry.label }}</span><small>{{ industry.count }}</small>
      </button>
    </div>

    <section v-if="model" class="category-section">
      <div class="section-heading">
        <strong>品类表现</strong>
        <small>预测指数 0–100 · 点击同步地图</small>
      </div>
      <div class="forecast-scale" aria-hidden="true"><span>0</span><span>稳定 80</span><span>高潜 95</span><span>100</span></div>
      <div class="category-list">
        <button
          v-for="item in categories"
          :key="`${item.industry}:${item.category}`"
          :class="['category-row', item.industry, { active: activeCategoryKey === `${item.industry}:${item.category}` }]"
          type="button"
          @click="selectCategory(item)"
        >
          <span class="category-name"><TablerIcon :name="item.industry === 'aquaculture' ? 'fish' : 'seedling'" :size="19" aria-hidden="true" /><strong>{{ item.category }}</strong><small>{{ item.industryLabel }}</small></span>
          <span class="category-index"><small>预测指数</small><strong>{{ item.average }}</strong></span>
          <span class="category-relative" :class="{ positive: item.relative >= 0 }">较全场 {{ item.relative >= 0 ? '+' : '' }}{{ item.relative }}</span>
          <span class="category-bar" role="img" :aria-label="`${item.category}预测指数 ${item.average}，满分 100`"><i :style="{ width: `${Math.max(0, Math.min(100, item.average))}%` }"></i></span>
          <span class="category-meta">样本 {{ item.count }} 个点 · 高潜力 {{ item.highPotential }} · 样本占比 {{ item.share }}%</span>
        </button>
      </div>
    </section>

    <p v-if="model" class="methodology">{{ model.methodology }}预测指数不代表销售额、利润或真实财务收入。</p>
    <p v-if="model" class="mobile-disclaimer">演示预测指数，不代表销售额、利润或真实财务收入。</p>
    <div v-else class="loading-state">正在构建分类预测模型…</div>
  </aside>
</template>

<style scoped>
.value-panel { position:absolute; top:100px; left:18px; width:400px; max-height:calc(100vh - 230px); display:flex; flex-direction:column; padding:16px; overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:var(--ops-line) transparent; color:var(--ops-text); border:1px solid var(--ops-line); border-radius:var(--ops-radius-md); background:var(--ops-surface); box-shadow:var(--ops-shadow); pointer-events:auto; }
header { display:flex; align-items:end; justify-content:space-between; gap:12px; padding-bottom:12px; border-bottom:1px solid var(--ops-line-soft); } header span { color:var(--ops-accent); font:700 10px var(--ops-mono); letter-spacing:.14em; } h2 { margin-top:5px; font-size:20px; font-weight:650; } header em { padding:5px 8px; color:var(--ops-warning); border:1px solid oklch(80% .13 75/.42); border-radius:var(--ops-radius-sm); background:oklch(30% .06 75/.13); font-size:10px; font-style:normal; }
.forecast-overview { display:grid; grid-template-columns:1.05fr 1.8fr; gap:12px; margin-top:12px; padding:12px; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:oklch(16% .025 225/.64); }.forecast-overview > div { padding-right:12px; border-right:1px solid var(--ops-line-soft); }.forecast-overview small,.forecast-overview dt { color:var(--ops-text-muted); font-size:10px; }.forecast-overview > div strong { display:block; margin-top:7px; color:var(--ops-accent); font:700 28px/1 var(--ops-mono); }.forecast-overview dl { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; }.forecast-overview dl div { display:flex; flex-direction:column; justify-content:center; }.forecast-overview dd { margin-top:5px; font:700 14px var(--ops-mono); }
.industry-tabs { display:grid; grid-template-columns:repeat(4,1fr); gap:3px; margin-top:10px; padding:3px; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:oklch(16% .025 225/.6); }.industry-tabs button { min-height:40px; display:flex; align-items:center; justify-content:center; gap:5px; color:var(--ops-text-muted); border:0; border-radius:var(--ops-radius-sm); background:transparent; cursor:pointer; font-size:11px; }.industry-tabs button:hover { color:var(--ops-text); background:var(--ops-surface-raised); }.industry-tabs button.active { color:var(--ops-canvas); background:var(--ops-accent); font-weight:700; }.industry-tabs small { font:700 9px var(--ops-mono); opacity:.75; }
.category-section { margin-top:12px; }.section-heading { display:flex; align-items:center; justify-content:space-between; padding-bottom:6px; }.section-heading strong { font-size:13px; }.section-heading small { color:var(--ops-text-muted); font-size:10px; }.forecast-scale { display:grid; grid-template-columns:1fr 1fr 1fr auto; align-items:end; gap:4px; padding:0 8px 5px; color:var(--ops-text-muted); font:9px var(--ops-mono); }.forecast-scale span:nth-child(2),.forecast-scale span:nth-child(3) { text-align:right; }.category-list { max-height:calc(100vh - 500px); overflow-y:auto; scrollbar-width:thin; scrollbar-color:var(--ops-line) transparent; }.category-row { width:100%; display:grid; grid-template-columns:1fr auto 78px; gap:6px 10px; padding:10px 8px; color:var(--ops-text); text-align:left; border:1px solid transparent; border-bottom-color:var(--ops-line-soft); background:transparent; cursor:pointer; transition:background var(--ops-ease),border-color var(--ops-ease); }.category-row:hover { background:var(--ops-surface-raised); }.category-row.active { border-color:var(--ops-accent); border-radius:var(--ops-radius-sm); background:oklch(82% .15 184/.07); }.category-name { display:grid; grid-template-columns:24px 1fr; gap:3px 7px; }.category-name svg { grid-row:1/3; align-self:center; color:var(--ops-accent); }.category-row.aquaculture .category-name svg { color:var(--ops-info); }.category-name strong { font-size:13px; font-weight:650; }.category-name small { color:var(--ops-text-muted); font-size:10px; }.category-index { text-align:right; }.category-index small,.category-index strong { display:block; }.category-index small { color:var(--ops-text-muted); font-size:9px; }.category-index strong { margin-top:3px; font:700 14px var(--ops-mono); }.category-relative { align-self:center; color:var(--ops-danger); font:700 10px var(--ops-mono); text-align:right; }.category-relative.positive { color:var(--ops-success); }.category-bar { position:relative; grid-column:1/4; height:6px; overflow:hidden; border-radius:1px; background:linear-gradient(90deg,var(--ops-chart-grid) 0 79.5%,var(--ops-line) 79.5% 80%,var(--ops-chart-grid) 80% 94.5%,var(--ops-line) 94.5% 95%,var(--ops-chart-grid) 95%); }.category-bar i { display:block; height:100%; background:var(--ops-accent); }.category-row.aquaculture .category-bar i { background:var(--ops-info); }.category-meta { grid-column:1/4; color:var(--ops-text-muted); font-size:10px; }
.category-section { min-height:0; display:flex; flex:1 1 auto; flex-direction:column; }
.category-list { min-height:0; flex:1 1 auto; max-height:none; }
.methodology { margin-top:9px; padding-top:9px; color:var(--ops-text-muted); border-top:1px solid var(--ops-line-soft); font-size:10px; line-height:1.5; }.mobile-disclaimer { display:none; }.loading-state { padding:40px 10px; color:var(--ops-text-muted); text-align:center; font-size:12px; }
@media (max-width:600px) { .value-panel { top:auto; bottom:126px; left:10px; right:10px; width:auto; height:32vh; max-height:32vh; display:block; padding:12px; overflow-y:auto; border-radius:8px; }.value-panel::before { content:""; display:block; width:36px; height:3px; margin:-5px auto 7px; border-radius:3px; background:var(--ops-line); } header { padding-bottom:8px; } h2 { font-size:17px; }.forecast-overview { margin-top:8px; padding:9px; }.forecast-overview > div strong { font-size:22px; }.industry-tabs { margin-top:8px; }.industry-tabs button { min-height:44px; }.category-section { display:block; margin-top:8px; }.category-list { max-height:none; overflow:visible; }.category-row { min-height:64px; }.methodology { display:none; }.mobile-disclaimer { display:block; margin-top:6px; padding-top:6px; color:var(--ops-text-muted); border-top:1px solid var(--ops-line-soft); font-size:10px; line-height:1.35; } }
</style>
