import { TravelFormData, ParsedResponse } from "../types";

// API endpoint - uses backend proxy for security
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

export const planTrip = async (data: TravelFormData): Promise<ParsedResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/plan-trip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        destination: data.destination,
        days: data.days,
        budget: data.budget,
        personality: data.personality,
        startDate: data.startDate,
        travelers: data.travelers,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `请求失败: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '生成失败');
    }

    return parseResponse(result.data.rawText, result.data.metadata);
  } catch (error: any) {
    console.error('API Error:', error);
    throw error;
  }
};

const parseResponse = (rawText: string, metadata?: any): ParsedResponse => {
  // If metadata is already provided by backend, use it
  if (metadata) {
    return {
      rawText,
      metadata
    };
  }

  // Fallback: try to parse JSON from text
  let parsedMetadata: any = undefined;
  let cleanText = rawText;

  const codeBlockMatch = rawText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    try {
      parsedMetadata = JSON.parse(codeBlockMatch[1]);
      cleanText = rawText.replace(codeBlockMatch[0], '').trim();
    } catch (e) {
      console.warn('Failed to parse JSON metadata:', e);
    }
  }

  return {
    rawText: cleanText,
    metadata: parsedMetadata
  };
};