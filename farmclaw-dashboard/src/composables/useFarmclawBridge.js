import { reactive } from 'vue'
import {
  MAX_TWIN_OBSERVATIONS,
  mergeTwinObservationRecord,
  normalizeTwinId,
  twinObservationHasAlert
} from '../utils/twinObservation.js'

const DEFAULT_READINGS = {
  temperature: { label: '空气温度', value: '--', unit: '°C' },
  soil_moisture: { label: '土壤水分', value: '--', unit: '%' },
  humidity: { label: '空气湿度', value: '--', unit: '%' },
  light: { label: '光照强度', value: '--', unit: 'lx' },
  ph: { label: '土壤 pH', value: '--', unit: '' }
}

export function getFarmclawDesktopApi(scope = globalThis) {
  const api = scope?.window?.farmclawDesktop || scope?.farmclawDesktop
  return api && typeof api.bootstrap === 'function' && typeof api.dshRequest === 'function' ? api : null
}

function textFromDshValue(value) {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(textFromDshValue).filter(Boolean).join('')
  if (!value || typeof value !== 'object') return ''
  if (typeof value.text === 'string') return value.text.trim()
  if (Array.isArray(value.texts)) return value.texts.filter((item) => typeof item === 'string').join('').trim()
  if (value.chunk !== undefined) return textFromDshValue(value.chunk)
  if (value.content !== undefined) return textFromDshValue(value.content)
  if (value.message !== undefined) return textFromDshValue(value.message)
  return ''
}

export function mapDshFrameToBridgeEvent(frame) {
  const payload = frame?.payload
  if (!payload || typeof payload !== 'object') return null
  if (payload.type === 'host/agent-error') {
    return { type: 'AI.ERROR', text: payload.message || 'DSH Agent 执行失败', source: 'dsh' }
  }
  if (payload.type === 'host/session-status') {
    return {
      type: payload.running ? 'AI.RUNNING' : 'AI.IDLE',
      text: payload.running ? 'DSH Agent 正在处理指令' : 'DSH Agent 已完成本轮处理',
      source: 'dsh'
    }
  }
  if (payload.type === 'session/assistant-stream') {
    const text = textFromDshValue(payload.frame)
    return text ? { type: 'AI.MESSAGE', text, source: 'dsh' } : null
  }
  if (payload.type === 'session/event') {
    const event = payload.event || {}
    const text = textFromDshValue(event.data)
    if (text) return { type: 'AI.MESSAGE', text, source: 'dsh' }
    return { type: 'AI.EVENT', text: `DSH 会话事件：${event.type || 'unknown'}`, source: 'dsh' }
  }
  return null
}

