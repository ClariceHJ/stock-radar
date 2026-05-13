import { supabase } from './supabase'

export async function runJudgments() {
  const { data: items } = await supabase
    .from('items')
    .select('item_code')
    .eq('is_active', true)

  // N등급(신제품), Z등급(단종예정) 제외
  const { data: allClass } = await supabase
    .from('stock_classification')
    .select('item_code, operation_grade')
  const excludeCodes = new Set(
    allClass
      .filter(c => ['N', 'Z'].includes(c.operation_grade))
      .map(c => c.item_code)
  )
  const filteredItems = items.filter(i => !excludeCodes.has(i.item_code))

  const { data: classifications } = await supabase
    .from('stock_classification')
    .select('item_code, stock_type, operation_policy, operation_grade')

  const { data: shipments } = await supabase
    .from('monthly_shipments')
    .select('item_code, year_month, quantity')
    .order('year_month', { ascending: false })

  const { data: prevJudgments } = await supabase
    .from('judgments')
    .select('item_code, judgment')

  const classMap = Object.fromEntries(classifications.map(c => [c.item_code, c]))
  const prevMap = Object.fromEntries((prevJudgments || []).map(j => [j.item_code, j.judgment]))

  const shipmentMap = {}
  for (const s of shipments) {
    if (!shipmentMap[s.item_code]) shipmentMap[s.item_code] = []
    shipmentMap[s.item_code].push({ year_month: s.year_month, quantity: s.quantity })
  }

  const { data: inventories } = await supabase
    .from('monthly_inventory')
    .select('item_code, year_month, quantity')

  const inventoryMap = {}
  for (const inv of (inventories || [])) {
    if (!inventoryMap[inv.item_code]) inventoryMap[inv.item_code] = []
    inventoryMap[inv.item_code].push({ year_month: inv.year_month, quantity: inv.quantity })
  }

  const judgmentResults = []

  for (const item of filteredItems) {
    const code = item.item_code
    const cls = classMap[code]
    if (!cls) continue

    const monthlyData = (shipmentMap[code] || [])
      .sort((a, b) => b.year_month.localeCompare(a.year_month))

    const last6 = monthlyData.slice(0, 6).map(m => m.quantity)
    const last3 = monthlyData.slice(0, 3).map(m => m.quantity)
    const all = monthlyData.map(m => m.quantity)

    const avg6m = last6.length ? last6.reduce((a, b) => a + b, 0) / last6.length : 0
    const avg3m = last3.length ? last3.reduce((a, b) => a + b, 0) / last3.length : 0
    const peakQty = all.length ? Math.max(...all) : 0

    const recent3 = monthlyData.slice(0, 3).map(m => m.quantity)
    const prev3 = monthlyData.slice(3, 6).map(m => m.quantity)
    const recentAvg = recent3.length ? recent3.reduce((a, b) => a + b, 0) / recent3.length : 0
    const prevAvg = prev3.length ? prev3.reduce((a, b) => a + b, 0) / prev3.length : 0
    const trendSlope = prevAvg > 0 ? (recentAvg - prevAvg) / prevAvg : 0
    const demandMomentum = prevAvg > 0 ? recentAvg / prevAvg : 0

    const latestShipmentMonth = monthlyData.length > 0 ? monthlyData[0].year_month : null
    let inventory_turnover = null
    if (latestShipmentMonth) {
      const [refY, refM] = latestShipmentMonth.split('-').map(Number)
      const months12 = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(refY, refM - 1 - (11 - i), 1)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      })
      const shipLookup = Object.fromEntries(monthlyData.map(m => [m.year_month, m.quantity]))
      const invLookup = Object.fromEntries(
        (inventoryMap[code] || []).map(m => [m.year_month, Math.max(m.quantity, 0)])
      )
      const shipAvg = months12.reduce((s, ym) => s + (shipLookup[ym] ?? 0), 0) / 12
      const invAvg = months12.reduce((s, ym) => s + (invLookup[ym] ?? 0), 0) / 12
      inventory_turnover = invAvg > 0 ? Math.round(shipAvg / invAvg * 10) / 10 : null
    }

    let judgment = '정상'
    const reasons = []

    if (cls.stock_type === '재고' && avg6m <= 10) {
      judgment = '비재고전환권고'
      reasons.push('6개월평균≤10')
    } else if (cls.stock_type === '비재고' && avg3m > 10) {
      judgment = '재고전환권고'
      reasons.push('3개월평균>10')
    } else if (cls.stock_type === '비재고') {
      if (peakQty > 12) reasons.push('피크>12')
      if (trendSlope > 0.2) reasons.push('트렌드상승')
      if (demandMomentum > 1.5) reasons.push('수요모멘텀>1.5')
      if (reasons.length > 0) judgment = '모니터링'
    }

    judgmentResults.push({
      item_code: code,
      judgment,
      judgment_reason: reasons,
      avg_6m: Math.round(avg6m * 10) / 10,
      avg_3m: Math.round(avg3m * 10) / 10,
      peak_qty: peakQty,
      trend_slope: Math.round(trendSlope * 100) / 100,
      demand_momentum: Math.round(demandMomentum * 100) / 100,
      judged_at: new Date().toISOString(),
      previous_judgment: prevMap[code] || null,
      inventory_turnover,
    })
  }

  const { error } = await supabase
    .from('judgments')
    .upsert(judgmentResults, { onConflict: 'item_code' })
  if (error) throw new Error('판정 저장 실패: ' + error.message)

  const changed = judgmentResults.filter(j => j.previous_judgment && j.previous_judgment !== j.judgment)

  return { total: judgmentResults.length, changed }
}