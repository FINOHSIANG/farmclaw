let mainMap = null
const AMAP_KEY = import.meta.env.VITE_AMAP_KEY?.trim()

// 默认开启WebGL
// window.forceWebGL = true

const pluginsList = [
  'AMap.PolyEditor',
  'AMap.CustomLayer',
  'AMap.ControlBar',
  'AMap.Heatmap',
  'Map3D',
  'AMap.GLCustomLayer',
  'AMap.Buildings',
  'AMap.Size',
  'AMap.LngLat',
  'AMap.3DTilesLayer',
  'AMap.PolyEditor',
  'AMap.PolylineEditor'
]

/**
 * 获取地图
 */
export function getMap () {
  return mainMap
}

/**
 * 删除地图
 */
export function destoryMap () {
  if (mainMap) {
    mainMap.clearMap()
    mainMap.destroy()
  }
}

/**
 * 初始化地图
 * @param {Object} conf 地图配置
 * @return {AMap.Map} map 地图实例
 */
export function initMap ({
  dom,
  zoom = 11,
  zooms = [3, 22],
  viewMode = '3D',
  rotation = 0,
  pitch = 30,
  center = [113.533339, 22.794258],
  mapStyle,
  mask,
  skyColor,
  showBuildingBlock = true
} = {}) {
  return new Promise((resolve, reject) => {
    loadFile()
      .then(() => {
        const container = dom || 'container'
        const map = new AMap.Map(container, {
          center,
          resizeEnable: true,
          zooms,
          viewMode,
          defaultCursor: 'default',
          pitch,
          mapStyle: mapStyle || 'amap://styles/grey',
          expandZoomRange: true,
          rotation,
          zoom,
          skyColor,
          showBuildingBlock: false, // 不显示默认建筑物
          features: ['bg', 'road', 'point'], // 不显示默认建筑物
          layers: [
            AMap.createDefaultLayer(),
            new AMap.Buildings({
              zooms: [10, 22],
              zIndex: 2,
              // heightFactor: 1.2, // 修改该值会导致显示异常
              roofColor: 'rgba(171,211,234,0.9)',
              wallColor: 'rgba(34,64,169,0.5)',
              opacity: 0.7,
              visible: showBuildingBlock
            })
          ],
          mask: mask || null
        })
        mainMap = map
        window.mainMap = map
        resolve(map)
      })
      .catch((err) => {
        reject(err)
      })
  })
}

/**
 * 加载地图文件
 */
export function loadFile () {
  return new Promise((resolve, reject) => {
    if (!AMAP_KEY) {
      reject(new Error('缺少高德地图 Key，请在 .env.local 中配置 VITE_AMAP_KEY'))
      return
    }
    if (window.AMap && window.Loca) {
      resolve()
    } else {
      // 加载maps.js
      const url = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&callback=_mapLoaded&plugin=${pluginsList.join(
        ','
      )}`
      const jsapi = document.createElement('script')
      jsapi.charset = 'utf-8'
      jsapi.src = url
      document.head.appendChild(jsapi)
      jsapi.onerror = function () {
        reject(new Error('地图API文件加载失败'))
      }
    }

    // 加载loca.js
    window._mapLoaded = function () {
      const arr = [
        `https://webapi.amap.com/loca?v=2.0.0beta&key=${AMAP_KEY}`
        // `${location.protocol}//webapi.amap.com/ui/1.1/main-async.js`
      ]
      let count = 0

      for (let i = 0; i < arr.length; i++) {
        const jsapi = document.createElement('script')
        jsapi.charset = 'utf-8'
        jsapi.src = arr[i]
        document.head.appendChild(jsapi)
        jsapi.onload = function () {
          count++
          if (count >= arr.length) {
            resolve()
          }
        }
        jsapi.onerror = function () {
          reject(new Error('地图可视化API文件加载失败'))
        }
      }
    }
  })
}

export default getMap()