export function useFarmclawBridge() {
  const readingsByField = reactive({
    'greenhouse-1': structuredClone(DEFAULT_READINGS)
  })
  const state = reactive({
    connection: 'connecting',
    connectionLabel: '正在连接',
    nodes: [],
    readings: readingsByField['greenhouse-1'],
    readingsByField,
    activeField: 'greenhouse-1',
    twinObservations: Object.create(null),
    lastTwinObservation: null,
    twinObservationChanges: [],
    twinObservationRevision: 0,
    events: [],
    lastUpdatedAt: null
  })

  const gatewayUrl = import.meta.env?.VITE_FARMCLAW_WS_URL || 'ws://127.0.0.1:18789'
  const desktopApi = getFarmclawDesktopApi()
  let socket
  let reconnectTimer
  let stopped = false
  let dshReady = false
  let dshSessionId = ''
  let dshWorkspace = ''
  let removeDshFrameListener
  let removeRuntimeReadyListener
  let removeRuntimeErrorListener

  function pushEvent(type, text, source = 'farmclaw') {
    state.events.unshift({
      id: `${Date.now()}-${Math.random()}`,
      type,
      text,
      source,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false })
    })
    state.events = state.events.slice(0, 12)
  }

  function markTwinTransport(status, sourceNode = '') {
    const normalizedStatus = status === 'offline' ? 'offline' : 'online'
    const changedIds = []
    for (const observation of Object.values(state.twinObservations)) {
      if (sourceNode && observation.source_node !== sourceNode) continue
      if (observation.observation_transport_status === normalizedStatus) continue
      observation.observation_transport_status = normalizedStatus
      changedIds.push(observation.twin_id)
    }
    if (changedIds.length) {
      state.twinObservationChanges = changedIds
      state.lastTwinObservation = state.twinObservations[changedIds[0]] || state.lastTwinObservation
      state.twinObservationRevision += 1
    }
  }

  function ingestTelemetry(result) {
    if (!result || typeof result !== 'object') return
    const metric = result.metric || result.sensor
    if (!metric || !DEFAULT_READINGS[metric] || result.value == null) return

    const fieldId = result.field_id || state.activeField
    if (!readingsByField[fieldId]) readingsByField[fieldId] = structuredClone(DEFAULT_READINGS)
    const fieldReadings = readingsByField[fieldId]

    fieldReadings[metric] = {
      ...fieldReadings[metric],
      value: result.value,
      unit: result.unit || fieldReadings[metric].unit
    }
    state.activeField = fieldId
    state.readings = fieldReadings
    state.lastUpdatedAt = result.captured_at || new Date().toISOString()
    pushEvent('TELEMETRY', `${fieldId} ${fieldReadings[metric].label}更新为 ${result.value}${fieldReadings[metric].unit}`, result.source_node)
  }

  function ingestTwinObservation(payload, source = 'farmclaw') {
    if (!payload || typeof payload !== 'object') return
    const nested = payload.observation && typeof payload.observation === 'object' ? payload.observation : null
    const observation = nested
      ? {
          ...nested,
          twin_id: nested.twin_id || nested.twinId || payload.twin_id || payload.twinId,
          observation_mode: nested.observation_mode || nested.update_mode || nested.mode || payload.observation_mode || payload.update_mode || payload.mode,
          source_node: nested.source_node || payload.source_node || source
        }
      : { ...payload }
    observation.observation_transport_status = 'online'
    const twinId = normalizeTwinId(observation.twin_id || observation.twinId)
    if (!twinId) {
      pushEvent('TWIN.REJECTED', '对象观测编号缺失或格式不合法', source)
      return
    }
    const previous = state.twinObservations[twinId]
    if (!previous && Object.keys(state.twinObservations).length >= MAX_TWIN_OBSERVATIONS) {
      pushEvent('TWIN.REJECTED', `对象观测缓存已达 ${MAX_TWIN_OBSERVATIONS} 条上限`, source)
      return
    }
    const normalized = mergeTwinObservationRecord(previous, observation, observation.source_node || source)
    if (!normalized) return
    state.twinObservations[twinId] = normalized
    state.lastTwinObservation = normalized
    state.twinObservationChanges = [twinId]
    state.twinObservationRevision += 1
    const hasAlert = twinObservationHasAlert(normalized)
    pushEvent(hasAlert ? 'TWIN.ALERT' : 'TWIN.OBSERVATION', `${twinId} 已更新预警与摄像头识别结果`, normalized.source_node)
  }

  function handleMessage(message) {
    if (['twin_observation', 'camera_observation'].includes(message.type)) {
      ingestTwinObservation(message, message.source_node)
      return
    }
    if (message.type === 'topology_update') {
      state.nodes = message.nodes || []
      pushEvent('TOPOLOGY', `发现 ${state.nodes.length} 个在线业务节点`)
      return
    }

    if (message.type === 'node_joined') {
      state.nodes = Array.from(new Set([...state.nodes, message.node_id].filter(Boolean)))
      pushEvent('NODE.ONLINE', `${message.node_id} 已接入`, message.node_id)
      return
    }

    if (message.type === 'node_left') {
      state.nodes = state.nodes.filter((nodeId) => nodeId !== message.node_id)
      markTwinTransport('offline', message.node_id)
      pushEvent('NODE.OFFLINE', `${message.node_id} 已离线`, message.node_id)
      return
    }

    if (message.type !== 'system_event') return
    const original = message.original_message || {}
    if (original.type === 'node_joined' || original.type === 'node_left') {
      handleMessage(original)
      return
    }
    if (original.type === 'rpc_response') ingestTelemetry(original.result)
    if (['twin_observation', 'camera_observation'].includes(original.type)) ingestTwinObservation(original, message.source)
    if (original.type === 'chat' && original.content) {
      pushEvent('AI.MESSAGE', original.content, message.source)
    }
  }

  function handleDshFrame(frame) {
    const event = mapDshFrameToBridgeEvent(frame)
    if (event) pushEvent(event.type, event.text, event.source)
  }

  async function requestDsh(method, payload) {
    const body = await desktopApi.dshRequest(method, payload)
    const result = body?.result
    if (!result?.ok) throw new Error(result?.error?.message || 'DSH 请求失败')
    return result.value
  }

  async function ensureDshSession() {
    if (!desktopApi || !dshReady) return ''
    if (dshSessionId) return dshSessionId
    const created = await requestDsh('session.create', dshWorkspace ? { cwd: dshWorkspace } : {})
    dshSessionId = created?.sessionId || created?.id || ''
    if (!dshSessionId) throw new Error('DSH 未返回会话编号')
    await requestDsh('session.history', { sessionId: dshSessionId, maxMessages: 80 })
    pushEvent('AI.SESSION', '官方 DSH 会话已就绪', 'dsh')
    return dshSessionId
  }

  async function startDesktopRuntime() {
    if (!desktopApi) return
    removeDshFrameListener = desktopApi.onDshFrame?.(handleDshFrame)
    removeRuntimeReadyListener = desktopApi.onRuntimeReady?.(() => {
      dshReady = true
      void ensureDshSession().catch((error) => pushEvent('AI.ERROR', error.message, 'dsh'))
    })
    removeRuntimeErrorListener = desktopApi.onRuntimeError?.((message) => {
      dshReady = false
      dshSessionId = ''
      pushEvent('AI.FALLBACK', `官方 DSH 不可用，指令将回退网关：${message}`, 'dsh')
    })
    try {
      const bootstrap = await desktopApi.bootstrap()
      dshReady = bootstrap?.dshReady === true
      dshWorkspace = bootstrap?.workspace || ''
      if (dshReady) await ensureDshSession()
      else if (bootstrap?.startupError) pushEvent('AI.FALLBACK', `官方 DSH 尚未就绪：${bootstrap.startupError}`, 'dsh')
    } catch (error) {
      dshReady = false
      pushEvent('AI.FALLBACK', `桌面运行时初始化失败：${error.message}`, 'dsh')
    }
  }

  function connect() {
    if (stopped) return
    clearTimeout(reconnectTimer)
    state.connection = 'connecting'
    state.connectionLabel = '正在连接'

    try {
      socket = new WebSocket(gatewayUrl)
      socket.onopen = () => {
        state.connection = 'online'
        state.connectionLabel = '网关在线'
        socket.send(JSON.stringify({
          type: 'register',
          node_id: 'digital_farm_dashboard',
          role: 'observer'
        }))
        pushEvent('LINK.ONLINE', '数字农场场景已接入 Farmclaw 网关')
      }
      socket.onmessage = (event) => {
        try {
          handleMessage(JSON.parse(event.data))
        } catch (error) {
          pushEvent('MESSAGE.ERROR', '收到无法解析的网关消息')
          console.error(error)
        }
      }
      socket.onerror = () => socket?.close()
      socket.onclose = () => {
        state.connection = 'offline'
        state.connectionLabel = '离线演示'
        markTwinTransport('offline')
        if (!stopped) reconnectTimer = setTimeout(connect, 4000)
      }
    } catch (error) {
      state.connection = 'offline'
      state.connectionLabel = '离线演示'
      pushEvent('LINK.ERROR', error.message)
      reconnectTimer = setTimeout(connect, 4000)
    }
  }

  function sendGatewayCommand(message, agentLabel, summary, attachments) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
      if (attachments.length) pushEvent('ATTACHMENT.LOCAL', `${attachments.length} 个附件仅发送元数据，文件内容未上传`, 'operator')
      pushEvent('USER.COMMAND', `[${agentLabel}] ${message.content}${summary}`, 'operator')
      return true
    }
    pushEvent('COMMAND.PENDING', `网关离线，未发送：[${agentLabel}] ${message.content}${summary}`, 'operator')
    return false
  }

  function sendCommand(content, options = {}) {
    const text = content?.trim()
    if (!text) return false
    const attachments = Array.isArray(options.attachments) ? options.attachments.map(({ id, name, type, size, kind }) => ({ id, name, type, size, kind, uploaded: false })) : []
    const agentId = options.agentId || 'agri-advisor'
    const agentLabel = options.agentLabel || agentId
    const summary = attachments.length ? ` · 本地附件元数据 ${attachments.map((item) => item.name).join('、')}（未上传）` : ''
    const message = { type: 'chat', content: text, agent_id: agentId, agent_label: agentLabel, attachments }

    if (desktopApi && dshReady) {
      pushEvent('USER.COMMAND', `[${agentLabel}] ${text}${summary}`, 'operator')
      if (attachments.length) pushEvent('ATTACHMENT.LOCAL', `${attachments.length} 个附件仅保留本地元数据，未发送到 DSH`, 'operator')
      void ensureDshSession()
        .then((sessionId) => requestDsh('session.prompt', {
          sessionId,
          mode: 'queue',
          content: [{ type: 'text', text: `[${agentLabel}] ${text}` }],
          clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }))
        .catch((error) => {
          dshReady = false
          dshSessionId = ''
          pushEvent('AI.FALLBACK', `DSH 指令失败，已回退网关：${error.message}`, 'dsh')
          sendGatewayCommand(message, agentLabel, summary, attachments)
        })
      return true
    }
    return sendGatewayCommand(message, agentLabel, summary, attachments)
  }

  function start() {
    stopped = false
    connect()
    void startDesktopRuntime()
  }

  function stop() {
    stopped = true
    clearTimeout(reconnectTimer)
    socket?.close()
    removeDshFrameListener?.()
    removeRuntimeReadyListener?.()
    removeRuntimeErrorListener?.()
  }

  return { state, gatewayUrl, start, stop, sendCommand, pushEvent, ingestTwinObservation, handleMessage }
}
