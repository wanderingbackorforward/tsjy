import React, { useEffect, useState } from "react"
import V431StableRouter from "./V431StableRouter"
import V429V2AdvancedThreePages from "./V429V2AdvancedThreePages"

const ADVANCED_429_PATHS = new Set([
  "/operation-diagnosis",
  "/slurry-grouting",
  "/segment-quality",
])

function getLogicalPath() {
  const { pathname, hash } = window.location

  if (hash.startsWith("#/")) {
    return hash.slice(1).split("?")[0].split("#")[0] || "/"
  }

  let path = pathname.split("?")[0].split("#")[0] || "/"

  // 兼容部署在 /tsjy/ 子路径下
  path = path.replace(/^\/tsjy(?=\/|$)/, "")

  if (!path) path = "/"
  if (path.length > 1) path = path.replace(/\/+$/, "")

  return path
}

function notifyRouteChange() {
  window.dispatchEvent(new Event("tsjy-route-change"))
}

function patchHistoryOnce() {
  const historyAny = window.history as History & {
    __tsjy29PlusPatched?: boolean
  }

  if (historyAny.__tsjy29PlusPatched) return
  historyAny.__tsjy29PlusPatched = true

  const rawPushState = window.history.pushState
  const rawReplaceState = window.history.replaceState

  window.history.pushState = function (...args) {
    const result = rawPushState.apply(this, args)
    notifyRouteChange()
    return result
  }

  window.history.replaceState = function (...args) {
    const result = rawReplaceState.apply(this, args)
    notifyRouteChange()
    return result
  }
}

export default function V431StableRouter29Plus() {
  const [path, setPath] = useState(() => getLogicalPath())

  useEffect(() => {
    patchHistoryOnce()

    const update = () => {
      setPath(getLogicalPath())
    }

    window.addEventListener("popstate", update)
    window.addEventListener("hashchange", update)
    window.addEventListener("tsjy-route-change", update)

    return () => {
      window.removeEventListener("popstate", update)
      window.removeEventListener("hashchange", update)
      window.removeEventListener("tsjy-route-change", update)
    }
  }, [])

  if (ADVANCED_429_PATHS.has(path)) {
    return <V429V2AdvancedThreePages fallback={<div style={{padding: 40}}>加载中...</div>} />
  }

  return <V431StableRouter />
}
