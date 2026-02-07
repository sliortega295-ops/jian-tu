const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Stricter rate limit for AI endpoint (expensive operation)
const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 requests per minute per IP
    message: { error: 'AI规划请求过于频繁，请等待1分钟后再试', code: 'RATE_LIMIT' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Input validation middleware
const validateTripInput = (req, res, next) => {
    const { destination, startDate, travelers, budget, days, personality } = req.body;

    // Required fields check
    if (!destination || !startDate || !travelers || !budget || !days) {
        return res.status(400).json({
            error: '请填写所有必填字段',
            code: 'MISSING_FIELDS'
        });
    }

    // Length limits (prevent abuse)
    const limits = {
        destination: 100,
        travelers: 50,
        budget: 20,
        days: 10,
        personality: 100
    };

    for (const [field, maxLen] of Object.entries(limits)) {
        if (req.body[field] && String(req.body[field]).length > maxLen) {
            return res.status(400).json({
                error: `${field} 字段过长 (最大 ${maxLen} 字符)`,
                code: 'FIELD_TOO_LONG'
            });
        }
    }

    // Sanitize inputs - remove potential script tags and HTML
    const sanitize = (str) => {
        if (!str) return str;
        return String(str)
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<[^>]*>/g, '')
            .trim();
    };

    req.body.destination = sanitize(destination);
    req.body.travelers = sanitize(travelers);
    req.body.personality = sanitize(personality);

    // Validate numeric fields
    const budgetNum = parseInt(budget);
    const daysNum = parseInt(days);

    if (isNaN(budgetNum) || budgetNum < 0 || budgetNum > 10000000) {
        return res.status(400).json({
            error: '预算金额无效',
            code: 'INVALID_BUDGET'
        });
    }

    if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
        return res.status(400).json({
            error: '天数无效 (1-365)',
            code: 'INVALID_DAYS'
        });
    }

    next();
};

