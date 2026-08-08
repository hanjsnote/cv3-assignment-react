const express = require("express");
const axios = require("axios");

const app = express();
const SCHEDULE_API_URL = "https://live.ecomm-data.com/api/schedule/list";
const REQUEST_TIMEOUT_MS = 10_000;

function getScheduleDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1; // JavaScript months are 0-indexed)
    const day = today.getDate();
    
    return (
        year.toString().slice(-2) +
        month.toString().padStart(2, "0") +
        day.toString().padStart(2, "0")
    );
}

app.get("/api/list", async (req, res) => {
    try {
        const response = await axios.post(
        SCHEDULE_API_URL,
        { date: getScheduleDate() },
        // 외부 서버가 응답하지 않을때 요청이 무한정 대기하지 않도록 제한합니다.
        { timeout: REQUEST_TIMEOUT_MS },
    );

    return res.json(response.data);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
                // Axios 설정에 따라 두 코드 중 하나가 발생할 수 있으므로 모두 처리합니다.
                // 외부 API 응답 지연 시간은 이 서버의 내부 오류가 아니므로 500 대신 504를 반환합니다.
                return res.status(504).json({ 
                    error: {
                        code: "SCHEDULE_SERVICE_TIMEOUT",
                        message: "The schedule service took too long to respond."
                    },
                });
            }

            if (error.response) {
                console.error("Schedule API returned an error :", {
                    status: error.response.status,
                    statusText: error.response.statusText,
                });
                // 외부 API가 4xx/5xx 반환해도 이 API의 클라이언트는 잘못으로 단정할 수 없습니다.
                // 외부 의존성의 비정상 응답을 나타내는 502를 반환하고, 응답 본문은 노출하지 않습니다.
                return res.status(502).json({
                    error: {
                        code: "SCHEDULE_SERVICE_BAD_RESPONSE",
                        message: "The schedule service returned an error."
                    }
                });
            }
            
            console.error("Could not reach Schedule API :", error.message);
            // DNS/연결 실패처럼 외부 서비스에 도달하지 못한 경우에는 일시적 장애를 의미하는 503을 반환합니다.
            return res.status(503).json({
                error: {
                    code: "SCHEDULE_SERVICE_UNREACHABLE",
                    message: "The schedule service is temporarily unavailable."
                }
            });
        }

        console.error("Unexpected error while calling Schedule API :", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "An unexpected error occurred while fetching schedule list."
            }
        });
    }
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});