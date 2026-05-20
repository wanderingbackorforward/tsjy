import React, { useEffect, useMemo, useState } from 'react'
import V431StableRouter from './V431StableRouter'
import V429V2AdvancedThreePages from './V429V2AdvancedThreePages'

type NavItem = {
  label: string
  path: string
  source: '431' | '429'
}

const PLATFORM_TITLE = '閫氳嫃鍢夌敩鏂藉伐鐩戞祴涓庣浘鏋勭爺鍒ゅ钩鍙?

const NAV_ITEMS: NavItem[] = [
  { label: '鎸囨尌鎬昏', path: '/', source: '431' },
  { label: '鏅鸿兘鐮斿垽', path: '/intelligent-analysis', source: '431' },
  { label: '椤圭洰涔?, path: '/project-docs', source: '431' },
  { label: '椋庨櫓澶嶇洏', path: '/risk-replay', source: '431' },
  { label: '鐩戞祴寮傚父', path: '/monitoring-alerts', source: '431' },

  // 29 鎺ョ杩欎笁涓笓涓氶〉
  { label: '鍙傛暟璇婃柇', path: '/operation-diagnosis', source: '429' },
  { label: '娉ユ按娉ㄦ祮', path: '/slurry-grouting', source: '429' },
  { label: '绠＄墖鐩惧熬', path: '/segment-quality', source: '429' },

  { label: '浜嬩欢闂幆', path: '/events', source: '431' },
  { label: '鏁版嵁鎺ュ叆', path: '/data-import', source: '431' },
  { label: '绯荤粺鐘舵€?, path: '/system-status', source: '431' },
  { label: '璇佹嵁閾?, path: '/evidence', source: '431' },
]

const V429_PATHS = new Set(
  NAV_ITEMS.filter((item) => item.source === '429').map((item) => item.path),
)

function normalizePath(inputPath: string) {
  let path = inputPath || '/'

  path = path.split('?')[0].split('#')[0]

  // 鍏煎 /tsjy 瀛愯矾寰勯儴缃?  path = path.replace(/^\/tsjy(?=\/|$)/, '')

  if (!path) path = '/'
  if (!path.startsWith('/')) path = `/${path}`
  if (path.length > 1) path = path.replace(/\/+$/, '')

  return path
}

function getLogicalPath() {
  const { pathname, hash } = window.location

  // 鍏煎 hash route
  if (hash.startsWith('#/')) {
    return normalizePath(hash.slice(1))
  }

  return normalizePath(pathname)
}

function getBasePrefix() {
  const { pathname } = window.location
  return pathname.startsWith('/tsjy') ? '/tsjy' : ''
}

function toRealUrl(logicalPath: string) {
  const base = getBasePrefix()
  if (logicalPath === '/') return `${base || '/'}`
  return `${base}${logicalPath}`
}

function emitRouteChange() {
  window.dispatchEvent(new Event('tsjy-stable-route-change'))
}

function patchHistoryOnce() {
  const historyAny = window.history as History & {
    __tsjyStablePatched?: boolean
  }

  if (historyAny.__tsjyStablePatched) return
  historyAny.__tsjyStablePatched = true

  const rawPushState = window.history.pushState
  const rawReplaceState = window.history.replaceState

  window.history.pushState = function (...args) {
    const result = rawPushState.apply(this, args)
    emitRouteChange()
    return result
  }

  window.history.replaceState = function (...args) {
    const result = rawReplaceState.apply(this, args)
    emitRouteChange()
    return result
  }
}

function useCurrentPath() {
  const [path, setPath] = useState(() => getLogicalPath())

  useEffect(() => {
    patchHistoryOnce()

    const update = () => {
      setPath(getLogicalPath())
    }

    window.addEventListener('popstate', update)
    window.addEventListener('hashchange', update)
    window.addEventListener('tsjy-stable-route-change', update)

    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener('hashchange', update)
      window.removeEventListener('tsjy-stable-route-change', update)
    }
  }, [])

  return path
}

function StableTopBar({
  path,
  onNavigate,
}: {
  path: string
  onNavigate: (nextPath: string) => void
}) {
  return (
    <div className="tsjy-stable-topbar">
      <div className="tsjy-stable-brand">
        <div className="tsjy-stable-title">{PLATFORM_TITLE}</div>
        <div className="tsjy-stable-subtitle">V431 绋冲畾澹?路 V429 涓撲笟椤靛寮?/div>
      </div>

      <nav className="tsjy-stable-nav" aria-label="涓诲鑸?>
        {NAV_ITEMS.map((item) => {
          const active = item.path === '/'
            ? path === '/'
            : path === item.path

          return (
            <button
              key={item.path}
              type="button"
              className={[
                'tsjy-stable-nav-item',
                active ? 'is-active' : '',
                item.source === '429' ? 'is-429' : 'is-431',
              ].join(' ')}
              onClick={() => onNavigate(item.path)}
              title={`${item.label} 路 ${item.source === '429' ? 'V429澧炲己椤? : 'V431绋冲畾椤?}`}
            >
              <span>{item.label}</span>
              {item.source === '429' && <em>29</em>}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function StableStyle() {
  return (
    <style>{`
      :root {
        --tsjy-stable-topbar-height: 96px;
      }

      html,
      body,
      #root {
        min-height: 100%;
      }

      body {
        margin: 0;
      }

      .tsjy-stable-shell {
        min-height: 100vh;
        background:
          radial-gradient(circle at 20% 0%, rgba(28, 101, 255, 0.16), transparent 26rem),
          radial-gradient(circle at 80% 10%, rgba(0, 214, 255, 0.12), transparent 28rem),
          #06111f;
      }

      .tsjy-stable-topbar {
        position: sticky;
        top: 0;
        z-index: 99999;
        min-height: var(--tsjy-stable-topbar-height);
        box-sizing: border-box;
        padding: 12px 20px 10px;
        display: grid;
        grid-template-columns: minmax(260px, 420px) 1fr;
        gap: 14px;
        align-items: center;
        background:
          linear-gradient(180deg, rgba(7, 21, 39, 0.98), rgba(7, 21, 39, 0.91)),
          linear-gradient(90deg, rgba(49, 124, 255, 0.24), rgba(0, 214, 255, 0.12));
        border-bottom: 1px solid rgba(112, 183, 255, 0.26);
        box-shadow: 0 16px 34px rgba(0, 0, 0, 0.28);
        backdrop-filter: blur(12px);
      }

      .tsjy-stable-brand {
        min-width: 0;
      }

      .tsjy-stable-title {
        color: #eef7ff;
        font-size: 19px;
        font-weight: 800;
        letter-spacing: 0.04em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .tsjy-stable-subtitle {
        margin-top: 6px;
        color: rgba(191, 219, 254, 0.76);
        font-size: 12px;
        letter-spacing: 0.08em;
      }

      .tsjy-stable-nav {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
        min-width: 0;
      }

      .tsjy-stable-nav-item {
        appearance: none;
        border: 1px solid rgba(125, 184, 255, 0.26);
        background: rgba(15, 38, 68, 0.78);
        color: rgba(229, 243, 255, 0.86);
        border-radius: 999px;
        padding: 8px 12px;
        font-size: 13px;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
        transition:
          transform 0.14s ease,
          border-color 0.14s ease,
          background 0.14s ease,
          color 0.14s ease;
      }

      .tsjy-stable-nav-item:hover {
        transform: translateY(-1px);
        border-color: rgba(125, 211, 252, 0.72);
        background: rgba(19, 62, 105, 0.94);
        color: #ffffff;
      }

      .tsjy-stable-nav-item.is-active {
        color: #ffffff;
        border-color: rgba(56, 189, 248, 0.94);
        background:
          linear-gradient(135deg, rgba(37, 99, 235, 0.94), rgba(6, 182, 212, 0.82));
        box-shadow:
          0 0 0 1px rgba(147, 197, 253, 0.18),
          0 10px 24px rgba(14, 165, 233, 0.22);
      }

      .tsjy-stable-nav-item em {
        font-style: normal;
        font-size: 10px;
        font-weight: 900;
        color: #07111f;
        background: #facc15;
        border-radius: 999px;
        padding: 2px 5px;
        line-height: 1;
      }

      .tsjy-stable-content {
        min-height: calc(100vh - var(--tsjy-stable-topbar-height));
      }

      .tsjy-stable-source-tag {
        position: fixed;
        right: 14px;
        bottom: 14px;
        z-index: 99998;
        color: rgba(219, 234, 254, 0.82);
        background: rgba(8, 21, 38, 0.78);
        border: 1px solid rgba(125, 184, 255, 0.22);
        border-radius: 999px;
        padding: 7px 10px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.04em;
        backdrop-filter: blur(10px);
        pointer-events: none;
      }

      @media (max-width: 1280px) {
        :root {
          --tsjy-stable-topbar-height: 132px;
        }

        .tsjy-stable-topbar {
          grid-template-columns: 1fr;
          align-items: start;
        }

        .tsjy-stable-nav {
          justify-content: flex-start;
        }
      }

      @media (max-width: 760px) {
        :root {
          --tsjy-stable-topbar-height: 164px;
        }

        .tsjy-stable-topbar {
          padding: 10px 12px;
        }

        .tsjy-stable-title {
          font-size: 16px;
        }

        .tsjy-stable-nav {
          gap: 6px;
        }

        .tsjy-stable-nav-item {
          padding: 7px 9px;
          font-size: 12px;
        }
      }
    `}</style>
  )
}

export default function V431StableRouter29PlusStable() {
  const path = useCurrentPath()

  const source = useMemo<'429' | '431'>(() => {
    return V429_PATHS.has(path) ? '429' : '431'
  }, [path])

  const navigate = (nextPath: string) => {
    const nextUrl = toRealUrl(nextPath)
    window.history.pushState({}, '', nextUrl)
    emitRouteChange()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="tsjy-stable-shell">
      <StableStyle />

      <StableTopBar path={path} onNavigate={navigate} />

      <main className="tsjy-stable-content">
        {source === '429' ? (
          <V429V2AdvancedThreePages fallback={<div style={{padding: 40}}>加载中...</div>} key={`v429:${path}`} />
        ) : (
          <V431StableRouter key={`v431:${path}`} />
        )}
      </main>

      <div className="tsjy-stable-source-tag">
        褰撳墠椤甸潰锛歏{source}
      </div>
    </div>
  )
}
