import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const J_STYLE = {
  '비재고전환권고': { bg: '#fff1f2', color: '#e11d48', border: '#fecdd3' },
  '재고전환권고': { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  '모니터링': { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
  '정상': { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
}

const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)'
const CARD_SHADOW_HOVER = '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)'


const JUDGMENTS = ['비재고전환권고', '재고전환권고', '모니터링', '정상']

function Badge({ judgment }) {
  const s = J_STYLE[judgment] || J_STYLE['정상']
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      {judgment}
    </span>
  )
}

function MiniBarChart({ shipments }) {
  const dataMap = Object.fromEntries(shipments.map(m => [m.year_month, m.quantity]))

  const now = new Date()
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const values = months.map(ym => dataMap[ym] ?? 0)
  const max = Math.max(...values, 1)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 28, minWidth: 80 }}>
      {months.map((ym, i) => {
        const qty = dataMap[ym] ?? 0
        const isRecent = i >= months.length - 3
        return (
          <div key={ym} title={`${ym}: ${qty}개`} style={{
            flex: 1, borderRadius: 2,
            background: qty > 0 ? (isRecent ? '#4f46e5' : '#e0e7ff') : '#f0f0f0',
            height: qty > 0 ? `${Math.max((qty / max) * 100, 4)}%` : '3px',
          }} />
        )
      })}
    </div>
  )
}

