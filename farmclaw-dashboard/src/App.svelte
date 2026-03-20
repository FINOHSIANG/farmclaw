<script>
  import { onMount, afterUpdate } from "svelte";

  // System States
  let ws;
  let connectionStatus = "OFFLINE";
  let nodes = {};
  let activeFlows = [];

  // Terminal & Sniffer
  let chatHistory = [];
  let rpcPackets = [];
  let userCommand = "";
  let snifferContainer;
  let chatContainer;

  // Telemetry & Algorithms
  let telemetryData = {
    temperature: "00.0",
    moisture: "00",
    light: "0000",
    weather: "AWAITING SYNC",
    status: "STANDBY_MODE",
  };

  // Phase 8: Harvest & Planting Alg
  let harvestEst = { tons: "0.00", days: "--", yieldTrend: "+0.0%" };
  let algorithmPoints =
    "0,50 10,48 20,49 30,52 40,50 50,45 60,30 70,35 80,20 90,15 100,5"; // Example SVG polyline

  // Topological layout mapped to percentages for SVG placement
  const layout = {
    cli_client_frontend: {
      x: "10%",
      y: "50%",
      label: "SYS.TERM",
      color: "#FBBF24",
    }, // Hex Amber
    web_client: { x: "10%", y: "50%", label: "WEB.CTRL", color: "#FBBF24" },
    gateway: { x: "35%", y: "50%", label: "GW.HUB.01", color: "#38BDF8" }, // Hex Light Blue
    pi_agent_core: { x: "60%", y: "30%", label: "COG.CORE", color: "#A78BFA" }, // Hex Purple
    farm_iot_sensors_v1: {
      x: "90%",
      y: "50%",
      label: "SENS.ARR",
      color: "#34D399",
    }, // Hex Emerald
    farm_weather_service_v1: {
      x: "90%",
      y: "80%",
      label: "METEO.SRV",
      color: "#94A3B8",
    }, // Hex Slate
  };

  const getPos = (nid) =>
    layout[nid] || { x: `50%`, y: `50%`, label: nid, color: "#64748B" };

  onMount(() => {
    connectWS();
    // Simulate slight algorithm shifts
    setInterval(updatePlantingAlgorithm, 2000);
    return () => {
      if (ws) ws.close();
    };
  });

  afterUpdate(() => {
    if (snifferContainer)
      snifferContainer.scrollTop = snifferContainer.scrollHeight;
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
  });

  function updatePlantingAlgorithm() {
    if (connectionStatus !== "ONLINE") return;
    const newPoints = Array.from(
      { length: 11 },
      (_, i) => `${i * 10},${Math.floor(Math.random() * 40 + 10)}`,
    ).join(" ");
    algorithmPoints = newPoints;
    // Fuzz the harvest
    if (telemetryData.status !== "STANDBY_MODE") {
      let currentTons = parseFloat(harvestEst.tons);
      if (currentTons === 0) currentTons = 42.5;
      harvestEst.tons = (currentTons + (Math.random() * 0.1 - 0.05)).toFixed(2);
      harvestEst.days = Math.floor(Math.random() * 20 + 40);
      harvestEst.yieldTrend = `+${(Math.random() * 2.5).toFixed(1)}%`;
    }
  }

  function connectWS() {
    connectionStatus = "AWAITING_UPLINK";
    ws = new WebSocket("ws://127.0.0.1:18789");

    ws.onopen = () => {
      connectionStatus = "ONLINE";
      ws.send(
        JSON.stringify({
          type: "register",
          node_id: "web_client",
          role: "observer",
        }),
      );
    };

    ws.onclose = () => {
      connectionStatus = "OFFLINE";
      setTimeout(connectWS, 3000);
    };

    ws.onmessage = (event) => {
      try {
        handleSystemEvent(JSON.parse(event.data));
      } catch (e) {
        console.error(e);
      }
    };
  }

  function handleSystemEvent(payload) {
    if (payload.type === "topology_update") {
      nodes = payload.nodes.reduce((acc, nid) => {
        acc[nid] = true;
        return acc;
      }, {});
      nodes["gateway"] = true;
    } else if (payload.type === "node_joined") {
      nodes[payload.node_id] = true;
    } else if (payload.type === "system_event") {
      const src = payload.source;
      const msg = payload.original_message;

      // Sniffer
      rpcPackets = [
        ...rpcPackets,
        {
          id: Date.now() + Math.random(),
          time: new Date().toLocaleTimeString("en-US", { hour12: false }),
          source: src,
          type: msg.type,
          raw: JSON.stringify(msg),
        },
      ].slice(-60);

      // Data Process Logic
      if (msg.type === "chat") {
        const isAgent = src === "pi_agent_core";
        chatHistory = [
          ...chatHistory,
          {
            id: Date.now(),
            sender: isAgent ? "COG.CORE" : "SYS.TERM",
            text: msg.content,
            isAgent,
          },
        ];

        if (isAgent) {
          telemetryData.status = "IDLE";
          triggerFlow("pi_agent_core", "gateway", "#A78BFA");
          setTimeout(
            () => triggerFlow("gateway", "cli_client_frontend", "#FBBF24"),
            500,
          );
          setTimeout(
            () => triggerFlow("gateway", "web_client", "#FBBF24"),
            500,
          );
        } else {
          telemetryData.status = "CALCULATING";
          triggerFlow(src, "gateway", "#FBBF24");
          setTimeout(
            () => triggerFlow("gateway", "pi_agent_core", "#A78BFA"),
            500,
          );
        }
      } else if (msg.type === "rpc_request") {
        telemetryData.status = `EXEC:${msg.skill.toUpperCase()}`;
        let target_node =
          Object.keys(layout).find((k) => k.includes("farm") && k !== src) ||
          "farm_iot_sensors_v1";
        triggerFlow(src, "gateway", "#34D399");
        setTimeout(() => triggerFlow("gateway", target_node, "#34D399"), 500);
      } else if (msg.type === "rpc_response") {
        telemetryData.status = `PARSING_RPC`;
        if (msg.result && typeof msg.result === "object") {
          if (msg.result.temperature)
            telemetryData.temperature = String(msg.result.temperature);
          if (msg.result.soil_moisture)
            telemetryData.moisture = String(msg.result.soil_moisture);
          if (msg.result.light_intensity)
            telemetryData.light = String(msg.result.light_intensity);
          if (msg.result.summary)
            telemetryData.weather = msg.result.summary.toUpperCase();
        }
        triggerFlow(src, "gateway", "#38BDF8");
        setTimeout(
          () => triggerFlow("gateway", "pi_agent_core", "#A78BFA"),
          500,
        );
      }
    }
  }

  function triggerFlow(sourceId, targetId, color) {
    activeFlows = [
      ...activeFlows,
      {
        id: Date.now() + Math.random(),
        source: sourceId,
        target: targetId,
        color,
      },
    ];
    setTimeout(() => {
      activeFlows = activeFlows.slice(1);
    }, 1200);
  }

  function sendCommand() {
    if (!userCommand.trim() || !ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: "chat", content: userCommand }));
    userCommand = "";
  }
