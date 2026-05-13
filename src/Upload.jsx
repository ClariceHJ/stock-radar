import { useState } from 'react'
import { readExcel, uploadBaseInfo, uploadMonthlyShipments, uploadMonthlyInventory, uploadStockHistory } from './uploadHelpers'

const FILES = [
  {
    key: 'base',
    title: '기준정보',
    desc: '품목마스터 + 당월 재고/매출/출고예정',
    icon: '📋',
    hint: '기준정보_전일마감.xlsx',
    step: 1,
  },
  {
    key: 'shipments',
    title: '월별 출고량',
    desc: '최근 13개월 품목별 출고 이력',
    icon: '📦',
    hint: '월별출고량.xlsx',
    step: 2,
  },
  {
    key: 'inventory',
    title: '월별 기말재고',
    desc: '최근 13개월 품목별 기말재고 이력',
    icon: '📊',
    step: 3,
  },
  {
    key: 'history',
    title: '재고유형 이력',
    desc: '최근 13개월 재고/비재고 구분 이력',
    icon: '🔄',
    hint: '재고유형이력.xlsx',
    step: 4,
  },
]

const CRITERIA = [
  {
    label: '비재고전환권고',
    color: '#e11d48',
    bg: '#fff1f2',
    border: '#fecdd3',
    condition: '재고 운영 중이며 직전 6개월 평균 출고량 ≤ 10개',
  },
  {
    label: '재고전환권고',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    condition: '비재고 운영 중이며 직전 3개월 평균 출고량 > 10개',
  },
  {
    label: '모니터링',
    color: '#ea580c',
    bg: '#fff7ed',
    border: '#fed7aa',
    condition: '비재고 품목 중 피크 > 12 또는 트렌드 상승 또는 수요 모멘텀 > 1.5',
  },
  {
    label: '정상',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    condition: '위 조건에 해당하지 않는 품목',
  },
]

function FileCard({ file, loading, onUpload, result }) {
  const [dragging, setDragging] = useState(false)

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onUpload(file.key, f)
  }

  return (
    <div style={{
      background: '#fff',
      border: `1.5px solid ${dragging ? '#4f46e5' : result?.ok ? '#bbf7d0' : result?.err ? '#fecaca' : '#e5e7eb'}`,
      borderRadius: 12,
      padding: 20,
      transition: 'border-color 0.15s',
    }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#6b7280', flexShrink: 0 }}>
          {file.step}
        </div>
        <span style={{ fontSize: 22, lineHeight: 1 }}>{file.icon}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{file.title}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{file.desc}</div>
        </div>
      </div>

      <div style={{
        border: '1.5px dashed #e5e7eb',
        borderRadius: 8,
        padding: '12px',
        textAlign: 'center',
        background: dragging ? '#f5f3ff' : '#fafafa',
        marginBottom: 10,
        transition: 'background 0.15s',
      }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>드래그하거나</div>
        <label style={{ cursor: 'pointer' }}>
          <span style={{
            padding: '5px 14px', background: '#f9fafb', border: '1px solid #e5e7eb',
            borderRadius: 6, fontSize: 11, color: '#374151', fontWeight: 500,
          }}>파일 선택</span>
          <input type="file" accept=".xlsx" style={{ display: 'none' }} disabled={loading}
            onChange={e => onUpload(file.key, e.target.files[0])} />
        </label>
      </div>

      {result && (
        <div style={{
          padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
          background: result.ok ? '#f0fdf4' : '#fef2f2',
          color: result.ok ? '#166534' : '#991b1b',
        }}>
          {result.ok ? `✅ ${result.msg}` : `❌ ${result.msg}`}
        </div>
      )}
    </div>
  )
}

export default function Upload() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState({})

  async function handleUpload(fileType, file) {
    if (!file) return
    setLoading(true)
    setResults(r => ({ ...r, [fileType]: null }))
    try {
      const headerRow = (fileType === 'shipments' || fileType === 'inventory' || fileType === 'history') ? 1 : 0
      const rows = await readExcel(file, headerRow)
      let count = 0
      if (fileType === 'base') count = await uploadBaseInfo(rows)
      if (fileType === 'shipments') count = await uploadMonthlyShipments(rows)
      if (fileType === 'inventory') count = await uploadMonthlyInventory(rows)
      if (fileType === 'history') count = await uploadStockHistory(rows)
      setResults(r => ({ ...r, [fileType]: { ok: true, msg: `${count}개 처리 완료` } }))
    } catch (err) {
      setResults(r => ({ ...r, [fileType]: { ok: false, msg: err.message } }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden', background: '#f0f2f5' }}>

      {/* 좌측: 데이터 업로드 */}
      <div style={{ flex: 6, display: 'flex', flexDirection: 'column', padding: '28px 24px', overflow: 'hidden' }}>
        <div style={{ flexShrink: 0, marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 4 }}>데이터 업로드</h2>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>태블로에서 내려받은 파일을 순서대로 업로드하세요.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}>
          {FILES.map(f => (
            <FileCard key={f.key} file={f} loading={loading} onUpload={handleUpload} result={results[f.key]} />
          ))}
        </div>

        <div style={{ flexShrink: 0, paddingTop: 14, fontSize: 12, color: '#6b7280', lineHeight: 1.8 }}>
          <strong style={{ color: '#374151' }}>업로드 순서</strong>&nbsp;&nbsp;
          ① 기준정보 → ② 월별 출고량 → ③ 월별 기말재고 → ④ 재고유형 이력 → <strong style={{ color: '#4f46e5' }}>판정 실행</strong>
        </div>
      </div>

      {/* 구분선 */}
      <div style={{ width: 1, background: '#e5e7eb', flexShrink: 0 }} />

      {/* 우측: 판정 기준 */}
      <div style={{ flex: 4, display: 'flex', flexDirection: 'column', padding: '28px 24px', overflow: 'hidden' }}>
        <div style={{ flexShrink: 0, marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 4 }}>판정 기준</h2>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>각 판정 유형의 적용 조건입니다.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {CRITERIA.map(c => (
            <div key={c.label} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: `1px solid ${c.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                <span style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                  background: c.bg, color: c.color, border: `1px solid ${c.border}`,
                }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, paddingLeft: 16 }}>{c.condition}</div>
            </div>
          ))}
        </div>

        <div style={{ flexShrink: 0, paddingTop: 14, fontSize: 12, color: '#6b7280', lineHeight: 1.8 }}>
          N등급(출시 3개월 미만), Z등급(단종예정) 품목은 판정 대상에서 제외됩니다.
        </div>
      </div>
    </div>
  )
}
