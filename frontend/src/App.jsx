import { useEffect, useState } from 'react'
import './App.css'

function formatBroadcastTime(datetime, type) {
  if (type === 'hs') {
    const year = datetime.slice(0, 4)
    const month = datetime.slice(4, 6)
    const day = datetime.slice(6, 8)
    const hour = datetime.slice(8, 10)
    const minute = datetime.slice(10, 12)

    return year + '.' + month + '.' + day + ' ' + hour + ':' + minute
  }

  const year = datetime.slice(0, 2)
  const month = datetime.slice(2, 4)
  const day = datetime.slice(4, 6)
  const hour = datetime.slice(6, 8)
  const minute = datetime.slice(8, 10)

  return year + '.' + month + '.' + day + ' ' + hour + ':' + minute
 
}

function App() {
  // 방송 목록 API의 응답 데이터를 저장합니다.
  const [broadcasts, setBroadcasts] = useState(null)
  const [type, setType] = useState('lb') // 'lb' 또는 'hs'를 선택할 수 있는 상태를 추가합니다.

  useEffect(() => {
    // 컴포넌트가 처음 렌더링된 뒤 방송 목록을 한 번 요청합니다.
    async function fetchBroadcasts() {
      try {
        const response = await fetch(`/api/list?type=${type}`) // 선택된 type에 따라 API 요청을 보냅니다.

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
  }, [type]) // type이 변경될 때마다 방송 목록을 다시 요청합니다.

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
      <div>
        <button onClick={() => setType('lb')}>라방</button>
        <button onClick={() => setType('hs')}>홈쇼핑</button>
      </div>

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
            <tr key={broadcast.id}>
              <td>{displayValue(formatBroadcastTime(broadcast.datetime_start, type))}</td>
              <td>{displayValue(broadcast.title)}</td>
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