</script>

<main class="dashboard-agritech">
  <!-- Global Scanlines Overlay -->
  <div class="scanlines"></div>

  <!-- Header Section -->
  <header class="masthead">
    <div class="brand">
      <span class="logo-mark">FC-01</span>
      <div>
        <h1
          class="font-mono font-bold tracking-widest leading-none text-highlight"
        >
          FARMCLAW // MAINFRAME
        </h1>
        <div class="sub-brand">AGRITECH DISTRIBUTED CONTROL PLANE v2.0</div>
      </div>
    </div>
    <div
      class="connection-status {connectionStatus === 'ONLINE'
        ? 'online'
        : 'offline'}"
    >
      <span class="blink-dot"></span>SYS_STATUS: {connectionStatus}
    </div>
  </header>

  <!-- Industrial Grid Layout -->
  <div class="agri-grid">
    <!-- Panel A: Network Topology -->
    <section class="pnl pnl-topology">
      <div class="pnl-head">
        NET_TOPOLOGY <span class="badge">[ACTIVE]</span>
      </div>
      <div class="topology-area relative">
        <!-- Geometric Grid Background -->
        <div
          class="geo-grid absolute inset-0 opacity-10 pointer-events-none"
        ></div>

        <!-- Trunk Lines -->
        <svg class="absolute inset-0 w-full h-full pointer-events-none">
          <!-- Gateway to Users -->
          <line
            x1="10%"
            y1="50%"
            x2="35%"
            y2="50%"
            stroke="var(--border-dk)"
            stroke-width="2"
          />
          <!-- Gateway to Core -->
          <path
            d="M 35% 50% L 35% 30% L 60% 30%"
            fill="none"
            stroke="var(--border-dk)"
            stroke-width="2"
          />
          <!-- Gateway to IoT/Weather -->
          <path
            d="M 35% 50% L 60% 50% L 90% 50%"
            fill="none"
            stroke="var(--border-dk)"
            stroke-width="2"
          />
          <path
            d="M 60% 50% L 60% 80% L 90% 80%"
            fill="none"
            stroke="var(--border-dk)"
            stroke-width="2"
          />

          <!-- Nodes Rendering -->
          {#each Object.keys(nodes) as node_id}
            {#if getPos(node_id).label !== "SYS.TERM"}
              <g
                class="sys-node"
                transform="translate({getPos(node_id).x}, {getPos(node_id).y})"
              >
                <rect
                  x="-40"
                  y="-15"
                  width="80"
                  height="30"
                  fill="var(--bg-panel)"
                  stroke={getPos(node_id).color}
                  stroke-width="1.5"
                />
                <text
                  x="0"
                  y="4"
                  font-family="monospace"
                  font-size="10"
                  fill={getPos(node_id).color}
                  text-anchor="middle"
                  font-weight="bold">{getPos(node_id).label}</text
                >
                <!-- Brackets decoration -->
                <path
                  d="M -44 -19 L -44 -15 M -44 15 L -44 19 L -40 19 M 40 -19 L 44 -19 L 44 -15 M 44 15 L 44 19 L 40 19"
                  fill="none"
                  stroke="var(--text-muted)"
                  stroke-width="1"
                />
              </g>
            {/if}
          {/each}
        </svg>

        <!-- Active Data Traffic Animations -->
        {#each activeFlows as flow (flow.id)}
          {#if layout[flow.source] && layout[flow.target]}
            <div
              class="data-tracer"
              style="--sx: {layout[flow.source].x}; --sy: {layout[flow.source]
                .y}; --ex: {layout[flow.target].x}; --ey: {layout[flow.target]
                .y}; --tracer-col: {flow.color};"
            ></div>
          {/if}
        {/each}
      </div>
    </section>

    <!-- Panel B: New - Harvest Estimation -->
    <section class="pnl pnl-harvest">
      <div class="pnl-head">YIELD_ESTIMATION.CALC</div>
      <div
        class="pnl-body flex-col justify-center items-center gap-4 text-center"
      >
        <div class="yield-number text-highlight">
          {harvestEst.tons}<span class="unit">Tons</span>
        </div>
        <div
          class="flex gap-4 w-full px-4 justify-between text-xs font-mono text-muted uppercase"
        >
          <div>
            Trend: <span class="text-emerald-400">{harvestEst.yieldTrend}</span>
          </div>
          <div>
            Harvest In: <span class="text-amber-400">{harvestEst.days} D</span>
          </div>
        </div>
        <div
          class="w-full h-2 bg-slate-900 border border-slate-700 mt-2 relative"
        >
          <div
            class="absolute top-0 left-0 h-full bg-emerald-500/50 w-3/4 animate-pulse"
          ></div>
        </div>
      </div>
    </section>

    <!-- Panel C: Cognitive Terminal -->
    <section class="pnl pnl-cognitive">
      <div class="pnl-head flex justify-between">
        <span class="text-highlight">COG_OUTPUT_STREAM</span>
        <span class="opacity-50">[{telemetryData.status}]</span>
      </div>
      <div class="pnl-body flex-col chat-terminal" bind:this={chatContainer}>
        {#each chatHistory as chat}
          <div class="log-line {chat.isAgent ? 'sys-out' : 'usr-in'}">
            <span class="log-prefix">[{chat.sender}]></span>
            <span class="log-content">{chat.text}</span>
          </div>
        {/each}
      </div>
    </section>

    <!-- Panel D: Raw Telemetry Array -->
    <section class="pnl pnl-telemetry">
      <div class="pnl-head">TELEMETRY_ARRAY</div>
      <div class="pnl-body grid grid-cols-2 gap-[1px] bg-slate-800 p-[1px]">
        <div class="telem-box">
          <div class="lbl text-rose-500">TEMP_C</div>
          <div class="val">{telemetryData.temperature}°</div>
        </div>
        <div class="telem-box">
          <div class="lbl text-blue-400">SOIL_MOIST_PCT</div>
          <div class="val">{telemetryData.moisture}%</div>
        </div>
        <div class="telem-box">
          <div class="lbl text-amber-500">LUMEN_LUX</div>
          <div class="val">{telemetryData.light}</div>
        </div>
        <div class="telem-box">
          <div class="lbl text-cyan-400">WX_METAR</div>
          <div class="val text-[11px] leading-tight flex items-center">
            {telemetryData.weather}
          </div>
        </div>
      </div>
    </section>

    <!-- Panel E: New - Algorithmic Preview -->
    <section class="pnl pnl-algorithm">
      <div class="pnl-head">PLANTING_ALG_VECTOR</div>
      <div
        class="pnl-body relative overflow-hidden flex items-center justify-center p-2"
      >
        <svg
          viewBox="0 0 100 60"
          class="w-full h-full"
          preserveAspectRatio="none"
        >
          <!-- Dynamic Polyline -->
          <polyline
            points={algorithmPoints}
            fill="none"
            stroke="#FBBF24"
            stroke-width="1"
            class="alg-line"
          />
          <!-- Helper grid -->
          <path
            d="M 0 15 L 100 15 M 0 30 L 100 30 M 0 45 L 100 45"
            stroke="rgba(255,255,255,0.05)"
            stroke-width="0.5"
            stroke-dasharray="2"
          />
        </svg>
        <div
          class="absolute bottom-1 right-2 text-[8px] font-mono text-amber-500/50"
        >
          VAR_X: MATURITY
        </div>
      </div>
    </section>

    <!-- Panel F: RPC Sniffer Log -->
    <section class="pnl pnl-sniffer">
      <div class="pnl-head border-l-4 border-l-red-500 pl-2">
        RAW_RPC_SOCKET_DUMP
      </div>
      <div class="pnl-body sniffer-logs" bind:this={snifferContainer}>
        {#each rpcPackets as pkt (pkt.id)}
          <div class="sniff-line">
            <span class="s-time">{pkt.time}</span>
            <span
              class="s-type {pkt.type === 'rpc_request'
                ? 'text-amber-400'
                : 'text-emerald-400'}">[{pkt.type}]</span
            >
            <span class="s-src">{pkt.source}</span>
            <span class="s-raw">{pkt.raw}</span>
          </div>
        {/each}
      </div>
    </section>

    <!-- Terminal Prompt Input -->
    <form class="pnl cmd-prompt" on:submit|preventDefault={sendCommand}>
      <div class="prompt-arrow">C:\>_</div>
      <input
        bind:value={userCommand}
        type="text"
        class="cmd-input"
        placeholder="Execute core directives..."
        autocomplete="off"
      />
      <button type="submit" class="cmd-btn">[ EXEC ]</button>
    </form>
  </div>
</main>

<style>
  /* Industrial Agritech Design System (Phase 8) */

  :global(body) {
    margin: 0;
    background-color: #050505;
    color: #c8d2d9;
    font-family: "JetBrains Mono", "Courier New", Courier, monospace;
  }

  /* Base Variables */
  .dashboard-agritech {
    --bg-dark: #07090b;
    --bg-panel: #0b0f15;
    --border-dk: #1f2937;
    --border-hl: #374151;
    --highlight: #34d399; /* Emerald */
    --highlight-alt: #fbbf24; /* Amber */
    --text-muted: #64748b;

    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 1rem;
    box-sizing: border-box;
    position: relative;
  }

  /* Scanlines overlay */
  .scanlines {
    position: fixed;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0),
      rgba(255, 255, 255, 0) 50%,
      rgba(0, 0, 0, 0.1) 50%,
      rgba(0, 0, 0, 0.1)
    );
    background-size: 100% 4px;
    pointer-events: none;
    z-index: 999;
    opacity: 0.3;
  }

  /* Header */
  .masthead {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 2px solid var(--border-hl);
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .logo-mark {
    background: var(--highlight);
    color: #000;
    padding: 0.25rem 0.5rem;
    font-weight: 900;
    font-size: 1.25rem;
  }
  .sub-brand {
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    color: var(--text-muted);
  }
  .text-highlight {
    color: var(--highlight);
  }

  /* Indicators */
  .connection-status {
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--border-dk);
    padding: 0.25rem 0.5rem;
  }
  .connection-status.online {
    color: var(--highlight);
    border-color: var(--highlight);
  }
  .connection-status.offline {
    color: #f87171;
    border-color: #f87171;
  }
  .blink-dot {
    width: 6px;
    height: 6px;
    background-color: currentColor;
    display: block;
  }
  .online .blink-dot {
    animation: pulseBg 1s step-end infinite;
  }
  @keyframes pulseBg {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }

  /* Grid Definition */
  .agri-grid {
    flex: 1;
    display: grid;
    grid-template-columns: 2fr 1.2fr 1.2fr;
    grid-template-rows: 150px 180px minmax(0, 1fr) 50px;
    gap: 12px;
    min-height: 0;
  }

  /* Panel Assignment */
  .pnl-topology {
    grid-column: 1;
    grid-row: 1 / 4;
  }
  .pnl-harvest {
    grid-column: 2;
    grid-row: 1;
  }
  .pnl-algorithm {
    grid-column: 3;
    grid-row: 1;
  }
  .pnl-cognitive {
    grid-column: 2 / 4;
    grid-row: 2;
  }
  .pnl-telemetry {
    grid-column: 2 / 4;
    grid-row: 3;
  }
  .pnl-sniffer {
    grid-column: 1 / 4;
    grid-row: 4;
    height: 120px;
    align-self: end;
  }
  .cmd-prompt {
    grid-column: 1 / 4;
    grid-row: 5;
  }

  /* Panel Styling */
  .pnl {
    background: var(--bg-panel);
    border: 1px solid var(--border-dk);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }
  /* Cut-corner effect top-right */
  .pnl::before {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    border-width: 0 15px 15px 0;
    border-style: solid;
    border-color: #050505 var(--bg-dark) transparent transparent;
    display: block;
    width: 0;
  }

  .pnl-head {
    padding: 0.4rem 0.75rem;
    font-size: 0.7rem;
    font-weight: bold;
    letter-spacing: 0.15em;
    background: #111827;
    border-bottom: 1px solid var(--border-dk);
    color: #9ca3af;
    text-transform: uppercase;
  }
  .pnl-body {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  /* SVG Backgrounds */
  .geo-grid {
    background-image: linear-gradient(var(--border-dk) 1px, transparent 1px),
      linear-gradient(90deg, var(--border-dk) 1px, transparent 1px);
    background-size: 20px 20px;
  }

  /* Data Tracer Animation */
  .data-tracer {
    position: absolute;
    width: 4px;
    height: 16px;
    background-color: var(--tracer-col);
    box-shadow: 0 0 10px var(--tracer-col);
    transform: translate(-50%, -50%);
    animation: tracePath 1s linear forwards;
    z-index: 10;
  }
  @keyframes tracePath {
    0% {
      left: var(--sx);
      top: var(--sy);
      opacity: 1;
    }
    100% {
      left: var(--ex);
      top: var(--ey);
      opacity: 0;
    }
  }

  /* Harvest Mod */
  .yield-number {
    font-size: 3.5rem;
    font-weight: 300;
    line-height: 1;
    padding: 1rem 0;
    font-family: "Courier New", Courier, monospace;
    letter-spacing: -2px;
  }
  .unit {
    font-size: 1rem;
    color: var(--text-muted);
    padding-left: 0.2rem;
  }

  /* Algorithm Mod */
  .alg-line {
    animation: lineDraw 2s linear infinite alternate;
  }
  @keyframes lineDraw {
    0% {
      opacity: 0.5;
      stroke-width: 1px;
    }
    100% {
      opacity: 1;
      stroke-width: 2px;
    }
  }

  /* Telemetry Grid */
  .telem-box {
    background: var(--bg-panel);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 0.75rem;
    border: 1px solid transparent;
  }
  .telem-box:hover {
    border-color: var(--border-hl);
  }
  .telem-box .lbl {
    font-size: 0.65rem;
    font-weight: bold;
    letter-spacing: 0.1em;
  }
  .telem-box .val {
    font-size: 2rem;
    font-family: "Courier New", monospace;
    font-weight: 300;
  }

  /* Terminals (Cognitive & Sniffer) */
  .chat-terminal {
    overflow-y: auto;
    padding: 0.75rem;
    font-size: 0.8rem;
    gap: 0.5rem;
  }
  .log-line {
    display: flex;
    gap: 0.5rem;
  }
  .log-prefix {
    opacity: 0.6;
    min-width: 60px;
  }
  .sys-out {
    color: #a78bfa;
  } /* Agent */
  .usr-in {
    color: #fbbf24;
  } /* User */

  .sniffer-logs {
    overflow-y: auto;
    font-size: 0.6rem;
    padding: 0.5rem;
    background: #000;
    display: block;
  }
  .sniff-line {
    font-family: monospace;
    line-height: 1.4;
    border-bottom: 1px dashed #1f2937;
    padding-bottom: 2px;
    margin-bottom: 2px;
  }
  .sniff-line:hover {
    background: #111;
  }
  .s-time {
    color: #6b7280;
    margin-right: 0.5rem;
  }
  .s-src {
    color: #818cf8;
    margin: 0 0.5rem;
  }
  .s-raw {
    color: #4b5563;
    word-break: break-all;
  }

  /* Command Bar */
  .cmd-prompt {
    flex-direction: row;
    align-items: center;
    border: 1px solid var(--highlight);
    background: rgba(52, 211, 153, 0.05);
    padding: 0;
  }
  .prompt-arrow {
    padding: 0 1rem;
    color: var(--highlight);
    font-weight: bold;
  }
  .cmd-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #fff;
    font-family: inherit;
    font-size: 1rem;
  }
  .cmd-btn {
    background: var(--highlight);
    color: #000;
    border: none;
    padding: 0 2rem;
    height: 100%;
    font-weight: 900;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.1s;
  }
  .cmd-btn:active {
    background: #fff;
  }

  /* Scrollbars */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: var(--bg-dark);
    border-left: 1px solid var(--border-dk);
  }
  ::-webkit-scrollbar-thumb {
    background: var(--border-hl);
    border-radius: 0;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted);
  }
</style>
