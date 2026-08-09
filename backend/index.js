const express = require("express");
const axios = require("axios");

const app = express();
const GNB_API_URL = "https://live.ecomm-data.com/api/home/gnb";
const REQUEST_TIMEOUT_MS = 10_000;

function getScheduleDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    return (
        year.toString().slice(-2) +
        month.toString().padStart(2, "0") +
        day.toString().padStart(2, "0")
    );
}

app.get("/api/list", async (req, res) => {
    const type = req.query.type;

    if (type !== "lb" && type !== "hs") {
        return res.status(400).json({
            error: {
                code: "INVALID_TYPE",
                message: "type must be 'lb' or 'hs'.",
            },
        });
    }

    const SCHEDULE_API_URL = 
        type === "hs"
            ? "https://live.ecomm-data.com/api/schedule/list_hs"
            : "https://live.ecomm-data.com/api/schedule/list";

    try {
        // 서로 의존하지 않는 외부 요청을 병렬로 실행해 응답 대기 시간을 줄입니다.
        const [scheduleResponse, gnbResponse] = await Promise.all([
            axios.post(
                SCHEDULE_API_URL,
                { date: getScheduleDate() },
                { timeout: REQUEST_TIMEOUT_MS },
            ),
            axios.post(GNB_API_URL, {}, { timeout: REQUEST_TIMEOUT_MS }),
        ]);

        const schedule = scheduleResponse.data;
        const categories = gnbResponse.data.cats;

        // lb과 hs API의 응답 데이터 구조를 프론트엔드에서 사용하기 편한 형태로 통합합니다.
        const list = schedule.list.map((broadcast) => {
            if (type === "hs") {
                return {
                    id: broadcast.hsshow_id,
                    datetime_start: broadcast.hsshow_datetime_start,
                    datetime_end: broadcast.hsshow_datetime_end,
                    title: broadcast.hsshow_title,
                    category: broadcast.cat?.cat_name ?? null,
                    visit_cnt: broadcast.visit_cnt,
                    sales_cnt: broadcast.sales_cnt,
                    sales_amt: broadcast.sales_amt,
                    product_cnt: broadcast.item_cnt
                };
            }

            return {
                id: broadcast.labang_id,
                datetime_start:broadcast.labang_datetime_start,
                datetime_end: broadcast.labang_datetime_end,
                title: broadcast.labang_title,
                category: categories[String(broadcast.pid)]?.name ?? null,
                visit_cnt: broadcast.visit_cnt,
                sales_cnt: broadcast.sales_cnt,
                sales_amt: broadcast.sales_amt,
                product_cnt: broadcast.product_cnt
            }
        });

        return res.json({ ...schedule, list });

    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
                // Axios 설정에 따라 두 코드 중 하나가 발생할 수 있으므로 모두 처리합니다.
                // 외부 API 응답 지연은 이 서버의 내부 오류가 아니므로 500 대신 504를 반환합니다.
                return res.status(504).json({
                    error: {
                        code: "SCHEDULE_SERVICE_TIMEOUT",
                        message: "The schedule service took too long to respond.",
                    },
                });
            }

            if (error.response) {
                console.error("Schedule API returned an error:", {
                    status: error.response.status,
                    statusText: error.response.statusText,
                });
                // 외부 API가 4xx/5xx를 반환해도 이 API의 클라이언트 잘못으로 단정할 수 없습니다.
                // 외부 의존성의 비정상 응답을 나타내는 502를 반환하고, 응답 본문은 노출하지 않습니다.
                return res.status(502).json({
                    error: {
                        code: "SCHEDULE_SERVICE_BAD_RESPONSE",
                        message: "The schedule service returned an error.",
                    },
                });
            }

            console.error("Could not reach Schedule API:", error.message);
            // DNS/연결 실패처럼 외부 서비스에 도달하지 못한 경우에는 일시적 장애를 의미하는 503을 반환합니다.
            return res.status(503).json({
                error: {
                    code: "SCHEDULE_SERVICE_UNREACHABLE",
                    message: "The schedule service is temporarily unavailable.",
                },
            });
        }

        console.error("Unexpected error while calling Schedule API:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "An unexpected error occurred while fetching schedule list.",
            },
        });
    }
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
