import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

// Initialize Gemini with server-side API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/generate-plan', async (req, res) => {
    try {
        const { destination, days, budget, style, startDate, companions, requirements } = req.body;

        // Validate required fields
        if (!destination || !days) {
            return res.status(400).json({ error: '目的地和天数为必填项' });
        }

        // Construct prompt
        const prompt = `你是专业的旅行规划师，请为用户生成详细的${destination}${days}日游攻略。

用户信息:
- 预算: ${budget || '不限'}
- 风格: ${style || '休闲'}
- 出发日期: ${startDate || '近期'}
- 同行人: ${companions || '独自'}
- 特殊需求: ${requirements || '无'}

请按以下格式输出:
## 第一天: [主题]
| **时间** | **活动** | **详情** |
|----------|----------|----------|
| 09:00 | 活动名称 | 详细描述 |

包含:
1. 每日详细时间表
2. 餐饮推荐
3. 住宿建议
4. 预估费用
5. 景点坐标(格式: lat,lng)

请用中文回复。`;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        res.json({
            success: true,
            data: {
                rawText: text,
                metadata: {
                    destination,
                    days: parseInt(days),
                    total_budget_est: budget || '5000',
                    tags: [style || '休闲', '美食', '打卡'],
                    route_coordinates: []
                }
            }
        });
    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({
            error: '生成失败，请稍后重试',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

export default router;
