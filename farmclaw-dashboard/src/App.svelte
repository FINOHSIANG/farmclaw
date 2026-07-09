<script>
  import { onMount, afterUpdate } from "svelte";
  import greenhouseHero from "./assets/generated/greenhouse-hero.webp";
  import tomatoMonitor from "./assets/generated/tomato-monitor.webp";
  import cornThumb from "./assets/generated/corn-thumb.webp";
  import cabbageThumb from "./assets/generated/cabbage-thumb.webp";

  let ws;
  let reconnectTimer;
  let connectGuard;
  let clockTimer;
  let connectionStatus = "离线演示";
  let currentTime = "14:43:23";
  let selectedFieldId = "greenhouse-1";
  let activeView = "overview";
  let command = "";
  let eventContainer;
  let aiManaged = true;

  let nodes = {
    gateway: true,
    pi_agent_core: true,
    farm_iot_sensors_v1: true,
    farm_weather_service_v1: true,
  };

  const navItems = [
    { id: "overview", label: "园区概览" },
    { id: "environment", label: "大棚2 环境监测" },
    { id: "operations", label: "设备运维" },
    { id: "security", label: "安防管理" },
  ];
  const cropColumns = Array.from({ length: 18 }, (_, index) => index);
  const particles = Array.from({ length: 46 }, (_, index) => ({
    id: index,
    left: 10 + ((index * 19) % 82),
    top: 16 + ((index * 31) % 56),
    delay: (index % 12) * 0.18,
  }));

  let fields = [
    {
      id: "greenhouse-1",
      name: "西红柿",
      area: "大棚 01",
      crop: "有机番茄 春茬",
      batch: "ORG-2024-01",
      count: 534,
      maturity: 78.34,
      moisture: 32.23,
      temperature: 24,
      health: 86,
      image: "tomato",
      status: "采收准备",
    },
    {
      id: "field-a",
      name: "玉米",
      area: "露地 A 区",
      crop: "有机玉米 夏茬",
      batch: "ORG-2024-02",
      count: 754,
      maturity: 52.47,
      moisture: 41.8,
      temperature: 23,
      health: 91,
      image: "corn",
      status: "长势稳定",
    },
    {
      id: "orchard-b",
      name: "大白菜",
      area: "B 区育苗棚",
      crop: "有机白菜 秋茬",
      batch: "ORG-2024-03",
      count: 395,
      maturity: 21.87,
      moisture: 36.6,
      temperature: 22,
      health: 73,
      image: "cabbage",
      status: "病害巡检",
    },
  ];

  let overviewStats = [
    { label: "大棚数量", value: "3个", icon: "⌂" },
    { label: "耗电量", value: "342W", icon: "ϟ" },
    { label: "种植面积", value: "357m²", icon: "✣" },
    { label: "预计产能", value: "3,155T", icon: "▣" },
    { label: "灌溉量", value: "1,537L", icon: "●" },
    { label: "平均温度", value: "25.30°C", icon: "♨" },
  ];

  let equipmentRows = [
    ["大棚1", "阀门", "开启"],
    ["大棚2", "阀门", "开启"],
    ["大棚3", "补光灯", "巡检"],
  ];

  const environmentReadouts = [
    { label: "空气温度", value: "26.4°C", target: "目标 24-28°C", status: "稳定", tone: "good" },
    { label: "空气湿度", value: "71%", target: "目标 65-78%", status: "稳定", tone: "good" },
    { label: "CO₂ 浓度", value: "618ppm", target: "目标 550-800ppm", status: "补气观察", tone: "watch" },
    { label: "光照强度", value: "42klux", target: "目标 35-55klux", status: "合格", tone: "good" },
    { label: "土壤水分", value: "38.7%", target: "目标 36-44%", status: "低位", tone: "watch" },
    { label: "土壤 pH", value: "6.6", target: "目标 6.2-6.8", status: "合格", tone: "good" },
  ];

  const climateTrend = [45, 54, 48, 61, 58, 72, 66, 76, 70, 82, 74, 86];

  const environmentRules = [
    ["通风阈值", "温度 > 29°C 或湿度 > 82%", "自动开启侧窗 35%"],
    ["滴灌阈值", "土壤水分 < 36%", "AI 建议补水 80L"],
    ["病害阈值", "叶面湿度连续 40min", "触发夜间巡检"],
  ];

  const operationsKpis = [
    { label: "在线设备", value: "28/30", hint: "2 台待巡检" },
    { label: "今日能耗", value: "342W", hint: "较昨日 -8%" },
    { label: "待办工单", value: "4", hint: "1 项高优先级" },
    { label: "自动执行", value: "17次", hint: "成功率 98.2%" },
  ];

  const equipmentFleet = [
    { name: "卷帘电机 A2", area: "大棚2 东侧", status: "正常", health: 92 },
    { name: "滴灌泵 P-03", area: "大棚2 根区", status: "待保养", health: 76 },
    { name: "补光灯 L-12", area: "育苗架二层", status: "巡检", health: 84 },
    { name: "边缘网关 GW-02", area: "设备间", status: "在线", health: 97 },
  ];

  const workOrders = [
    { time: "15:50", title: "滴灌泵 P-03 滤芯更换", level: "高", owner: "运维组" },
    { time: "16:20", title: "补光灯 L-12 电流复测", level: "中", owner: "电气组" },
    { time: "18:00", title: "卷帘电机行程校准", level: "低", owner: "夜班" },
  ];

  const securityFeeds = [
    { name: "北门入口", status: "布防中", metric: "人员 2 / 车辆 1" },
    { name: "大棚2 通道", status: "正常", metric: "近 10min 无异常" },
    { name: "投入品库", status: "重点", metric: "门磁闭合" },
  ];

  const securityEvents = [
    ["15:12", "访客车牌已登记", "已放行"],
    ["14:48", "投入品库门磁巡检", "正常"],
    ["13:27", "周界红外误报复核", "已关闭"],
  ];

  const accessRules = [
    { label: "投入品库", value: "双人确认", state: "启用" },
    { label: "大棚2 夜间", value: "电子围栏", state: "启用" },
    { label: "访客路线", value: "仅主通道", state: "启用" },
  ];

  const aiGuardrails = ["有机投入白名单", "高风险人工确认", "操作自动留痕"];

  let eventStream = [
    {
      id: 1,
      time: "14:32:08",
      type: "AI.DIAG",
      text: "大棚1番茄成熟度达到 78.34%，追溯批次已锁定。",
    },
    {
      id: 2,
      time: "14:36:21",
      type: "IOT.SYNC",
      text: "土壤水分、棚内温度、光照强度已同步至监控大屏。",
    },
  ];

  $: selectedField =
    fields.find((field) => field.id === selectedFieldId) || fields[0];
  $: nodeCount = Object.keys(nodes).length;
  $: greenhouseReadouts = [
    { label: "棚内温度", value: `${selectedField.temperature}°C`, hint: "实时采集" },
    { label: "土壤水分", value: `${selectedField.moisture}%`, hint: "根区均值" },
    { label: "成熟度", value: `${selectedField.maturity}%`, hint: selectedField.status },
    { label: "健康指数", value: `${selectedField.health}`, hint: "AI 诊断" },
  ];
  $: greenhousePins = [
    { label: "温度", value: `${selectedField.temperature}°C`, className: "pin-temp" },
    { label: "水分", value: `${selectedField.moisture}%`, className: "pin-moisture" },
    { label: "成熟", value: `${selectedField.maturity}%`, className: "pin-maturity" },
  ];
  $: aiTrustScore = Math.round(
    (Number(selectedField.health) * 0.55) + (Number(selectedField.maturity) * 0.3) + 12,
  );
  $: aiNextAction =
    Number(selectedField.moisture) < 35
      ? `16:20 托管滴灌 ${selectedField.area}，预计补水 120L`
      : `${selectedField.area} 维持观察，下一轮巡检 19:30`;
  $: aiTasks = [
    {
      label: "灌溉托管",
      metric: `${selectedField.moisture}%`,
      status: Number(selectedField.moisture) < 35 ? "待执行" : "观察",
      action: Number(selectedField.moisture) < 35 ? "补水 120L" : "保持阈值",
    },
    {
      label: "病害巡检",
      metric: `${selectedField.health}`,
      status: Number(selectedField.health) < 80 ? "加密" : "低风险",
      action: Number(selectedField.health) < 80 ? "复核叶面" : "巡检留档",
    },
    {
      label: "采收调度",
      metric: `${selectedField.maturity}%`,
      status: Number(selectedField.maturity) > 70 ? "生成" : "等待",
      action: Number(selectedField.maturity) > 70 ? "采收工单" : "长势跟踪",
    },
  ];

  onMount(() => {
    updateClock();
    clockTimer = setInterval(updateClock, 1000);
    connectWS();
    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimer);
      clearTimeout(connectGuard);
      clearInterval(clockTimer);
    };
  });

  afterUpdate(() => {
    if (eventContainer) eventContainer.scrollTop = eventContainer.scrollHeight;
  });

  function updateClock() {
    currentTime = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  }

  function connectWS() {
    connectionStatus = "连接中";
    clearTimeout(connectGuard);
    try {
      ws = new WebSocket("ws://127.0.0.1:18789");
      connectGuard = setTimeout(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          connectionStatus = "离线演示";
        }
      }, 900);

      ws.onopen = () => {
        clearTimeout(connectGuard);
        connectionStatus = "在线";
        ws.send(
          JSON.stringify({
            type: "register",
            node_id: "web_client",
            role: "observer",
          }),
        );
        pushEvent("LINK.ON", "Dashboard 已接入 FARMCLAW 网关。");
      };

      ws.onclose = () => {
        clearTimeout(connectGuard);
        connectionStatus = "离线演示";
        reconnectTimer = setTimeout(connectWS, 4000);
      };

      ws.onerror = () => {
        connectionStatus = "离线演示";
        try {
          ws.close();
        } catch (error) {
          console.error(error);
        }
      };

      ws.onmessage = (event) => {
        try {
          handleSystemEvent(JSON.parse(event.data));
        } catch (error) {
          console.error(error);
        }
      };
    } catch (error) {
      clearTimeout(connectGuard);
      connectionStatus = "离线演示";
      reconnectTimer = setTimeout(connectWS, 4000);
    }
  }

  function handleSystemEvent(payload) {
    if (payload.type === "topology_update") {
      nodes = payload.nodes.reduce(
        (acc, nodeId) => ({ ...acc, [nodeId]: true }),
        { gateway: true },
      );
      pushEvent("TOPOLOGY", `当前在线节点 ${Object.keys(nodes).length} 个。`);
      return;
    }

    if (payload.type === "node_joined") {
      nodes = { ...nodes, [payload.node_id]: true };
      pushEvent("NODE.UP", `${payload.node_id} 已接入。`);
      return;
    }

    if (payload.type !== "system_event") return;
    const msg = payload.original_message || {};
    if (msg.type === "rpc_response" && msg.result) ingestTelemetry(msg.result);
    if (msg.type === "chat" && msg.content) pushEvent("AI.CHAT", msg.content);
  }

  function ingestTelemetry(result) {
    const fieldId = result.field_id || selectedFieldId;
    fields = fields.map((field) => {
      if (field.id !== fieldId) return field;
      if (result.sensor === "soil_moisture") {
        return { ...field, moisture: Number(result.value).toFixed(2) };
      }
      if (result.sensor === "temperature") {
        return { ...field, temperature: Number(result.value).toFixed(0) };
      }
      return field;
    });
  }

  function sendCommand() {
    const text = command.trim();
    if (!text) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "chat", content: text }));
    }
    pushEvent("USER.CMD", text);
    command = "";
  }

  function switchView(item) {
    if (activeView === item.id) return;
    activeView = item.id;
    pushEvent("NAV.SWITCH", `切换至 ${item.label}。`);
  }

  function toggleAiManaged() {
    aiManaged = !aiManaged;
    pushEvent("AI.AUTO", `AI托管已切换为${aiManaged ? "托管中" : "人工确认"}模式。`);
  }

  function queueAiAction(task) {
    pushEvent("AI.PLAN", `${task.label}：${task.action}，状态 ${task.status}。`);
  }

  function queueModuleAction(type, text) {
    pushEvent(type, text);
  }

  function pushEvent(type, text) {
    eventStream = [
      ...eventStream,
      {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
        type,
        text,
      },
    ].slice(-80);
  }
