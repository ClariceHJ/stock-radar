import { useEffect, useState } from 'react'
import { supabase } from './supabase'

function App() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase.from('items').select('count')
      if (!error) setConnected(true)
    }
    testConnection()
  }, [])

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>Stock Radar</h1>
      <p>Supabase 연결 상태: {connected ? '✅ 연결됨' : '❌ 연결 안됨'}</p>
    </div>
  )
}

export default App