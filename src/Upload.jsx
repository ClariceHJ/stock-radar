import { useState } from 'react'
import { readExcel, uploadBaseInfo, uploadMonthlyShipments, uploadStockHistory } from './uploadHelpers'

function Upload() {
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleFile(fileType, file) {
    if (!file) return
    setLoading(true)
    setStatus('파일 읽는 중...')

    try {
      const headerRow = (fileType === 'shipments' || fileType === 'history') ? 1 : 0
      const rows = await readExcel(file, headerRow)
      setStatus('DB에 저장 중...')

      let count = 0
      if (fileType === 'base') count = await uploadBaseInfo(rows)
      if (fileType === 'shipments') count = await uploadMonthlyShipments(rows)
      if (fileType === 'history') count = await uploadStockHistory(rows)

      setStatus(`✅ 완료! ${count}개 처리됨`)
    } catch (err) {
      setStatus('❌ 오류: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '600px' }}>
      <h2>데이터 업로드</h2>

      <div style={{ marginBottom: '24px' }}>
        <h3>파일 1: 기준정보</h3>
        <input
          type="file"
          accept=".xlsx"
          disabled={loading}
          onChange={e => handleFile('base', e.target.files[0])}
        />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h3>파일 2: 월별출고량</h3>
        <input
          type="file"
          accept=".xlsx"
          disabled={loading}
          onChange={e => handleFile('shipments', e.target.files[0])}
        />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h3>파일 3: 재고유형이력</h3>
        <input
          type="file"
          accept=".xlsx"
          disabled={loading}
          onChange={e => handleFile('history', e.target.files[0])}
        />
      </div>

      {status && (
        <p style={{
          marginTop: '16px',
          padding: '12px',
          background: status.includes('✅') ? '#f0fdf4' : status.includes('❌') ? '#fef2f2' : '#f8fafc',
          borderRadius: '8px'
        }}>
          {status}
        </p>
      )}
    </div>
  )
}

export default Upload