</script>

<main
  class="greenhouse-screen"
  class:module-mode={activeView !== "overview"}
  style={`--greenhouse-hero: url("${greenhouseHero}"); --tomato-monitor: url("${tomatoMonitor}"); --corn-thumb: url("${cornThumb}"); --cabbage-thumb: url("${cabbageThumb}");`}
>
  <div class="matrix-grid"></div>
  <div class="top-line"></div>

  <header class="screen-header">
    <section class="brand-block">
      <h1>智慧农业大棚监管可视化</h1>
      <p>VISUALIZATION OF SMART AGRICULTURAL GREENHOUSE SUPERVISION</p>
    </section>

    <nav class="nav-tabs" aria-label="大棚导航">
      {#each navItems as item}
        <button class:active={activeView === item.id} type="button" on:click={() => switchView(item)}>
          {item.label}
        </button>
      {/each}
    </nav>

    <section class="weather-strip" aria-label="状态信息">
      <span>星期三</span>
      <strong>{currentTime}</strong>
      <span class="sun">☀</span>
      <span>晴 17~28°C</span>
      <em class:online={connectionStatus === "在线"}>{connectionStatus}</em>
    </section>
  </header>

  {#if activeView === "overview"}
  <section class="hero-visual" aria-label="园区总览">
    <div class="greenhouse-model" aria-label="数字孪生温室模型">
      <div class="far-house"></div>
      <div class="scan-beam"></div>
      <div class="glass-shell">
        <div class="roof-grid"></div>
        <div class="crop-bed">
          {#each cropColumns as column}
            <span style={`--i:${column}`}></span>
          {/each}
        </div>
      </div>
      <div class="crop-forest">
        {#each cropColumns as column}
          <i style={`--i:${column}`}></i>
        {/each}
      </div>
      {#each particles as particle}
        <b
          class="particle"
          style={`left:${particle.left}%; top:${particle.top}%; animation-delay:${particle.delay}s`}
        ></b>
      {/each}
      <section class="greenhouse-live-panel" aria-label="实时大棚数据">
        <header>
          <span>DIGITAL TWIN</span>
          <strong>{selectedField.area} 实时数据</strong>
        </header>
        <p>{selectedField.crop} / {selectedField.batch}</p>
        <div class="live-readout-grid">
          {#each greenhouseReadouts as item}
            <div>
              <small>{item.label}</small>
              <strong>{item.value}</strong>
              <em>{item.hint}</em>
            </div>
          {/each}
        </div>
        <footer>
          <span>{connectionStatus}</span>
          <span>在线节点 {nodeCount}</span>
        </footer>
      </section>
      <section class="twin-zone-strip" aria-label="孪生分区">
        <span>一区 灌溉</span>
        <span>二区 长势</span>
        <span>三区 采收</span>
      </section>
      {#each greenhousePins as pin}
        <span class={`sensor-pin ${pin.className}`}>
          <i></i>
          <b>{pin.label}</b>
          <strong>{pin.value}</strong>
        </span>
      {/each}
    </div>

    <section class="video-card">
      <div class="card-title">视频监控</div>
      <button class="close-dot" type="button" aria-label="关闭">×</button>
      <div class="video-frame">
        <div class="tomato-video">
          {#each Array.from({ length: 10 }) as _, index}
            <span style={`--i:${index}`}></span>
          {/each}
        </div>
      </div>
      <dl>
        <div><dt>批次</dt><dd>{selectedField.batch}</dd></div>
        <div><dt>数量</dt><dd>{selectedField.count}个</dd></div>
        <div><dt>成熟度</dt><dd>{selectedField.maturity}%</dd></div>
        <div><dt>土壤水分</dt><dd>{selectedField.moisture}%</dd></div>
        <div><dt>棚内温度</dt><dd>{selectedField.temperature}°C</dd></div>
      </dl>
    </section>

    <button class="camera-btn" type="button" aria-label="拍照">▣</button>
  </section>

  <aside class="crop-list" aria-label="作物列表">
    {#each fields as field}
      <button
        class="crop-card"
        class:selected={field.id === selectedFieldId}
        class:image-tomato={field.image === "tomato"}
        class:image-corn={field.image === "corn"}
        class:image-cabbage={field.image === "cabbage"}
        type="button"
        on:click={() => (selectedFieldId = field.id)}
      >
        <span class="thumb"></span>
        <span class="crop-info">
          <strong>{field.name}</strong>
          <small>追溯批次 <b>{field.batch}</b></small>
          <small>种植数量 <b>{field.count}</b> 株</small>
        </span>
        <span class="maturity">成熟度 <b>{field.maturity}</b>%</span>
      </button>
    {/each}
  </aside>

  <section class="bottom-panels">
    <article class="data-panel overview-panel">
      <header>
        <span class="leaf-badge">✓</span>
        <h2>温室概览</h2>
        <em>Greenhouse overview</em>
      </header>
      <div class="overview-grid">
        {#each overviewStats as item}
          <div>
            <span>{item.icon}</span>
            <p>{item.label}</p>
            <strong>{item.value}</strong>
          </div>
        {/each}
      </div>
      <div class="ring-chart" aria-label="作物占比">
        <span></span>
        <ul>
          <li><b></b>作物一 20%</li>
          <li><b></b>作物二 45%</li>
          <li><b></b>作物三 23%</li>
          <li><b></b>作物四 12%</li>
        </ul>
      </div>
    </article>

    <article class="data-panel yield-panel">
      <header>
        <span class="leaf-badge">✓</span>
        <h2>产量分析</h2>
        <em>Yield analysis</em>
      </header>
      <div class="pill-switch">
        <button type="button" class="active">西红柿</button>
        <button type="button">玉米</button>
        <button type="button">白菜</button>
      </div>
      <div class="chart-bars">
        {#each [68, 32, 74, 61, 39, 58, 70] as height, index}
          <i style={`--h:${height}%; --d:${index}`}></i>
        {/each}
        <svg viewBox="0 0 260 90" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M0,58 C34,80 52,66 72,45 C96,16 124,18 140,50 C160,88 190,72 208,44 C228,18 244,34 260,54"
          />
        </svg>
      </div>
    </article>

    <article class="data-panel ai-panel">
      <header>
        <span class="leaf-badge ai-badge">AI</span>
        <h2>AI托管</h2>
        <em>Managed autopilot</em>
      </header>
      <div class="ai-control-row">
        <button class:active={aiManaged} type="button" on:click={toggleAiManaged}>
          {aiManaged ? "托管中" : "人工确认"}
        </button>
        <span>可信度 <b>{aiTrustScore}</b>%</span>
      </div>
      <section class="ai-decision">
        <small>下一步策略</small>
        <strong>{aiNextAction}</strong>
        <p>{selectedField.crop} / {selectedField.batch}</p>
      </section>
      <ul class="ai-task-list">
        {#each aiTasks as task}
          <li>
            <span>{task.label}</span>
            <strong>{task.metric}</strong>
            <em>{task.status}</em>
            <button type="button" on:click={() => queueAiAction(task)}>{task.action}</button>
          </li>
        {/each}
      </ul>
      <div class="ai-guardrails">
        {#each aiGuardrails as item}
          <span>{item}</span>
        {/each}
      </div>
    </article>

    <article class="data-panel equipment-panel">
      <header>
        <span class="leaf-badge">✓</span>
        <h2>设备状态</h2>
        <em>Equipment status</em>
      </header>
      <table>
        <thead>
          <tr><th>大棚</th><th>设备</th><th>状态</th></tr>
        </thead>
        <tbody>
          {#each equipmentRows as row}
            <tr><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td></tr>
          {/each}
        </tbody>
      </table>
      <form class="command-line" on:submit|preventDefault={sendCommand}>
        <input bind:value={command} placeholder="输入：查看追溯 / 灌溉建议 / 病虫害风险" />
        <button type="submit">执行</button>
      </form>
    </article>
  </section>

  {:else if activeView === "environment"}
  <section class="module-workspace environment-workspace" aria-label="大棚2 环境监测">
    <header class="module-title">
      <span>GREENHOUSE 02</span>
      <h2>大棚2 环境监测</h2>
      <p>覆盖温湿度、CO₂、光照、土壤水分与 pH，按有机种植阈值联动通风、滴灌和巡检策略。</p>
    </header>

    <section class="module-kpi-grid">
      {#each environmentReadouts as item}
        <article class={`module-card metric-card tone-${item.tone}`}>
          <small>{item.label}</small>
          <strong>{item.value}</strong>
          <span>{item.target}</span>
          <em>{item.status}</em>
        </article>
      {/each}
    </section>

    <section class="module-card climate-panel">
      <header>
        <h3>24 小时环境曲线</h3>
        <span>AI threshold tracking</span>
      </header>
      <div class="trend-bars">
        {#each climateTrend as value}
          <i style={`--bar:${value}%`}></i>
        {/each}
      </div>
      <div class="threshold-list">
        {#each environmentRules as rule}
          <div>
            <strong>{rule[0]}</strong>
            <span>{rule[1]}</span>
            <em>{rule[2]}</em>
          </div>
        {/each}
      </div>
    </section>

    <section class="module-card action-panel">
      <h3>AI 环控建议</h3>
      <p>大棚2 当前土壤水分处于低位，建议 16:20 前执行 80L 分段滴灌，并保持侧窗 22% 通风。</p>
      <div class="action-grid">
        <button type="button" on:click={() => queueModuleAction("ENV.PLAN", "已生成大棚2 80L 分段滴灌建议。")}>生成滴灌建议</button>
        <button type="button" on:click={() => queueModuleAction("ENV.CHECK", "已安排大棚2 夜间叶面湿度复核。")}>安排夜间复核</button>
      </div>
    </section>

    <aside class="module-card module-events">
      <h3>事件流</h3>
      {#each eventStream.slice(-6) as event}
        <div><time>{event.time}</time><strong>{event.type}</strong><span>{event.text}</span></div>
      {/each}
    </aside>
  </section>
  {:else if activeView === "operations"}
  <section class="module-workspace operations-workspace" aria-label="设备运维">
    <header class="module-title">
      <span>DEVICE OPS</span>
      <h2>设备运维</h2>
      <p>集中查看阀门、水泵、卷帘、补光灯与边缘网关状态，支持巡检工单和远程动作留痕。</p>
    </header>

    <section class="module-kpi-grid ops-kpis">
      {#each operationsKpis as item}
        <article class="module-card metric-card">
          <small>{item.label}</small>
          <strong>{item.value}</strong>
          <span>{item.hint}</span>
        </article>
      {/each}
    </section>

    <section class="module-card fleet-panel">
      <header>
        <h3>设备健康</h3>
        <button type="button" on:click={() => queueModuleAction("OPS.SCAN", "已启动设备健康巡检。")}>巡检</button>
      </header>
      {#each equipmentFleet as item}
        <div class="fleet-row">
          <span>{item.name}<small>{item.area}</small></span>
          <b>{item.status}</b>
          <i><em style={`width:${item.health}%`}></em></i>
          <strong>{item.health}%</strong>
        </div>
      {/each}
    </section>

    <section class="module-card workorder-panel">
      <header>
        <h3>运维工单</h3>
        <span>今日排程</span>
      </header>
      {#each workOrders as order}
        <article>
          <time>{order.time}</time>
          <strong>{order.title}</strong>
          <span>{order.owner}</span>
          <em>{order.level}</em>
        </article>
      {/each}
    </section>

    <section class="module-card action-panel">
      <h3>远程操作</h3>
      <p>所有远程动作进入事件流并保留人工确认记录，避免直接跳过现场安全检查。</p>
      <div class="action-grid">
        <button type="button" on:click={() => queueModuleAction("OPS.CMD", "卷帘电机 A2 已下发 30% 开合测试。")}>卷帘测试</button>
        <button type="button" on:click={() => queueModuleAction("OPS.CMD", "滴灌泵 P-03 已加入保养锁定队列。")}>锁定水泵</button>
      </div>
    </section>

    <aside class="module-card module-events">
      <h3>事件流</h3>
      {#each eventStream.slice(-6) as event}
        <div><time>{event.time}</time><strong>{event.type}</strong><span>{event.text}</span></div>
      {/each}
    </aside>
  </section>
  {:else if activeView === "security"}
  <section class="module-workspace security-workspace" aria-label="安防管理">
    <header class="module-title">
      <span>SECURITY CENTER</span>
      <h2>安防管理</h2>
      <p>联动入口门禁、棚内通道、投入品库和周界感知，按有机生产要求保留访问与处置记录。</p>
    </header>

    <section class="security-feed-grid">
      {#each securityFeeds as feed}
        <article class="module-card security-feed">
          <header>
            <strong>{feed.name}</strong>
            <span>{feed.status}</span>
          </header>
          <div class="camera-surface">
            <i></i><i></i><i></i>
          </div>
          <p>{feed.metric}</p>
        </article>
      {/each}
    </section>

    <section class="module-card access-panel">
      <header>
        <h3>门禁策略</h3>
        <button type="button" on:click={() => queueModuleAction("SEC.ARM", "大棚2 与投入品库已重新布防。")}>重新布防</button>
      </header>
      {#each accessRules as rule}
        <div>
          <strong>{rule.label}</strong>
          <span>{rule.value}</span>
          <em>{rule.state}</em>
        </div>
      {/each}
    </section>

    <section class="module-card workorder-panel security-log">
      <header>
        <h3>安防记录</h3>
        <span>最近事件</span>
      </header>
      {#each securityEvents as item}
        <article>
          <time>{item[0]}</time>
          <strong>{item[1]}</strong>
          <span>{item[2]}</span>
          <em>留痕</em>
        </article>
      {/each}
    </section>

    <section class="module-card action-panel">
      <h3>处置入口</h3>
      <p>异常复核、门禁放行、投入品库开门均需写入事件流，便于后续审计和有机认证追溯。</p>
      <div class="action-grid">
        <button type="button" on:click={() => queueModuleAction("SEC.REVIEW", "已创建北门入口访客复核任务。")}>访客复核</button>
        <button type="button" on:click={() => queueModuleAction("SEC.AUDIT", "已导出投入品库访问审计摘要。")}>导出审计</button>
      </div>
    </section>

    <aside class="module-card module-events">
      <h3>事件流</h3>
      {#each eventStream.slice(-6) as event}
        <div><time>{event.time}</time><strong>{event.type}</strong><span>{event.text}</span></div>
      {/each}
    </aside>
  </section>
  {/if}

  <section class="event-dock" bind:this={eventContainer}>
    <strong>实时事件</strong>
    {#each eventStream as event}
      <span>{event.time}</span>
      <em>{event.type}</em>
      <p>{event.text}</p>
    {/each}
    <small>在线节点：{nodeCount}</small>
  </section>
</main>