const SYSTEM_INSTRUCTION = `
# Role
你是一款名为"简途 (Jian Tu)"的极简主义旅游规划 AI。你的身份是一位热情、专业、且具备深度心理学洞察力的当地向导。

# Design Philosophy
1. **极简主义**：用户输入越少，你通过逻辑推导提供的价值越多。
2. **闭环体验**：不仅提供"去哪"，更要提供"怎么去"和"花多少"。
3. **心理对齐**：根据用户的[旅游人格]动态调整行程的节奏与密度。

# Core Logic & Constraints

## 1. 旅游人格模式 (Travel Personality Modes) - 必须严格遵守

### A. 模式：松弛感 (The Chiller)
* **核心逻辑**: "反内卷"。少即是多，氛围 > 景点。
* **[硬约束] 起床时间**: 禁止安排 **10:30 AM** 之前的行程（除非用户看日出）。
* **[硬约束] 每日密度**: 每日景点 (POI) **严格 <= 3 个**。
* **[硬约束] 强制留白**: 必须在 14:00-16:00 之间安排"下午茶/咖啡/回酒店躺平"时段，时长不低于 1.5 小时。
* **选点偏好**: 景观位餐厅、江边长椅、美术馆、老巷子。
* **交通策略**: 优先打车，拒绝挤早高峰地铁。
* **玩法描述语气**: "在这里发呆半小时..." / "点一杯拿铁..."
* **酒店推荐**: 必须推荐隔音好、有浴缸或景观的酒店。

### B. 模式：特种兵 (The Commando)
* **核心逻辑**: "极限效率"。时间就是金钱，覆盖率 > 体验感。
* **[硬约束] 起床时间**: **06:00 AM - 07:00 AM** 必须出发。
* **[硬约束] 每日密度**: 每日景点 (POI) **必须 >= 6 个**。
* **[硬约束] 间隙管理**: 景点间转场时间不得超过 40 分钟，午饭建议 30 分钟解决（路边摊/快餐）。
* **选点偏好**: 地标打卡、网红牌子、博物馆（快速浏览）、夜市。
* **交通策略**: 夜骑、红眼航班、地铁换乘跑动。
* **玩法描述语气**: "拍完照马上撤..." / "不要排队，直接去..."
* **酒店推荐**: 推荐离地铁站最近的青旅或洗浴中心。

### C. 模式：探索者 (The Explorer)
* **核心逻辑**: "反游客"。寻找B面城市，好奇心 > 舒适度。
* **[硬约束] 每日密度**: 每日景点 4-5 个，但单点停留时间长。
* **[硬约束] 避坑逻辑**: **严禁**推荐"游客街"（如北京南锣鼓巷、成都宽窄巷子主街），必须推荐其旁边的分支巷弄。
* **选点偏好**: 菜市场、废墟、本地大学、居民楼下的苍蝇馆子。
* **交通策略**: Citywalk (5km+), 公交车, 轮渡。
* **玩法描述语气**: "这里游客很少..." / "跟本地人一起..."
* **酒店推荐**: 推荐老城区民宿或有故事的老宅。

## 2. 预算硬约束 (Budget Guardrail)
- **计算公式**：日均可用预算 = (总预算 - 交通大头) / 天数。
- **预警触发**：若日均可用预算低于该城市生存线，必须在回复的最前端输出财务提醒。

## 3. 精细化路线策划
- **上下文感知**：根据季节和同行人调整推荐。
- **颗粒度**：行程需精确到小时。
- **真实数据增强**：利用 Search 查找真实评分 (Rating) 和评论 (Review)。

# Output Format (Required)
1. **向导开场白**：热情、带有当地气息的问候。
2. **财务可行性报告**（仅在预算紧张时显示）。
3. **每日行程（Markdown 格式）**：
   - 必须使用 \`#### Day X: 主题\` 格式作为每一天的标题。
   - 每一项活动 **必须** 以 \`* **HH:MM - HH:MM** 活动名称...\` (推荐格式，表示具体时间段) 或 \`* **HH:MM** 活动名称...\` 开头。
   - **覆盖全天**：从早餐到回酒店，时间线必须连续且具体。

4. **JSON 数据块** (CRITICAL):
   回复的**最后**必须包含一个 JSON 代码块，严格遵守以下结构。
   
   **核心指令 (Strict Mirroring)**: 
   JSON 数据块不仅仅是地图数据，它**就是**行程表的结构化版本。**必须**确保 JSON 中的 \`route_coordinates\` 列表与上方 Markdown 行程**完全一致 (1:1)**。

   - **绝对禁止遗漏**: Markdown 里列出的每一个带有时间点的项目（包括吃饭、交通移动、回酒店、自由活动），JSON 数组里**必须**都有对应的对象。
   - **时间一致性**: JSON 里的 \`time\` 字段必须完全复制 Markdown 里的时间描述（如 "14:00 - 16:00"）。
   - **名称一致性**: JSON 里的 \`name\` 字段必须对应 Markdown 里的活动名称。
   - **坐标处理**: 对于"回酒店"、"前往机场"或"自由活动"等无明确POI的项，如果无法确定精确坐标，请复用上一个地点的坐标或使用该区域的中心坐标，**绝不能因为没有坐标而从 JSON 中删除该项**（前端会处理无坐标的情况）。

   \`\`\`json
   {
     "total_budget_est": "预估总花费 (数值或字符串)",
     "tags": ["标签1", "标签2"],
     "route_coordinates": [
        {
          "day": "Day 1",
          "time": "14:00 - 15:30",
          "name": "抵达大理并入住",
          "lat": 25.69, 
          "lng": 100.16,
          "type": "spot",
          "desc": "入住古城民宿...",
          "rating": "",
          "review": "",
          "cost": "¥50"
        }
     ]
   }
   \`\`\`
`;

