import { useEffect, useState } from 'react'
import './App.css'

function App() {
  // 방송 목록 API의 응답 데이터를 저장합니다.
  const [broadcasts, setBroadcasts] = useState(null)

  useEffect(() => {
    // 컴포넌트가 처음 렌더링된 뒤 방송 목록을 한 번 요청합니다.
    async function fetchBroadcasts() {
      try {
        const response = await fetch('/api/list')

        if (!response.ok) {
          throw new Error(`방송 목록 요청 실패: ${response.status}`)
        }

        const data = await response.json()
        setBroadcasts(data)
      } catch (error) {
        console.error('방송 목록을 불러오지 못했습니다.', error)
      }
    }

    fetchBroadcasts()
  }, [])

  // state가 갱신된 뒤 응답 데이터를 콘솔에서 확인합니다.
  useEffect(() => {
    if (broadcasts !== null) {
      console.log('방송 목록:', broadcasts)
    }
  }, [broadcasts])

  return <h1>CV3 Assignment</h1>
}

export default App
