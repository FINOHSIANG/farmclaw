import { createRouter, createWebHashHistory } from 'vue-router'
const routerHistory = createWebHashHistory(import.meta.env.BASE_URL)

const router = createRouter({
  history: routerHistory,
  mode: 'hash',
  routes: [
    {
      path:'/',
      redirect: '/index'
    },
    {
      path: '/index',
      component: () => import('@/views/index.vue')
    },
    // {
    //   path: '/map',
    //   redirect: '/map/amap',
    //   component: () => import('@/views/Layout/index.vue'),
    //   children: [
    //     {
    //       path: 'wind',
    //       name: 'wind',
    //       meta: { title: '动态风场' },
    //       component: () => import('@/views/Gallery/map/WindLayer')
    //     },
    //     {
    //       path: 'tree',
    //       name: 'tree',
    //       meta: { title: '种树' },
    //       component: () => import('@/views/Gallery/map/treeLayer')
    //     }
    //   ]
    // }
  ]
})

export default router
