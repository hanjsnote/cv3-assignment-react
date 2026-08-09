# CV3 Assignment

라방바 데이터랩의 라이브 방송 및 홈쇼핑 방송 목록을 조회하는 웹 페이지입니다.

## 기술 스택

- Frontend: React, Vite
- Backend: Node.js, Express
- HTTP Client: Axios

## 실행 환경

- Windows
- Node.js 18 이상

## 실행 방법

### 1. 저장소 클론
git clone git@github.com:hanjsnote/cv3-assignment.git
cd cv3-assignment

### 2. Backend 실행
터미널에서 프로젝트 루트로 이동한 후 다음 명령을 실행합니다.

cd backend
npm install
node index.js

백엔드 서버가 http://localhost:3000에서 실행됩니다.

### 3. Frontend 실행
새 터미널을 열고 프로젝트의 frontend 폴더로 이동합니다.

cd frontend
npm install
npm run dev

Vite 개발 서버가 실행되면 브라우저에서 다음 주소로 접속합니다.
http://localhost:5173

### 4. 주요 기능
라방 / 홈쇼핑 유형 전환
각 유형별 방송 목록 조회
각 유형별 상위 10개 방송 표시
방송 제목 표시
방송 분류 표시
방송 시간 표시
조회수 표시
판매량 표시
매출액 표시
상품수 표시
방송 상태 표시

### 5. 데이터 처리
과제 페이지에서 사용하는 실제 방송 데이터를 외부 API를 통해 조회합니다.

라방과 홈쇼핑은 서로 다른 API 응답 구조를 가지고 있기 때문에
Backend에서 공통된 형태로 변환한 후 React에서 동일한 방식으로 렌더링합니다.

### 6. 개발 환경
OS: Windows
Node.js: 18+