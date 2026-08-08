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

  // null, undefined, 빈 문자열인 값은 표에서 '-'로 통일해 누락 값을 명확히 표시합니다.
  const displayValue = (value) => (value === null || value === undefined || value === '' ? '-' : value)

  return (
    <>
      <h1>CV3 Assignment</h1>

      <p>방송 개수: {broadcasts?.list?.length || 0}</p>

      {/* 방송별 정보를 같은 열에 맞춰 비교할 수 있도록 p 태그 대신 표로 출력합니다. */}
      <table>
        <thead>
          <tr>
            <th>방송시간</th>
            <th>방송정보</th>
            <th>분류</th>
            <th>조회수</th>
            <th>판매량</th>
            <th>매출액</th>
            <th>상품수</th>
          </tr>
        </thead>
        <tbody>
          {(broadcasts?.list ?? []).map((broadcast) => (
            <tr key={broadcast.labang_id}>
              <td>{displayValue(broadcast.labang_datetime_start)}</td>
              <td>{displayValue(broadcast.labang_title)}</td>
              <td>{displayValue(broadcast.category)}</td>
              <td>{displayValue(broadcast.visit_cnt)}</td>
              <td>{displayValue(broadcast.sales_cnt)}</td>
              <td>{displayValue(broadcast.sales_amt)}</td>
              <td>{displayValue(broadcast.product_cnt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

export default App
