import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import Setup from './Upload'
import { TabOverview, TabAnalysis, TabHistory } from './Dashboard'
import { runJudgments } from './judgmentEngine'

const NAV_TABS = [
  { key: 'setup', label: 'Setup' },
  { key: 'overview', label: 'Overview' },
  { key: 'analysis', label: 'Analysis' },
  { key: 'history', label: 'History' },
]

function App() {
  const [connected, setConnected] = useState(false)
  const [judging, setJudging] = useState(false)
  const [judgmentStatus, setJudgmentStatus] = useState('')
  const [tab, setTab] = useState('setup')

  const [dashData, setDashData] = useState([])
  const [shipmentMap, setShipmentMap] = useState({})
  const [allHistory, setAllHistory] = useState([])
  const [refDate, setRefDate] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    const [{ data: judgments }, { data: items }, { data: classifications }, { data: history }] = await Promise.all([
      supabase.from('judgments').select('*'),
      supabase.from('items').select('item_code, item_name, size, series, supplier, lead_time_days, product_group'),
      supabase.from('stock_classification').select('item_code, stock_type, operation_grade'),
      supabase.from('transition_history').select('*').order('changed_at', { ascending: false }),
    ])

    const PAGE = 1000
    let shipments = []
    let from = 0
    while (true) {
      const { data: page } = await supabase
        .from('monthly_shipments')
        .select('item_code, year_month, quantity')
        .range(from, from + PAGE - 1)
      if (!page?.length) break
      shipments = shipments.concat(page)
      if (page.length < PAGE) break
      from += PAGE
    }

    const itemMap = Object.fromEntries((items || []).map(i => [i.item_code, i]))
    const classMap = Object.fromEntries((classifications || []).map(c => [c.item_code, c]))

    const merged = (judgments || []).map(j => ({
      ...j,
      ...itemMap[j.item_code],
      ...classMap[j.item_code],
    }))

    const sMap = {}
    for (const s of (shipments || [])) {
      const key = s.item_code?.trim().toUpperCase()
      if (!key) continue
      if (!sMap[key]) sMap[key] = []
      sMap[key].push(s)
    }

    const historyMerged = (history || []).map(h => ({ ...h, ...itemMap[h.item_code] }))
    const latestJudgedAt = (judgments || []).map(j => j.judged_at).filter(Boolean).sort().pop()
    if (latestJudgedAt) setRefDate(latestJudgedAt.slice(0, 10))

    setDashData(merged)
    setShipmentMap(sMap)
    setAllHistory(historyMerged)
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.from('items').select('count').then(({ error }) => {
      if (!error) setConnected(true)
    })
    fetchDashboardData()
  }, [fetchDashboardData])

  async function handleRunJudgments() {
    setJudging(true)
    setJudgmentStatus('판정 실행 중...')
    try {
      const { total, changed } = await runJudgments()
      setJudgmentStatus(`✅ 판정 완료! ${total}개 품목 처리, 변경 ${changed.length}건`)
      await fetchDashboardData()
    } catch (err) {
      setJudgmentStatus('❌ 오류: ' + err.message)
    } finally {
      setJudging(false)
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
      {/* 네비게이션 */}
      <div style={{ background: '#1a1a2e', height: 48, padding: '0 28px', flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center' }}>
        {/* 로고 — 왼쪽 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={`${import.meta.env.BASE_URL}로고_ww.png`} alt="SLOUBED" style={{ height: 18, opacity: 0.95 }} />
          <span style={{ color: '#4b5563', fontSize: 16 }}>|</span>
          <span style={{ color: '#9ca3af', fontSize: 15, letterSpacing: '0.08em', fontWeight: 500 }}>Stock Radar</span>
        </div>

        {/* 탭 — 가운데 절대 위치 */}
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'stretch', height: '100%' }}>
          {NAV_TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              background: 'none', border: 'none',
              color: tab === t.key ? '#fff' : '#6b7280',
              fontSize: 13, cursor: 'pointer',
              padding: '0 16px',
              display: 'inline-flex', alignItems: 'center',
              borderBottom: tab === t.key ? '2px solid #fff' : '2px solid transparent',
              fontWeight: tab === t.key ? 600 : 400,
            }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {(tab === 'overview' || tab === 'setup') && (
            <button onClick={handleRunJudgments} disabled={judging} style={{
              padding: '7px 16px',
              background: judging ? '#374151' : '#4f46e5',
              color: 'white', border: 'none', borderRadius: 6,
              cursor: judging ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500,
            }}>
              {judging ? '판정 중...' : '판정 실행'}
            </button>
          )}
          <span style={{ color: connected ? '#4ade80' : '#f87171', fontSize: 11 }}>
            {connected ? '● 연결됨' : '● 연결 안됨'}
          </span>
        </div>
      </div>

      {/* 판정 상태 메시지 */}
      {judgmentStatus && (
        <div style={{
          padding: '10px 28px', fontSize: 13, flexShrink: 0,
          background: judgmentStatus.includes('✅') ? '#f0fdf4' : '#fef2f2',
          color: judgmentStatus.includes('✅') ? '#166534' : '#991b1b',
          borderBottom: '1px solid #e5e7eb',
        }}>
          {judgmentStatus}
          <button onClick={() => setJudgmentStatus('')} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14 }}>×</button>
        </div>
      )}

      {/* 콘텐츠 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'setup' && <Setup />}
        {tab !== 'setup' && (
          <div style={{ width: '100%', height: '100%', padding: '16px 20px', background: '#f0f2f5', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
                데이터 불러오는 중...
              </div>
            ) : (
              <>
                {tab === 'overview' && <TabOverview data={dashData} shipmentMap={shipmentMap} refDate={refDate} />}
                {tab === 'analysis' && <TabAnalysis data={dashData} shipmentMap={shipmentMap} />}
                {tab === 'history' && <TabHistory allHistory={allHistory} />}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
