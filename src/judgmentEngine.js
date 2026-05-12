import { supabase } from './supabase'

// 판정 로직 실행
export async function runJudgments() {
  // 1. 필요한 데이터 전부 가져오기
  const { data: items } = await supabase
    .from('items')
    .select('item_code')
    .eq('is_active', true)

  const { data: classifications } = await supabase
    .from('stock_classification')
    .select('item_code, stock_type, operation_policy, operation_grade')

  const { data: shipments } = await supabase
    .from('monthly_shipments')
    .select('item_code, year_month, quantity')
    .order('year_month', { ascending: false })

  const { data: actuals } = await supabase
    .from('monthly_actuals')
    .select('item_code, current_stock, remaining_4w')

  const { data: prevJudgments } = await supabase
    .from('judgments')
    .select('item_code, judgment')

  // 2. 데이터를 item_code 기준으로 맵으로 변환
  const classMap = Object.fromEntries(classifications.map(c => [c.item_code, c]))
  const actualsMap = Object.fromEntries(actuals.map(a => [a.item_code, a]))
  const prevMap = Object.fromEntries((prevJudgments || []).map(j => [j.item_code, j.judgment]))

  // 품목별 월별 출고량 맵
  const shipmentMap = {}
  for (const s of shipments) {
    if (!shipmentMap[s.item_code]) shipmentMap[s.item_code] = []
    shipmentMap[s.item_code].push({ year_month: s.year_month, quantity: s.quantity })
  }

  // 3. 품목별 판정 계산
  const judgmentResults = []

  for (const item of items) {
    const code = item.item_code
    const cls = classMap[code]
    const actual = actualsMap[code]
    if (!cls) continue

    const monthlyData = (shipmentMap[code] || [])
      .sort((a, b) => b.year_month.localeCompare(a.year_month))

    const last6 = monthlyData.slice(0, 6).map(m => m.quantity)
    const last3 = monthlyData.slice(0, 3).map(m => m.quantity)
    const all = monthlyData.map(m => m.quantity)

    const avg6m = last6.length ? last6.reduce((a, b) => a + b, 0) / last6.length : 0
    const avg3m = last3.length ? last3.reduce((a, b) => a + b, 0) / last3.length : 0
    const peakQty = all.length ? Math.max(...all) : 0

    // 트렌드: 최근 3개월 평균 vs 직전 3개월 평균
    const recent3 = monthlyData.slice(0, 3).map(m => m.quantity)
    const prev3 = monthlyData.slice(3, 6).map(m => m.quantity)
    const recentAvg = recent3.length ? recent3.reduce((a, b) => a + b, 0) / recent3.length : 0
    const prevAvg = prev3.length ? prev3.reduce((a, b) => a + b, 0) / prev3.length : 0
    const trendSlope = prevAvg > 0 ? (recentAvg - prevAvg) / prevAvg : 0
    const demandMomentum = prevAvg > 0 ? recentAvg / prevAvg : 0

    // Coverage 계산
    const weeklyAvg = avg3m / 4
    const currentStock = actual?.current_stock || 0
    const remaining4w = actual?.remaining_4w || 0
    const coverageWeeks = weeklyAvg > 0 ? currentStock / weeklyAvg : 999
    
    // 판정
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
      coverage_weeks: Math.round(coverageWeeks * 10) / 10,
      judged_at: new Date().toISOString(),
      previous_judgment: prevMap[code] || null,
    })
  }

  // 4. judgments 테이블에 저장
  const { error } = await supabase
    .from('judgments')
    .upsert(judgmentResults, { onConflict: 'item_code' })
  if (error) throw new Error('판정 저장 실패: ' + error.message)

  // 5. 변경된 판정 추출 (슬랙 알림용)
  const changed = judgmentResults.filter(j => j.previous_judgment && j.previous_judgment !== j.judgment)

  return { total: judgmentResults.length, changed }
}