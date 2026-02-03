import React, { useState } from 'react';
import { TravelFormData } from '../types';
import { Compass, Coins, Calendar, User, MapPin, Users, CalendarDays } from 'lucide-react';

interface InputFormProps {
  onSubmit: (data: TravelFormData) => void;
  isLoading: boolean;
}

const InputForm: React.FC<InputFormProps> = ({ onSubmit, isLoading }) => {
  // Get tomorrow's date for default
  const getDefaultDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState<TravelFormData>({
    destination: '大理',
    startDate: getDefaultDate(),
    travelers: '情侣',
    budget: '5000',
    days: '5',
    personality: '松弛感'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.destination || !formData.budget || !formData.days || !formData.startDate || !formData.travelers) return;
    onSubmit(formData);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 border border-stone-100 transition-all duration-500 hover:shadow-2xl">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-light text-brand-900 tracking-tight mb-2">简途 <span className="font-semibold text-brand-600">Jian Tu</span></h2>
        <p className="text-stone-500 text-sm">极简主义 · 心理学向导 · 闭环规划</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Destination */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider ml-1 flex items-center gap-1">
            <MapPin size={14} /> 目的地
          </label>
          <input
            type="text"
            name="destination"
            value={formData.destination}
            onChange={handleChange}
            placeholder="例如：大理、京都、冰岛"
            className="w-full bg-stone-50 border-b-2 border-stone-200 focus:border-brand-500 px-4 py-3 outline-none text-lg text-stone-800 transition-colors placeholder:text-stone-300 rounded-t-lg"
            required
          />
        </div>

        {/* Date & Travelers Row */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider ml-1 flex items-center gap-1">
              <CalendarDays size={14} /> 出发日期
            </label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              className="w-full bg-stone-50 border-b-2 border-stone-200 focus:border-brand-500 px-4 py-3 outline-none text-base text-stone-800 transition-colors placeholder:text-stone-300 rounded-t-lg"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider ml-1 flex items-center gap-1">
              <Users size={14} /> 旅游人数/关系
            </label>
            <input
              type="text"
              name="travelers"
              value={formData.travelers}
              onChange={handleChange}
              placeholder="如: 情侣, 一家三口"
              className="w-full bg-stone-50 border-b-2 border-stone-200 focus:border-brand-500 px-4 py-3 outline-none text-base text-stone-800 transition-colors placeholder:text-stone-300 rounded-t-lg"
              required
            />
          </div>
        </div>

        {/* Budget & Days Row */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider ml-1 flex items-center gap-1">
              <Coins size={14} /> 预算 (CNY)
            </label>
            <input
              type="number"
              name="budget"
              value={formData.budget}
              onChange={handleChange}
              placeholder="3000"
              className="w-full bg-stone-50 border-b-2 border-stone-200 focus:border-brand-500 px-4 py-3 outline-none text-lg text-stone-800 transition-colors placeholder:text-stone-300 rounded-t-lg"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider ml-1 flex items-center gap-1">
              <Calendar size={14} /> 天数
            </label>
            <input
              type="number"
              name="days"
              value={formData.days}
              onChange={handleChange}
              placeholder="5"
              className="w-full bg-stone-50 border-b-2 border-stone-200 focus:border-brand-500 px-4 py-3 outline-none text-lg text-stone-800 transition-colors placeholder:text-stone-300 rounded-t-lg"
              required
            />
          </div>
        </div>

        {/* Personality (Optional) */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider ml-1 flex items-center gap-1">
            <User size={14} /> 旅游人格 (选填)
          </label>
          <input
            type="text"
            name="personality"
            value={formData.personality}
            onChange={handleChange}
            placeholder="特种兵 / 松弛感 / 探索者..."
            className="w-full bg-stone-50 border-b-2 border-stone-200 focus:border-brand-500 px-4 py-3 outline-none text-lg text-stone-800 transition-colors placeholder:text-stone-300 rounded-t-lg"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full mt-4 py-4 rounded-xl text-white font-medium text-lg tracking-wide transition-all transform active:scale-95 shadow-lg shadow-brand-200
            ${isLoading ? 'bg-stone-300 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 hover:shadow-brand-300'}
          `}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Compass className="animate-spin" /> 正在规划...
            </span>
          ) : (
            "生成简途方案"
          )}
        </button>
      </form>
    </div>
  );
};

export default InputForm;