function ItemTable({ items, shipmentMap, onSelect, selectedCode }) {
  const cols = [
    { label: '품목코드', w: '10%' },
    { label: '품목명', w: '22%' },
    { label: '품목군', w: '9%' },
    { label: '시리즈', w: '9%' },
    { label: '공급처', w: '8%' },
    { label: '재고구분', w: '6%' },
    { label: '운영등급', w: '5%' },
    { label: '현재 판정', w: '10%' },
    { label: '직전 3개월 평출', w: '8%', align: 'center' },
    { label: '12개월 추이(당월 포함)', w: '13%' },
  ]
  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
        <colgroup>
          {cols.map(c => <col key={c.label} style={{ width: c.w }} />)}
        </colgroup>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            {cols.map(c => (
              <th key={c.label} style={{
                padding: '8px 10px', textAlign: c.align || 'left', fontWeight: 600, color: '#9ca3af',
                fontSize: 11, whiteSpace: 'nowrap', borderBottom: '1px solid #f3f4f6',
                position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb',
                overflow: 'hidden',
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((row, i) => {
            const iShipments = (shipmentMap || {})[row.item_code?.trim().toUpperCase()] || []
            const isChanged = row.previous_judgment && row.previous_judgment !== row.judgment
            return (
              <tr key={row.item_code} onClick={() => onSelect?.(row)} style={{
                borderBottom: '1px solid #f9fafb',
                background: selectedCode === row.item_code ? '#f5f3ff' : isChanged ? '#fffbeb' : '#fff',
                cursor: onSelect ? 'pointer' : 'default',
              }}>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                  {isChanged && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', marginRight: 5, verticalAlign: 'middle' }} />}
                  {row.item_code}
                </td>
                <td style={{ padding: '8px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#111827' }}>{row.item_name}</td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: '#6b7280' }}>{row.product_group || '—'}</td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: '#6b7280' }}>{row.series}</td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: '#6b7280' }}>{row.supplier}</td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: '#6b7280' }}>{row.stock_type}</td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: '#6b7280' }}>{row.operation_grade}</td>
                <td style={{ padding: '8px 10px' }}>
                  {isChanged ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'nowrap' }}>
                      <Badge judgment={row.previous_judgment} />
                      <span style={{ color: '#d1d5db', fontSize: 11 }}>→</span>
                      <Badge judgment={row.judgment} />
                    </div>
                  ) : (
                    <Badge judgment={row.judgment} />
                  )}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap', color: '#374151', fontWeight: 500 }}>{row.avg_3m}</td>
                <td style={{ padding: '8px 10px' }}>
                  <div style={{ width: 120, minWidth: 120 }}>
                    <MiniBarChart shipments={iShipments} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function DetailPanel({ item, shipments, history, onClose }) {
  const sorted = [...shipments].sort((a, b) => a.year_month.localeCompare(b.year_month))
  const s = J_STYLE[item.judgment] || J_STYLE['정상']
  const avg6 = sorted.slice(-6).reduce((a, b) => a + b.quantity, 0) / Math.max(sorted.slice(-6).length, 1)
  const avg3 = sorted.slice(-3).reduce((a, b) => a + b.quantity, 0) / Math.max(sorted.slice(-3).length, 1)

  const dataMap = Object.fromEntries(sorted.map(m => [m.year_month, m.quantity]))
  const now = new Date()
  const monthSlots = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const slotValues = monthSlots.map(ym => dataMap[ym] ?? 0)
  const maxQty = Math.max(...slotValues, 1)

  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', borderRadius: 14, boxShadow: CARD_SHADOW, padding: 20, boxSizing: 'border-box', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1, marginRight: 8 }}>
          <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', marginBottom: 2 }}>{item.item_code}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1.4 }}>{item.item_name}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20, padding: 0 }}>×</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <Badge judgment={item.judgment} />
        <span style={{ padding: '3px 8px', background: '#f3f4f6', borderRadius: 999, fontSize: 11, color: '#6b7280' }}>{item.series}</span>
        <span style={{ padding: '3px 8px', background: '#f3f4f6', borderRadius: 999, fontSize: 11, color: '#6b7280' }}>{item.size}</span>
        <span style={{ padding: '3px 8px', background: '#f3f4f6', borderRadius: 999, fontSize: 11, color: '#6b7280' }}>등급 {item.operation_grade}</span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 8 }}>월별 출고 추이 (12개월)</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 64 }}>
          {monthSlots.map((ym, i) => {
            const qty = dataMap[ym] ?? 0
            const isRecent = i >= monthSlots.length - 3
            return (
              <div key={ym} title={`${ym}: ${qty}개`} style={{
                flex: 1, borderRadius: 2,
                background: qty > 0 ? (isRecent ? '#4f46e5' : '#e0e7ff') : '#f0f0f0',
                height: qty > 0 ? `${Math.max((qty / maxQty) * 100, 4)}%` : '3px',
              }} />
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: '#9ca3af' }}>
          <span>{monthSlots[0]}</span>
          <span style={{ color: '#4f46e5', fontSize: 10 }}>■ 최근 3개월</span>
          <span>{monthSlots[monthSlots.length - 1]}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          ['6개월 평균', Math.round(avg6 * 10) / 10],
          ['3개월 평균', Math.round(avg3 * 10) / 10],
          ['피크', item.peak_qty],
          ['재고회전율', item.inventory_turnover != null ? item.inventory_turnover : '—'],
        ].map(([label, value]) => (
          <div key={label} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{value}</div>
          </div>
        ))}
      </div>

      {item.judgment_reason?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 6 }}>판정 근거</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {item.judgment_reason.map(r => (
              <span key={r} style={{ padding: '3px 8px', background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 999, fontSize: 11 }}>{r}</span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 8 }}>전환 이력</div>
        {history.length === 0
          ? <p style={{ color: '#9ca3af', fontSize: 12, margin: 0 }}>전환 이력 없음</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ color: '#9ca3af', minWidth: 56 }}>{h.changed_at?.slice(0, 7)}</span>
                <span style={{ padding: '2px 8px', background: h.from_type === '재고' ? '#eff6ff' : '#fef2f2', borderRadius: 999, fontSize: 11, color: h.from_type === '재고' ? '#1e40af' : '#991b1b' }}>{h.from_type}</span>
                <span style={{ color: '#d1d5db' }}>→</span>
                <span style={{ padding: '2px 8px', background: h.to_type === '재고' ? '#eff6ff' : '#fef2f2', borderRadius: 999, fontSize: 11, color: h.to_type === '재고' ? '#1e40af' : '#991b1b' }}>{h.to_type}</span>
              </div>
            ))}
          </div>
        }
      </div>
    </div>
  )
}

