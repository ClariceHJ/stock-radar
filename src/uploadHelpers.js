import * as XLSX from 'xlsx'
import { supabase } from './supabase'

export function readExcel(file, headerRow = 0) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const workbook = XLSX.read(evt.target.result, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(sheet, { range: headerRow })
        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsBinaryString(file)
  })
}

export async function uploadBaseInfo(rows) {
  const items = rows.map(row => ({
    item_code: row['CODE'],
    item_name: row['01-03. 명칭(한글)'],
    size: row['사이즈'],
    series: row['03-05. 시리즈'],
    supplier: row['공급처(보정)'],
    lead_time_days: row['06-09. 리드타임'] || null,
    is_active: true,
  }))

  const { error: itemsError } = await supabase
    .from('items')
    .upsert(items, { onConflict: 'item_code' })
  if (itemsError) throw new Error('items 저장 실패: ' + itemsError.message)

  const classifications = rows.map(row => ({
    item_code: row['CODE'],
    stock_type: row['01-13. 재고구분'],
    operation_policy: row['01-14. 표준구분'],
    operation_grade: row['운영등급'],
    reference_date: new Date().toISOString().slice(0, 10),
  }))

  const { error: classError } = await supabase
    .from('stock_classification')
    .upsert(classifications, { onConflict: 'item_code' })
  if (classError) throw new Error('stock_classification 저장 실패: ' + classError.message)

  const actuals = rows.map(row => ({
    item_code: row['CODE'],
    current_stock: row['기말재고수량'] || 0,
    monthly_shipment_qty: row['매출수량'] || 0,
    remaining_4w: row['출고예정량_4W'] || 0,
    reference_date: new Date().toISOString().slice(0, 10),
  }))

  const { error: actualsError } = await supabase
    .from('monthly_actuals')
    .upsert(actuals, { onConflict: 'item_code' })
  if (actualsError) throw new Error('monthly_actuals 저장 실패: ' + actualsError.message)

  return items.length
}

export async function uploadMonthlyShipments(rows) {
  const records = []

  for (const row of rows) {
    const itemCode = row['CODE']
    if (!itemCode) continue

    for (const [key, value] of Object.entries(row)) {
      if (key === 'CODE') continue
      if (!value || value === 0) continue

      const match = key.match(/(\d{4})년\s*(\d{1,2})월/)
      if (!match) continue
      const yearMonth = `${match[1]}-${String(match[2]).padStart(2, '0')}`

      records.push({
        item_code: itemCode,
        year_month: yearMonth,
        quantity: value || 0,
      })
    }
  }

  // 기준정보에 있는 item_code만 필터
  const { data: existingItems } = await supabase
    .from('items')
    .select('item_code')
  const validCodes = new Set(existingItems.map(i => i.item_code))
  const validRecords = records.filter(r => validCodes.has(r.item_code))

  // 당월 제외
  const months = [...new Set(validRecords.map(r => r.year_month))].sort()
  const currentMonth = months[months.length - 1]
  const filtered = validRecords.filter(r => r.year_month !== currentMonth)

  const { error } = await supabase
    .from('monthly_shipments')
    .upsert(filtered, { onConflict: 'item_code,year_month' })
  if (error) throw new Error('monthly_shipments 저장 실패: ' + error.message)

  return filtered.length
}

export async function uploadStockHistory(rows) {
  const records = []

  for (const row of rows) {
    const itemCode = row['CODE']
    if (!itemCode) continue

    const months = Object.keys(row).filter(k => k !== 'CODE')
    for (let i = 1; i < months.length; i++) {
      const prevMonth = months[i - 1]
      const currMonth = months[i]
      const prevType = row[prevMonth]
      const currType = row[currMonth]

      if (prevType && currType && prevType !== currType) {
        const match = currMonth.match(/(\d{4})년\s*(\d{1,2})월/)
        if (!match) continue
        const yearMonth = `${match[1]}-${String(match[2]).padStart(2, '0')}`

        records.push({
          item_code: itemCode,
          changed_at: yearMonth + '-01',
          from_type: prevType,
          to_type: currType,
          source: 'auto',
        })
      }
    }
  }

  // 기준정보에 있는 item_code만 필터
  const { data: existingItems } = await supabase
    .from('items')
    .select('item_code')
  const validCodes = new Set(existingItems.map(i => i.item_code))
  const validRecords = records.filter(r => validCodes.has(r.item_code))

  if (validRecords.length > 0) {
    const { error } = await supabase
      .from('transition_history')
      .upsert(validRecords, { onConflict: 'item_code,changed_at' })
    if (error) throw new Error('transition_history 저장 실패: ' + error.message)
  }

  return validRecords.length
}