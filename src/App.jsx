import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Upload from './Upload'
import { runJudgments } from './judgmentEngine'

function App() {
  const [connected, setConnected] = useState(false)
  const [judging, setJudging] = useState(false)
  const [judgmentStatus, setJudgmentStatus] = useState('')

  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase.from('items').select('count')
      if (!error) setConnected(true)
    }
    testConnection()
  }, [])

  async function handleRunJudgments() {
    setJudging(true)
    setJudgmentStatus('판정 실행 중...')
    try {
      const { total, changed } = await runJudgments()
      setJudgmentStatus(`✅ 판정 완료! ${total}개 품목 처리, 변경 ${changed.length}건`)
    } catch (err) {
      setJudgmentStatus('❌ 오류: ' + err.message)
    } finally {
      setJudging(false)
    }
  }

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '600px' }}>
      <h1>Stock Radar</h1>
      <p>Supabase 연결 상태: {connected ? '✅ 연결됨' : '❌ 연결 안됨'}</p>
      <hr />
      <Upload />
      <hr />
      <h2>판정 실행</h2>
      <button
        onClick={handleRunJudgments}
        disabled={judging}
        style={{
          padding: '12px 24px',
          background: '#1E3A5F',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: judging ? 'not-allowed' : 'pointer',
          fontSize: '16px'
        }}
      >
        {judging ? '판정 중...' : '판정 실행'}
      </button>
      {judgmentStatus && (
        <p style={{
          marginTop: '16px',
          padding: '12px',
          background: judgmentStatus.includes('✅') ? '#f0fdf4' : judgmentStatus.includes('❌') ? '#fef2f2' : '#f8fafc',
          borderRadius: '8px'
        }}>
          {judgmentStatus}
        </p>
      )}
    </div>
  )
}

export default App