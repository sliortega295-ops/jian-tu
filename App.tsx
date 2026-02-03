import React, { useState } from 'react';
import InputForm from './components/InputForm';
import ResultView from './components/ResultView';
import { TravelFormData, ParsedResponse, ViewState } from './types';
import { planTrip } from './services/geminiService';

const App: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>(ViewState.IDLE);
  const [result, setResult] = useState<ParsedResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [currentDestination, setCurrentDestination] = useState<string>('');
  const [currentStartDate, setCurrentStartDate] = useState<string>('');

  const handleFormSubmit = async (data: TravelFormData) => {
    setViewState(ViewState.LOADING);
    setCurrentDestination(data.destination);
    setCurrentStartDate(data.startDate);
    setErrorMsg('');
    
    try {
      const response = await planTrip(data);
      setResult(response);
      setViewState(ViewState.RESULT);
    } catch (err: any) {
      console.error("Plan Trip Error:", err);
      let message = '规划过程中出现了未知错误，请稍后重试。';
      const rawMsg = err.message || '';
      
      // Handle standard API errors
      if (rawMsg.includes('400')) {
        message = '请求无效 (400)：请检查输入信息，或确认当前地区是否支持 AI 服务。';
      } else if (rawMsg.includes('401')) {
        message = '认证失败 (401)：系统配置错误，请联系管理员。';
      } else if (rawMsg.includes('403')) {
        message = '访问受限 (403)：您的位置或账户可能受到服务限制。';
      } else if (rawMsg.includes('429')) {
        message = '服务繁忙 (429)：当前请求量过大，请喝杯水稍后再试。';
      } else if (rawMsg.includes('500') || rawMsg.includes('503')) {
        message = '服务器暂时不可用 (5xx)：AI 大脑正在重启，请稍后重试。';
      } 
      // Handle custom Service errors (Safety, Empty, etc.)
      else if (rawMsg.includes('SAFETY') || rawMsg.includes('RECITATION')) {
        message = '内容受限：行程方案触发了安全过滤器，建议调整目的地描述或简化要求。';
      } else if (rawMsg.includes('EMPTY_RESPONSE') || rawMsg.includes('API_NO_RESPONSE')) {
        message = '生成中断：网络连接不稳定或 AI 服务响应超时，请重试。';
      } else if (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')) {
        message = '网络连接失败：请检查您的网络设置，确保能访问外部服务。';
      } else if (rawMsg) {
        // Use the explicit message thrown from service if available
        message = rawMsg;
      }
      
      setErrorMsg(message);
      setViewState(ViewState.ERROR);
    }
  };

  const handleReset = () => {
    setViewState(ViewState.IDLE);
    setResult(null);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] relative overflow-hidden font-sans">
      {/* Background Decorative Blob */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-brand-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute top-[20%] left-[-10%] w-[400px] h-[400px] bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

      <div className="relative z-10 container mx-auto px-4 py-8 md:py-16">
        
        {viewState === ViewState.IDLE && (
          <div className="flex flex-col items-center justify-center min-h-[80vh] animate-fade-in-up">
             <InputForm onSubmit={handleFormSubmit} isLoading={false} />
          </div>
        )}

        {viewState === ViewState.LOADING && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-pulse">
            <div className="w-16 h-16 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-6"></div>
            <h2 className="text-2xl font-light text-stone-700">正在链接当地向导...</h2>
            <p className="text-stone-500 mt-2">分析目的地气候 · 计算交通预算 · 匹配您的旅行人格</p>
          </div>
        )}

        {viewState === ViewState.RESULT && result && (
          <ResultView 
            data={result} 
            onReset={handleReset} 
            destination={currentDestination}
            startDate={currentStartDate}
          />
        )}

        {viewState === ViewState.ERROR && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center animate-fade-in">
            <div className="bg-red-50 text-red-600 p-8 rounded-2xl border border-red-100 shadow-sm w-full">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <h3 className="text-xl font-bold mb-2 text-red-800">哎呀，出错了</h3>
              <p className="mb-6 text-red-700 leading-relaxed">{errorMsg}</p>
              <button 
                onClick={handleReset}
                className="w-full px-6 py-3 bg-white border border-red-200 text-red-600 rounded-xl hover:bg-red-50 hover:border-red-300 transition-colors font-semibold shadow-sm"
              >
                返回重试
              </button>
            </div>
          </div>
        )}

      </div>
      
      {/* Footer */}
      <footer className="absolute bottom-4 w-full text-center text-stone-400 text-xs">
        © 2024 Jian Tu AI Travel Guide. Powered by Gemini 3.
      </footer>
    </div>
  );
};

export default App;