// Plan trip endpoint
router.post('/plan-trip', aiLimiter, validateTripInput, async (req, res) => {
    try {
        const { destination, startDate, travelers, budget, days, personality } = req.body;

        // Check API key
        if (!process.env.GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY is not configured');
            return res.status(500).json({
                error: '服务器配置错误，请联系管理员',
                code: 'CONFIG_ERROR'
            });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: 'gemini-3-flash-preview',
            systemInstruction: SYSTEM_INSTRUCTION
        });

        const userPrompt = `
      目的地: ${destination}
      出发日期: ${startDate}
      出行人数/关系: ${travelers}
      总预算: ${budget}元
      天数: ${days}天
      旅游人格/偏好: ${personality || '未指定，请智能推断'}
    `;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
                maxOutputTokens: 8192,
            }
        });

        const response = result.response;

        if (!response || !response.candidates || response.candidates.length === 0) {
            return res.status(500).json({
                error: '服务端未返回有效数据，请检查网络状态',
                code: 'API_NO_RESPONSE'
            });
        }

        const candidate = response.candidates[0];

        if (candidate.finishReason === 'SAFETY') {
            return res.status(400).json({
                error: '您的行程请求触发了安全过滤器，请调整描述后重试',
                code: 'SAFETY_BLOCK'
            });
        }

        if (candidate.finishReason === 'RECITATION') {
            return res.status(400).json({
                error: '生成内容涉及受限信息，请重试',
                code: 'RECITATION_BLOCK'
            });
        }

        const text = response.text();

        if (!text) {
            return res.status(500).json({
                error: '生成内容为空，可能是由于模型高负载，请稍后再试',
                code: 'EMPTY_RESPONSE'
            });
        }

        const parsed = parseResponse(text);

        res.json({
            success: true,
            data: parsed
        });

    } catch (error) {
        console.error('Plan Trip Error:', error);

        let statusCode = 500;
        let errorMessage = '规划过程中出现了未知错误，请稍后重试';
        let errorCode = 'UNKNOWN_ERROR';

        const rawMsg = error.message || '';

        if (rawMsg.includes('400')) {
            statusCode = 400;
            errorMessage = '请求无效，请检查输入信息';
            errorCode = 'BAD_REQUEST';
        } else if (rawMsg.includes('401') || rawMsg.includes('403')) {
            statusCode = 500;
            errorMessage = '服务器配置错误，请联系管理员';
            errorCode = 'AUTH_ERROR';
        } else if (rawMsg.includes('429')) {
            statusCode = 429;
            errorMessage = '服务繁忙，请喝杯水稍后再试';
            errorCode = 'RATE_LIMITED';
        } else if (rawMsg.includes('500') || rawMsg.includes('503')) {
            statusCode = 503;
            errorMessage = 'AI服务暂时不可用，请稍后重试';
            errorCode = 'SERVICE_UNAVAILABLE';
        }

        res.status(statusCode).json({ error: errorMessage, code: errorCode });
    }
});

// Helper function to parse AI response
function parseResponse(text) {
    let metadata = undefined;
    let cleanText = text;

    const tryParse = (str) => {
        try {
            return sanitizeAndParse(str);
        } catch (e) {
            return null;
        }
    };

    // Strategy 1: Standard Code Block
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
        metadata = tryParse(codeBlockMatch[1]);
        if (metadata) {
            cleanText = text.replace(codeBlockMatch[0], '').trim();
        }
    }

    // Strategy 2: Code block start but missing end (Truncated)
    if (!metadata) {
        const startMatch = text.match(/```(?:json)?\s*(\{[\s\S]*)/);
        if (startMatch) {
            const potentialJson = startMatch[1];
            const lastBrace = potentialJson.lastIndexOf('}');
            if (lastBrace !== -1) {
                const jsonCand = potentialJson.substring(0, lastBrace + 1);
                metadata = tryParse(jsonCand);
                if (metadata) {
                    cleanText = text.substring(0, startMatch.index).trim();
                }
            }
        }
    }

    // Strategy 3: Just find the last JSON object looking thing in the text
    if (!metadata) {
        const keyIndex = text.lastIndexOf('"route_coordinates"');
        if (keyIndex !== -1) {
            const openBrace = text.lastIndexOf('{', keyIndex);
            const closeBrace = text.lastIndexOf('}');
            if (openBrace !== -1 && closeBrace !== -1 && closeBrace > openBrace) {
                const jsonCand = text.substring(openBrace, closeBrace + 1);
                metadata = tryParse(jsonCand);
                if (metadata) {
                    if (text.length - closeBrace < 100) {
                        cleanText = text.substring(0, openBrace).trim();
                    }
                }
            }
        }
    }

    return {
        rawText: cleanText,
        metadata
    };
}

function sanitizeAndParse(jsonStr) {
    // Remove comments
    let clean = jsonStr.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    // Fix trailing commas
    clean = clean.replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(clean);
}

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        hasApiKey: !!process.env.GEMINI_API_KEY
    });
});

module.exports = router;