function polarToCartesian(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

function arcPath(cx, cy, outerR, innerR, startDeg, sweep) {
  if (sweep <= 0) return ''
  const end = startDeg + Math.min(sweep, 359.99)
  const [x1, y1] = polarToCartesian(cx, cy, outerR, startDeg)
  const [x2, y2] = polarToCartesian(cx, cy, outerR, end)
  const [x3, y3] = polarToCartesian(cx, cy, innerR, end)
  const [x4, y4] = polarToCartesian(cx, cy, innerR, startDeg)
  const large = sweep > 180 ? 1 : 0
  return `M${x1} ${y1} A${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4}Z`
}

const DONUT_COLORS = {
  '비재고전환권고': '#dc2626',
  '재고전환권고': '#2563eb',
  '모니터링': '#d97706',
  '정상': '#16a34a',
}

function SummaryCard({ counts, changedCount, total, judgmentFilter, setJudgmentFilter, changedFilter, setChangedFilter }) {
  let angle = 0
  const segments = JUDGMENTS.map(key => {
    const count = counts[key] || 0
    const sweep = total > 0 ? (count / total) * 360 : 0
    const seg = { key, color: DONUT_COLORS[key], count, start: angle, sweep }
    angle += sweep
    return seg
  })

  const rightItems = [
    ...JUDGMENTS.map(key => ({ key, color: DONUT_COLORS[key], count: counts[key] || 0 })),
    { key: '판정 변경', color: '#f59e0b', count: changedCount },
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, width: '100%' }}>
      {/* 도넛 + 범례 */}
      <div style={{ flex: 4, display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        <svg width="140" height="140" viewBox="0 0 100 100">
          {total === 0
            ? <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" strokeWidth="16" />
            : segments.map(({ key, color, start, sweep }) =>
                sweep > 0 && <path key={key} d={arcPath(50, 50, 46, 30, start, sweep)} fill={color} />
              )
          }
          <text x="50" y="43" textAnchor="middle" dominantBaseline="central" fontSize="21" fontWeight="700" fill="#111827" fontFamily="sans-serif">{total}</text>
          <text x="50" y="57" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#9ca3af" fontFamily="sans-serif">품목</text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {JUDGMENTS.map(key => {
            const count = counts[key] || 0
            const pct = total > 0 ? Math.round(count / total * 100) : 0
            const active = judgmentFilter === key
            const dimmed = judgmentFilter ? !active : changedFilter
            return (
              <div key={key} onClick={() => { setJudgmentFilter(active ? '' : key); setChangedFilter(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', opacity: dimmed ? 0.35 : 1, transition: 'opacity 0.15s' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: DONUT_COLORS[key], flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#374151', fontWeight: active ? 700 : 500, whiteSpace: 'nowrap' }}>{key}</span>
                <span style={{ fontSize: 13, color: '#9ca3af' }}>{pct}%</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 세로 구분선 */}
      <div style={{ width: '0.5px', background: '#e5e7eb', alignSelf: 'stretch', margin: '0 20px', flexShrink: 0 }} />

      {/* 숫자 바 */}
      <div style={{ flex: 6, display: 'flex', alignItems: 'center' }}>
        {rightItems.map(({ key, color, count }, idx) => {
          const active = key === '판정 변경' ? changedFilter : judgmentFilter === key
          const dimmed = key === '판정 변경'
            ? (judgmentFilter ? true : false)
            : (changedFilter ? true : (judgmentFilter && judgmentFilter !== key))
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div onClick={() => {
                  if (key === '판정 변경') { setChangedFilter(v => !v); setJudgmentFilter('') }
                  else { setJudgmentFilter(judgmentFilter === key ? '' : key); setChangedFilter(false) }
                }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer',
                  opacity: dimmed ? 0.35 : 1, transition: 'opacity 0.15s' }}>
                <div style={{ fontSize: 11, color, fontWeight: 600, whiteSpace: 'nowrap' }}>{key}</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>품목</div>
              </div>
              {idx < rightItems.length - 1 && (
                <div style={{ width: '0.5px', height: 48, background: '#e5e7eb', flexShrink: 0 }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TabOverview({ data, shipmentMap, refDate }) {
  const [judgmentFilter, setJudgmentFilter] = useState('')
  const [seriesFilter, setSeriesFilter] = useState('')
  const [stockTypeFilter, setStockTypeFilter] = useState('')
  const [changedFilter, setChangedFilter] = useState(false)
  const [selected, setSelected] = useState(null)
  const [selectedShipments, setSelectedShipments] = useState([])
  const [selectedHistory, setSelectedHistory] = useState([])

  const counts = JUDGMENTS.reduce((acc, j) => { acc[j] = data.filter(d => d.judgment === j).length; return acc }, {})
  const changedCount = data.filter(d => d.previous_judgment && d.previous_judgment !== d.judgment).length
  const seriesList = [...new Set(data.map(d => d.series).filter(Boolean))].sort()

  const filtered = data.filter(d => {
    const mj = !judgmentFilter || d.judgment === judgmentFilter
    const ms = !seriesFilter || d.series === seriesFilter
    const mt = !stockTypeFilter || d.stock_type === stockTypeFilter
    const mc = !changedFilter || (d.previous_judgment && d.previous_judgment !== d.judgment)
    return mj && ms && mt && mc
  }).sort((a, b) => (a.avg_6m || 0) - (b.avg_6m || 0))

  async function selectItem(item) {
    setSelected(item)
    const [{ data: shipments }, { data: history }] = await Promise.all([
      supabase.from('monthly_shipments').select('*').eq('item_code', item.item_code).order('year_month'),
      supabase.from('transition_history').select('*').eq('item_code', item.item_code).order('changed_at'),
    ])
    setSelectedShipments(shipments || [])
    setSelectedHistory(history || [])
  }

  const selectStyle = { padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, color: '#374151', background: '#f9fafb', cursor: 'pointer', outline: 'none' }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {refDate && (
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10, flexShrink: 0 }}>
          <span style={{ color: '#374151' }}>데이터 기준일: </span><strong style={{ color: '#ef4444' }}>{refDate}</strong>
          <span style={{ marginLeft: 6, color: '#374151' }}>사용코드 기준, N등급 및 Z등급 제외</span>
        </div>
      )}

      <SummaryCard
        counts={counts}
        changedCount={changedCount}
        total={JUDGMENTS.reduce((sum, j) => sum + (counts[j] || 0), 0)}
        judgmentFilter={judgmentFilter}
        setJudgmentFilter={setJudgmentFilter}
        changedFilter={changedFilter}
        setChangedFilter={setChangedFilter}
      />

      {/* 테이블 + 상세 패널 */}
      <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden', minHeight: 0, paddingBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0, background: '#fff', borderRadius: 14, boxShadow: CARD_SHADOW, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* 필터 3종 드롭다운 */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <select value={stockTypeFilter} onChange={e => setStockTypeFilter(e.target.value)} style={selectStyle}>
              <option value="">재고유형</option>
              <option value="재고">재고</option>
              <option value="비재고">비재고</option>
            </select>
            <select value={seriesFilter} onChange={e => setSeriesFilter(e.target.value)} style={selectStyle}>
              <option value="">시리즈</option>
              {seriesList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={judgmentFilter} onChange={e => setJudgmentFilter(e.target.value)} style={selectStyle}>
              <option value="">판정유형</option>
              {JUDGMENTS.map(j => <option key={j} value={j}>{j} ({counts[j] || 0})</option>)}
            </select>
          </div>

          <ItemTable items={filtered} shipmentMap={shipmentMap} onSelect={selectItem} selectedCode={selected?.item_code} />

          <div style={{ padding: '8px 16px', color: '#9ca3af', fontSize: 12, borderTop: '1px solid #f3f4f6', flexShrink: 0 }}>
            총 {filtered.length}개 품목
          </div>
        </div>

        <div style={{ width: 'calc((100% - 48px) / 5)', flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {selected ? (
            <DetailPanel item={selected} shipments={selectedShipments} history={selectedHistory} onClose={() => setSelected(null)} />
          ) : (
            <div style={{
              width: '100%', height: '100%', background: '#fff', borderRadius: 14, boxShadow: CARD_SHADOW,
              boxSizing: 'border-box', padding: 24, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <div style={{ fontSize: 28, color: '#e5e7eb' }}>☰</div>
              <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 1.6 }}>
                품목을 클릭하면<br />상세 정보가 표시됩니다
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function TabAnalysis({ data, shipmentMap }) {
  const [analysisType, setAnalysisType] = useState('시리즈')
  const [clickedGroup, setClickedGroup] = useState(null)

  const ANALYSIS_TYPES = ['시리즈', '품목군', '공급처', '사이즈']
  const GROUP_KEY = { '시리즈': 'series', '품목군': 'product_group', '공급처': 'supplier', '사이즈': 'size' }
  const groupKey = GROUP_KEY[analysisType]

  const groups = [...new Set(data.map(d => d[groupKey]).filter(Boolean))].sort()

  const groupStats = groups.map(g => {
    const items = data.filter(d => d[groupKey] === g)
    const byJudgment = JUDGMENTS.reduce((acc, j) => {
      acc[j] = items.filter(d => d.judgment === j).length
      return acc
    }, {})
    return { group: g, total: items.length, byJudgment, items }
  }).sort((a, b) => b.byJudgment['비재고전환권고'] - a.byJudgment['비재고전환권고'])

  const turnoverStats = groupStats
    .map(({ group, items }) => {
      const vals = items.map(i => i.inventory_turnover).filter(v => v != null)
      return { group, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : null }
    })
    .filter(s => s.avg !== null)
    .sort((a, b) => b.avg - a.avg)
  const maxTurnover = Math.max(...turnoverStats.map(s => s.avg), 1)

  const clickedStat = groupStats.find(s => s.group === clickedGroup)

  return (
    <div style={{ height: '100%', display: 'flex', gap: 20, overflow: 'hidden', paddingBottom: 16, boxSizing: 'border-box' }}>
      {/* 좌측: 타입 선택 + 판정 분포 막대그래프 */}
      <div style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
          {ANALYSIS_TYPES.map(t => (
            <button key={t} onClick={() => { setAnalysisType(t); setClickedGroup(null) }} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: analysisType === t ? 600 : 400,
              border: `1px solid ${analysisType === t ? '#4f46e5' : '#e5e7eb'}`,
              background: analysisType === t ? '#eef2ff' : '#fff',
              color: analysisType === t ? '#4f46e5' : '#6b7280',
              cursor: 'pointer',
            }}>{t}별</button>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: 14, boxShadow: CARD_SHADOW, padding: 20, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 14, flexShrink: 0 }}>{analysisType}별 판정 분포</div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {groupStats.map(({ group, total, byJudgment }) => (
              <div key={group}
                onClick={() => setClickedGroup(prev => prev === group ? null : group)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  padding: '5px 8px', borderRadius: 6,
                  background: clickedGroup === group ? '#f5f3ff' : 'transparent',
                  border: `1px solid ${clickedGroup === group ? '#c4b5fd' : 'transparent'}`,
                }}>
                <div style={{ width: 90, fontSize: 12, color: '#374151', textAlign: 'right', fontWeight: clickedGroup === group ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{group}</div>
                <div style={{ flex: 1, display: 'flex', height: 18, borderRadius: 3, overflow: 'hidden' }}>
                  {JUDGMENTS.map(j => {
                    const count = byJudgment[j] || 0
                    if (!count) return null
                    const pct = (count / total) * 100
                    return (
                      <div key={j} title={`${j}: ${count}개`} style={{
                        width: `${pct}%`, background: J_STYLE[j].color, opacity: 0.85,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: '#fff', fontWeight: 600, minWidth: 4,
                      }}>
                        {pct > 12 ? count : ''}
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', minWidth: 26, textAlign: 'right', flexShrink: 0 }}>{total}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, flexShrink: 0, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {JUDGMENTS.map(j => (
              <span key={j} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#6b7280' }}>
                <span style={{ width: 8, height: 8, background: J_STYLE[j].color, borderRadius: 2, display: 'inline-block', opacity: 0.85 }} />
                {j}
              </span>
            ))}
          </div>

          {turnoverStats.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f3f4f6', flexShrink: 0 }}>
              {/* WORST 3 */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 10, flexShrink: 0 }}>
                  {analysisType}별 재고회전율 <span style={{ color: '#dc2626' }}>WORST 3</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[...turnoverStats].sort((a, b) => a.avg - b.avg).slice(0, 3).map(({ group, avg }, idx) => (
                    <div key={group} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#fff5f5', borderRadius: 8, border: '1px solid #fecaca' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', minWidth: 14 }}>{idx + 1}</span>
                      <span style={{ flex: 1, fontSize: 11, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', flexShrink: 0 }}>{avg}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* 우측: 품목 리스트 */}
      <div style={{ flex: 1, minWidth: 0, background: '#fff', borderRadius: 14, boxShadow: CARD_SHADOW, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {clickedStat ? (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{clickedGroup} 품목 목록</div>
              <button onClick={() => setClickedGroup(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18 }}>×</button>
            </div>
            <ItemTable
              items={[...clickedStat.items].sort((a, b) => (a.avg_6m || 0) - (b.avg_6m || 0))}
              shipmentMap={shipmentMap}
            />
            <div style={{ padding: '10px 16px', color: '#9ca3af', fontSize: 12, borderTop: '1px solid #f3f4f6', flexShrink: 0 }}>
              총 {clickedStat.items.length}개 품목
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
            그룹을 클릭하면 품목 목록이 표시됩니다
          </div>
        )}
      </div>
    </div>
  )
}

export function TabHistory({ allHistory }) {
  const [search, setSearch] = useState('')
  const filtered = allHistory.filter(h => !search || h.item_code?.includes(search) || h.item_name?.includes(search))

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: 16, boxSizing: 'border-box' }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: CARD_SHADOW, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <input type="text" placeholder="품목코드, 품목명 검색..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['변경 월', '품목코드', '품목명', '시리즈', '이전', '변경 후'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#9ca3af', fontSize: 11, borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>전환 이력 없음</td></tr>
                : filtered.map((h, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f9fafb', background: '#fff' }}>
                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>{h.changed_at?.slice(0, 7)}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{h.item_code}</td>
                    <td style={{ padding: '10px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.item_name}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>{h.series}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', background: h.from_type === '재고' ? '#eff6ff' : '#fef2f2', borderRadius: 999, fontSize: 11, color: h.from_type === '재고' ? '#1e40af' : '#991b1b' }}>{h.from_type}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', background: h.to_type === '재고' ? '#eff6ff' : '#fef2f2', borderRadius: 999, fontSize: 11, color: h.to_type === '재고' ? '#1e40af' : '#991b1b' }}>{h.to_type}</span>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        <div style={{ padding: '8px 16px', color: '#9ca3af', fontSize: 12, borderTop: '1px solid #f3f4f6', flexShrink: 0 }}>
          총 {filtered.length}건
        </div>
      </div>
    </div>
  )
}

