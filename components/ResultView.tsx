import React, { useState, useMemo, useEffect } from 'react';
import { ParsedResponse, RouteCoordinate, CommunityReview, LocationType } from '../types';
import { ArrowLeft, Tag, Map as MapIcon, Calculator, List, Link as LinkIcon, AlertCircle, Maximize2, Clock, MapPin, Utensils, Camera, Bed, Navigation, Briefcase, Sun, Zap, Footprints, Star, TrendingUp, Cloud, CloudRain, CloudSun, Snowflake, CloudLightning, X, Wallet, ChevronRight, Coins, Plus, Search, Loader2, Users, MessageSquare, Heart, Share2, PenTool, Image as ImageIcon, GripVertical, Check, Award, Trash2, Edit3, Save, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import InteractiveMap from './InteractiveMap';

interface ResultViewProps {
  data: ParsedResponse;
  onReset: () => void;
  destination: string;
  startDate?: string;
}

type Tab = 'plan' | 'map' | 'community';

// --- Helper Functions for Time Management ---

// Parse "HH:MM" or "HH:MM - HH:MM" into minutes from midnight
const parseTimeMinutes = (timeStr: string): { start: number, end: number } | null => {
  if (!timeStr) return null;
  // Normalize Chinese colon
  const clean = timeStr.replace('：', ':').trim();
  const matches = clean.match(/(\d{1,2}):(\d{2})/g);

  if (!matches || matches.length === 0) return null;

  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const start = toMin(matches[0]);
  let end = start + 60; // Default duration 1 hour if not specified

  if (matches.length > 1) {
    end = toMin(matches[1]);
  }

  return { start, end };
};

// Sort items by time and validate constraints
const processDaySchedule = (items: RouteCoordinate[], tags: string[] = []): { sortedItems: RouteCoordinate[], warnings: string[] } => {
    // Separate items with valid time format and those without (e.g. "Morning")
    const timedItems: { item: RouteCoordinate, time: { start: number, end: number } }[] = [];
    const untimedItems: RouteCoordinate[] = [];

    items.forEach(item => {
        const parsed = parseTimeMinutes(item.time || '');
        if (parsed) {
            timedItems.push({ item, time: parsed });
        } else {
            untimedItems.push(item);
        }
    });

    // 1. Sort by start time
    timedItems.sort((a, b) => a.time.start - b.time.start);

    // 2. Validate Constraints
    const warnings: string[] = [];
    
    // Only check for PHYSICAL overlaps (End time > Start time of next item)
    // Removed the "15 minute buffer" check as it contradicts user preference for "Relaxed" vibe (which might just mean longer activities, not gaps)
    for (let i = 0; i < timedItems.length - 1; i++) {
        const current = timedItems[i];
        const next = timedItems[i+1];

        // Check for physical overlap (Always warn)
        if (current.time.end > next.time.start) {
            warnings.push(`时间冲突: "${current.item.name}" (${current.item.time}) 与 "${next.item.name}" (${next.item.time}) 时间重叠。`);
        } 
    }

    // Reconstruct sorted array
    const sortedItems = [...timedItems.map(wrapper => wrapper.item), ...untimedItems];
    return { sortedItems, warnings };
};


// --- Search Modal Component (Kept as is) ---
interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLocation: (location: any, day: string) => void;
  availableDays: string[];
  defaultDay?: string;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onAddLocation, availableDays, defaultDay }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(defaultDay || availableDays[0] || 'Day 1');

  // Update selected day when defaultDay changes or modal opens
  useEffect(() => {
    if (isOpen && defaultDay) {
      setSelectedDay(defaultDay);
    }
  }, [isOpen, defaultDay]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&accept-language=zh-CN`);
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[80vh] animate-fade-in-up">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/80 backdrop-blur">
          <h3 className="font-serif font-bold text-lg text-stone-800 flex items-center gap-2">
            <Search size={18} className="text-brand-600" />
            探索与添加新地点
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full text-stone-500 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 pb-0">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="搜索餐厅、景点或酒店..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-stone-100 border border-stone-200 rounded-xl px-4 py-3 pl-11 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all text-stone-800 placeholder:text-stone-400"
              autoFocus
            />
            <Search className="absolute left-4 top-3.5 text-stone-400" size={18} />
            <button 
              type="submit" 
              disabled={loading}
              className="absolute right-2 top-2 bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : '搜索'}
            </button>
          </form>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
          {results.length === 0 && !loading && (
             <div className="text-center py-10 text-stone-400 text-sm">
               输入关键词开始搜索<br/>例如：大理古城、星巴克
             </div>
          )}
          {results.map((item, idx) => (
            <div key={idx} className="group p-3 rounded-xl border border-stone-100 hover:border-brand-200 hover:bg-brand-50/30 transition-all cursor-pointer flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-stone-800 text-sm">{item.name || item.display_name.split(',')[0]}</div>
                  <div className="text-xs text-stone-500 mt-1 line-clamp-2">{item.display_name}</div>
                </div>
                <div className="bg-stone-100 text-stone-500 text-[10px] px-1.5 py-0.5 rounded">
                  {item.type === 'yes' ? '地点' : item.type}
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-dashed border-stone-100 flex items-center justify-between opacity-50 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-2">
                   <label className="text-xs text-stone-500">加入到:</label>
                   <select 
                     value={selectedDay}
                     onChange={(e) => setSelectedDay(e.target.value)}
                     onClick={(e) => e.stopPropagation()}
                     className="text-xs bg-white border border-stone-200 rounded px-2 py-1 outline-none focus:border-brand-500"
                   >
                     {availableDays.map(d => <option key={d} value={d}>{d}</option>)}
                   </select>
                </div>
                <button 
                  onClick={() => {
                    onAddLocation({
                      name: item.name || item.display_name.split(',')[0],
                      lat: parseFloat(item.lat),
                      lng: parseFloat(item.lon),
                      desc: item.display_name,
                      type: 'spot', // default type
                      cost: '待定',
                      rating: 'New'
                    }, selectedDay);
                    onClose();
                  }}
                  className="bg-brand-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-brand-700 transition-colors flex items-center gap-1"
                >
                  <Plus size={12} /> 添加
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 bg-stone-50 text-center text-[10px] text-stone-400 border-t border-stone-100">
           Data © OpenStreetMap contributors, ODbL 1.0. 
        </div>
      </div>
    </div>
  );
};

// --- Post Review Modal (Kept as is) ---
interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (review: Omit<CommunityReview, 'id' | 'likes' | 'avatarColor' | 'userName'>) => void;
  initialValues?: { locationName: string; type: LocationType };
}

const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, onSubmit, initialValues }) => {
  const [locationName, setLocationName] = useState('');
  const [type, setType] = useState<LocationType>('spot');
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');

  useEffect(() => {
    if (isOpen) {
        if (initialValues) {
            setLocationName(initialValues.locationName);
            setType(initialValues.type);
        } else {
            setLocationName('');
            setType('spot');
            setRating(5);
            setContent('');
        }
    }
  }, [isOpen, initialValues]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col animate-fade-in-up">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/80 backdrop-blur">
          <h3 className="font-serif font-bold text-lg text-stone-800 flex items-center gap-2">
            <PenTool size={18} className="text-brand-600" />
            分享你的体验
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full text-stone-500 transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
           {/* Location Name */}
           <div>
             <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">地点名称</label>
             <input 
               type="text" 
               value={locationName}
               onChange={(e) => setLocationName(e.target.value)}
               placeholder="例如：云中咖啡馆" 
               className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all text-sm"
             />
           </div>

           {/* Type & Rating Row */}
           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">类别</label>
                <select 
                  value={type}
                  // @ts-ignore
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 outline-none focus:border-brand-500 text-sm"
                >
                  <option value="spot">景点</option>
                  <option value="food">美食</option>
                  <option value="hotel">住宿</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">评分</label>
                <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5">
                   {[1, 2, 3, 4, 5].map((s) => (
                     <button key={s} onClick={() => setRating(s)} className="focus:outline-none hover:scale-110 transition-transform">
                       <Star size={16} className={`${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-stone-300'}`} />
                     </button>
                   ))}
                </div>
              </div>
           </div>

           {/* Content */}
           <div>
             <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">评价内容</label>
             <textarea 
               value={content}
               onChange={(e) => setContent(e.target.value)}
               rows={4}
               placeholder="环境怎么样？有什么推荐的？..."
               className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all text-sm resize-none"
             />
           </div>

           <button 
             onClick={() => {
                if(locationName && content) {
                    onSubmit({ locationName, type, rating, content, date: '刚刚', tags: [] });
                    onClose();
                }
             }}
             disabled={!locationName || !content}
             className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-200 hover:bg-brand-700 hover:shadow-brand-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
           >
             发布笔记
           </button>
        </div>
      </div>
    </div>
  );
};

// --- Recommendation Selection Modal (Kept as is) ---
interface RecommendationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: LocationType;
  destination: string;
  onSelect: (item: any) => void;
}

const RecommendationModal: React.FC<RecommendationModalProps> = ({ isOpen, onClose, type, destination, onSelect }) => {
  if (!isOpen) return null;

  // Mock recommendations generator
  const getRecommendations = () => {
    if (type === 'hotel') {
      return [
        { name: `云隐·${destination}全景度假酒店`, rating: '4.9', cost: '¥800', tags: ['无敌视野', '高端'], desc: '坐拥绝佳景观，服务贴心，提供漂浮下午茶。', image: 'https://images.unsplash.com/photo-1571896349842-68c47eb6d896?q=80&w=400&fit=crop' },
        { name: `橘子设计民宿(${destination}店)`, rating: '4.7', cost: '¥450', tags: ['性价比', '设计感'], desc: '年轻人首选，极简设计风格，位置便利。', image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=400&fit=crop' },
        { name: `${destination}古城背包客栈`, rating: '4.5', cost: '¥120', tags: ['社交', '穷游'], desc: '氛围超好，容易结识新朋友，老板很热情。', image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=400&fit=crop' },
      ];
    } else {
      return [
        { name: `${destination}印象·创意菜`, rating: '4.8', cost: '¥120', tags: ['必吃榜', '融合菜'], desc: '将传统风味与现代烹饪结合，每道菜都是艺术品。', image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=400&fit=crop' },
        { name: `阿婆私房味道`, rating: '4.6', cost: '¥60', tags: ['地道', '老字号'], desc: '藏在巷子里的老味道，本地人常去，分量足。', image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?q=80&w=400&fit=crop' },
        { name: `星空露台餐厅`, rating: '4.7', cost: '¥180', tags: ['景观', '浪漫'], desc: '适合晚餐，可以俯瞰城市夜景，氛围感拉满。', image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=400&fit=crop' },
      ];
    }
  };

  const recommendations = getRecommendations();

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[85vh] animate-fade-in-up">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-white sticky top-0 z-20">
          <div>
            <h3 className="font-serif font-bold text-lg text-stone-800 flex items-center gap-2">
              <Award size={20} className="text-amber-500" />
              {type === 'hotel' ? '高分住宿推荐' : '热门美食榜单'}
            </h3>
            <p className="text-xs text-stone-400 mt-1">基于 {destination} 实时评分大数据甄选</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full text-stone-500 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-stone-50/50">
           {recommendations.map((item, idx) => (
             <div key={idx} className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100 hover:shadow-md transition-all group flex gap-4">
                <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-stone-200">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                   <div>
                     <div className="flex items-start justify-between gap-2">
                       <h4 className="font-bold text-stone-800 leading-tight">{item.name}</h4>
                       <span className="text-xs font-bold text-amber-500 flex items-center gap-0.5 shrink-0 bg-amber-50 px-1.5 py-0.5 rounded">
                         <Star size={10} fill="currentColor" /> {item.rating}
                       </span>
                     </div>
                     <p className="text-xs text-stone-500 mt-1.5 line-clamp-2 leading-relaxed">{item.desc}</p>
                   </div>
                   
                   <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1.5">
                         {item.tags.map(tag => (
                           <span key={tag} className="text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">#{tag}</span>
                         ))}
                         <span className="text-xs font-bold text-stone-800 ml-1">{item.cost}/人</span>
                      </div>
                      <button 
                        onClick={() => {
                          onSelect(item);
                          onClose();
                        }}
                        className="bg-brand-600 hover:bg-brand-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold transition-colors shadow-sm shadow-brand-200 flex items-center gap-1"
                      >
                        选择 <Check size={12} />
                      </button>
                   </div>
                </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};


const ResultView: React.FC<ResultViewProps> = ({ data, onReset, destination, startDate }) => {
  const [activeTab, setActiveTab] = useState<Tab>('plan');
  const [weatherData, setWeatherData] = useState<any>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  
  // Local Mutable State for Itinerary Items
  const [itineraryItems, setItineraryItems] = useState<RouteCoordinate[]>([]);
  const [dayWarnings, setDayWarnings] = useState<Record<string, string[]>>({}); // Warnings per day

  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchModalDay, setSearchModalDay] = useState<string>('Day 1');

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewInitialValues, setReviewInitialValues] = useState<{locationName: string; type: LocationType} | undefined>(undefined);
  
  // Drag and Drop State
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  // Time Editing State
  const [editingTimeIndex, setEditingTimeIndex] = useState<number | null>(null);
  const [tempTime, setTempTime] = useState<string>('');

  // Recommendation State
  const [showRecModal, setShowRecModal] = useState(false);
  const [recTargetIndex, setRecTargetIndex] = useState<number | null>(null);
  const [recType, setRecType] = useState<LocationType>('spot');

  // Community State
  const [reviews, setReviews] = useState<CommunityReview[]>([]);

  // Initialize state from props & run initial sort/validate
  useEffect(() => {
    if (data.metadata?.route_coordinates) {
      // Run initial validation
      const items = [...data.metadata.route_coordinates];
      const tags = data.metadata.tags || [];
      const newWarnings: Record<string, string[]> = {};
      const sortedAll: RouteCoordinate[] = [];
      
      // Group by day to process
      const days = Array.from(new Set(items.map(i => i.day || 'Day 1')));
      
      days.forEach(day => {
          const dayItems = items.filter(i => (i.day || 'Day 1') === day);
          const { sortedItems, warnings } = processDaySchedule(dayItems, tags);
          sortedAll.push(...sortedItems);
          if (warnings.length > 0) newWarnings[day] = warnings;
      });

      setItineraryItems(sortedAll);
      setDayWarnings(newWarnings);
    }
  }, [data]);

  // Generate Mock Reviews on load
  useEffect(() => {
    const mockReviews: CommunityReview[] = [
      {
        id: '1',
        userName: 'Lisa 旅行',
        avatarColor: 'bg-pink-200',
        locationName: `${destination}古城`,
        type: 'spot',
        rating: 5,
        content: '避开人群的小巷子太有感觉了！建议早上7点去拍日出，光线绝绝子。☕️',
        date: '2小时前',
        likes: 128,
        tags: ['摄影', '小众'],
        image: 'https://images.unsplash.com/photo-1527684651001-731c474bbb5a?q=80&w=600&auto=format&fit=crop'
      },
      {
        id: '2',
        userName: '吃货大雄',
        avatarColor: 'bg-blue-200',
        locationName: '老奶奶稀豆粉',
        type: 'food',
        rating: 4,
        content: '排队半小时，味道确实正宗。油条是现炸的，配上辣子特别香！人均15元吃饱。',
        date: '昨天',
        likes: 45,
        tags: ['平价', '排队王'],
        image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=600&auto=format&fit=crop'
      },
      {
        id: '3',
        userName: 'Jason Walker',
        avatarColor: 'bg-green-200',
        locationName: '云端全景酒店',
        type: 'hotel',
        rating: 5,
        content: '躺在床上看苍山洱海，服务也很贴心，送了晚安牛奶。唯一的缺点是稍微有点贵，但在预算范围内值了！',
        date: '3天前',
        likes: 89,
        tags: ['景观房', '服务好'],
        image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=600&auto=format&fit=crop'
      }
    ];
    setReviews(mockReviews);
  }, [destination]);

  // Helper to re-process state after changes
  const updateItineraryAndWarnings = (newItems: RouteCoordinate[], affectedDays: string[]) => {
      const updatedWarnings = { ...dayWarnings };
      const tags = data.metadata?.tags || [];
      
      // For each affected day, re-sort and validate
      affectedDays.forEach(day => {
          const dayItems = newItems.filter(i => (i.day || 'Day 1') === day);
          const { sortedItems, warnings } = processDaySchedule(dayItems, tags);
          
          // Replace items in the main array with sorted ones
          // 1. Remove old items for this day
          // 2. Insert sorted items (simplest way is to reconstruct the whole array but that messes up other days order potentially if we just filter/push. 
          // Better approach: Since we render by daysMap, strict order in the main array doesn't matter AS LONG AS we update the state with the full list.
          // BUT, to keep it clean, let's filter out the day's items and append the sorted ones? Or just keep them anywhere.
          // Let's rely on the fact that we map over `daysMap` in the render loop.
          
          // However, we want to update the state so that the sorting is persisted.
          // Let's filter out *all* items of this day from newItems, then add the sorted ones.
          const otherItems = newItems.filter(i => (i.day || 'Day 1') !== day);
          // Re-assemble (Note: this puts the edited day at the end of the array, but display is grouped by day keys so it's fine)
          newItems = [...otherItems, ...sortedItems];

          if (warnings.length > 0) {
              updatedWarnings[day] = warnings;
          } else {
              delete updatedWarnings[day];
          }
      });

      setItineraryItems(newItems);
      setDayWarnings(updatedWarnings);
  };


  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = "move";
    if (e.currentTarget instanceof HTMLElement) {
       e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedItemIndex(null);
    if (e.currentTarget instanceof HTMLElement) {
       e.currentTarget.style.opacity = '1';
       e.currentTarget.style.borderTop = '';
       e.currentTarget.style.borderBottom = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    // Visual feedback
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.currentTarget instanceof HTMLElement) {
        if (e.clientY > midY) {
            e.currentTarget.style.borderBottom = '2px solid #0d9488'; // brand-600
            e.currentTarget.style.borderTop = '';
        } else {
            e.currentTarget.style.borderTop = '2px solid #0d9488';
            e.currentTarget.style.borderBottom = '';
        }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.borderTop = '';
        e.currentTarget.style.borderBottom = '';
    }
  };

  const handleDrop = (e: React.DragEvent, targetItem: RouteCoordinate, targetDay: string) => {
    e.preventDefault();
    if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.borderTop = '';
        e.currentTarget.style.borderBottom = '';
        e.currentTarget.style.opacity = '1';
    }

    if (draggedItemIndex === null) return;
    
    const sourceItem = itineraryItems[draggedItemIndex];
    if (sourceItem === targetItem) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertAfter = e.clientY > midY;

    const newItems = [...itineraryItems];
    const [removed] = newItems.splice(draggedItemIndex, 1);
    
    // Check if moving to different day
    const oldDay = removed.day || 'Day 1';
    
    // Update the day of the moved item
    const updatedItem = { ...removed, day: targetDay };

    let targetIndex = newItems.indexOf(targetItem);
    if (targetIndex !== -1) {
        if (insertAfter) {
            targetIndex += 1;
        }
        newItems.splice(targetIndex, 0, updatedItem);
    }

    setDraggedItemIndex(null);
    // Re-validate affected days
    updateItineraryAndWarnings(newItems, [oldDay, targetDay]);
  };


  const handleAddLocation = (locationData: any, day: string) => {
    const newItem: RouteCoordinate = {
      day: day,
      time: "待定", // Default time
      name: locationData.name,
      desc: "用户手动添加: " + locationData.desc,
      lat: locationData.lat,
      lng: locationData.lng,
      type: 'spot',
      cost: '待定',
      rating: 'New',
      opening_hours: '未知',
      contact: '未知'
    };

    const newItems = [...itineraryItems, newItem];
    updateItineraryAndWarnings(newItems, [day]);
  };

  // --- CRUD Operations ---

  const handleDeleteItem = (index: number) => {
      const itemToDelete = itineraryItems[index];
      const newItems = [...itineraryItems];
      newItems.splice(index, 1);
      updateItineraryAndWarnings(newItems, [itemToDelete.day || 'Day 1']);
  };

  const handleStartEditTime = (index: number, currentTime: string = '') => {
      setEditingTimeIndex(index);
      setTempTime(currentTime);
  };

  const handleSaveTime = () => {
      if (editingTimeIndex !== null && tempTime) {
          const newItems = [...itineraryItems];
          const affectedDay = newItems[editingTimeIndex].day || 'Day 1';
          
          newItems[editingTimeIndex] = {
              ...newItems[editingTimeIndex],
              time: tempTime
          };
          
          setEditingTimeIndex(null);
          // This will re-sort and validate
          updateItineraryAndWarnings(newItems, [affectedDay]);
      } else {
          setEditingTimeIndex(null);
      }
  };

  const openSearchForDay = (day: string) => {
      setSearchModalDay(day);
      setShowSearchModal(true);
  }

  // --- Recommendations & Reviews ---

  const handleSelectRecommendation = (rec: any) => {
     if (recTargetIndex === null) return;
     const newItems = [...itineraryItems];
     const targetItem = newItems[recTargetIndex];
     
     newItems[recTargetIndex] = {
         ...targetItem,
         name: rec.name,
         desc: rec.desc,
         cost: rec.cost,
         rating: rec.rating
     };
     setItineraryItems(newItems);
     setRecTargetIndex(null);
  };

  const handleOpenRecommendation = (index: number, type: LocationType) => {
     setRecTargetIndex(index);
     setRecType(type);
     setShowRecModal(true);
  };

  const handleAddReview = (reviewData: Omit<CommunityReview, 'id' | 'likes' | 'avatarColor' | 'userName'>) => {
    const newReview: CommunityReview = {
        ...reviewData,
        id: Date.now().toString(),
        userName: '我',
        avatarColor: 'bg-brand-200',
        likes: 0,
        tags: ['新体验']
    };
    setReviews([newReview, ...reviews]);
    setActiveTab('community'); // Switch to community tab to see the new review
  };

  const handleOpenReview = (location?: RouteCoordinate) => {
    if (location) {
        setReviewInitialValues({
            locationName: location.name,
            type: location.type || 'spot'
        });
    } else {
        setReviewInitialValues(undefined);
    }
    setShowReviewModal(true);
  };

  // --- Data Parsing Helpers ---

  const totalBudget = useMemo(() => {
    if (!data.metadata?.total_budget_est) return 0;
    const str = String(data.metadata.total_budget_est);
    const match = str.replace(/,/g, '').match(/(\d+)/);
    return match ? parseInt(match[0], 10) : 0;
  }, [data.metadata?.total_budget_est]);

  const coordinates = itineraryItems;
  const hasCoordinates = coordinates.length > 0 && coordinates.some(c => c.lat !== undefined && c.lng !== undefined);

  const expenseBreakdown = useMemo(() => {
    let hotelTotal = 0;
    let foodTotal = 0;
    let spotTotal = 0;
    let transportTotal = 0;
    
    const items: { name: string; cost: number; type: string; day: string }[] = [];

    coordinates.forEach(item => {
        if (!item.cost) return;
        if (item.cost.includes('免费') || item.cost.includes('待定')) return;
        
        const match = item.cost.match(/(\d+)/);
        if (match) {
            const val = parseInt(match[0], 10);
            const isTransport = item.name.includes('交通') || item.name.includes('前往') || item.name.includes('接机') || item.name.includes('送机');
            
            items.push({ name: item.name, cost: val, type: isTransport ? 'transport' : (item.type || 'spot'), day: item.day || 'Day 1' });

            if (item.type === 'hotel') hotelTotal += val;
            else if (item.type === 'food') foodTotal += val;
            else if (isTransport) transportTotal += val;
            else spotTotal += val; 
        }
    });

    const trackedTotal = hotelTotal + foodTotal + spotTotal + transportTotal;
    const reserve = totalBudget > trackedTotal ? totalBudget - trackedTotal : 0;

    return {
        hotel: hotelTotal,
        food: foodTotal,
        spot: spotTotal,
        transport: transportTotal,
        reserve,
        trackedTotal,
        items
    };
  }, [coordinates, totalBudget]);

  const chartData = useMemo(() => {
     const d = [
        { name: '住宿', value: expenseBreakdown.hotel, color: '#6366f1' }, 
        { name: '餐饮', value: expenseBreakdown.food, color: '#f97316' }, 
        { name: '门票/玩乐', value: expenseBreakdown.spot, color: '#10b981' }, 
        { name: '交通', value: expenseBreakdown.transport, color: '#06b6d4' }, 
     ];
     if (expenseBreakdown.reserve > 0) {
         d.push({ name: '预留/其他', value: expenseBreakdown.reserve, color: '#e5e7eb' });
     }
     return d.filter(i => i.value > 0);
  }, [expenseBreakdown]);


  // --- Weather Fetching Logic ---
  useEffect(() => {
    const target = coordinates.find(c => c.lat && c.lng && c.lat !== 0 && c.lng !== 0);
    if (!target || !target.lat || !target.lng) return;

    const fetchWeather = async () => {
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${target.lat}&longitude=${target.lng}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`
        );
        const data = await response.json();
        setWeatherData(data);
      } catch (error) {
        console.warn("Weather fetch failed:", error);
      }
    };

    fetchWeather();
  }, [coordinates.length]); 

  // ... (Icons helpers)
  const getWeatherIcon = (code: number) => {
    if (code === 0) return <Sun size={24} className="text-amber-500" />;
    if (code >= 1 && code <= 3) return <CloudSun size={24} className="text-orange-400" />;
    if (code >= 45 && code <= 48) return <Cloud size={24} className="text-stone-400" />;
    if (code >= 51 && code <= 67) return <CloudRain size={24} className="text-blue-500" />;
    if (code >= 71 && code <= 77) return <Snowflake size={24} className="text-cyan-300" />;
    if (code >= 80 && code <= 82) return <CloudRain size={24} className="text-blue-600" />;
    if (code >= 95) return <CloudLightning size={24} className="text-purple-500" />;
    return <Cloud size={24} className="text-stone-400" />;
  };

  const getWeatherLabel = (code: number) => {
    if (code === 0) return "晴朗";
    if (code >= 1 && code <= 3) return "多云";
    if (code >= 45 && code <= 48) return "雾";
    if (code >= 51 && code <= 67) return "雨";
    if (code >= 71 && code <= 77) return "雪";
    if (code >= 80 && code <= 82) return "阵雨";
    if (code >= 95) return "雷雨";
    return "阴";
  };

  const formatWeatherDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'food': return <Utensils size={14} className="text-orange-500" />;
      case 'hotel': return <Bed size={14} className="text-indigo-500" />;
      case 'spot': return <Camera size={14} className="text-emerald-500" />;
      default: return <Navigation size={14} className="text-brand-500" />;
    }
  };

  const dayThemes = useMemo(() => {
    const themes: Record<string, string> = {};
    const lines = data.rawText.split('\n');
    lines.forEach(line => {
      const match = line.match(/^####\s+(Day\s+\d+)[:：]\s*(.*)/i);
      if (match) {
        themes[match[1]] = match[2];
      }
    });
    return themes;
  }, [data.rawText]);

  const daysMap = useMemo(() => {
    const map: Record<string, RouteCoordinate[]> = {};
    itineraryItems.forEach(coord => {
      const d = coord.day || 'Day 1';
      if (!map[d]) map[d] = [];
      map[d].push(coord);
    });
    return map;
  }, [itineraryItems]);
  
  const dayKeys = Object.keys(daysMap).sort();

  const introText = useMemo(() => {
    const firstDayIndex = data.rawText.search(/####\s+Day/);
    if (firstDayIndex === -1) return "";
    let intro = data.rawText.substring(0, firstDayIndex);
    intro = intro.replace(/^#\s+.*$/gm, '').replace(/^##\s+.*$/gm, '').trim();
    return intro;
  }, [data.rawText]);

  const parseBold = (text: string) => {
    return text.split(/(\*\*.*?\*\*)/g).map((part, index) => 
      part.startsWith('**') && part.endsWith('**') 
        ? <strong key={index} className="font-semibold text-stone-800">{part.slice(2, -2)}</strong> 
        : part
    );
  };

  const renderIntroText = (text: string) => {
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} className="h-2"></div>;

      if (trimmed.startsWith('###')) {
         return (
           <h4 key={i} className="text-base font-bold text-stone-800 mt-5 mb-3 flex items-center gap-2">
             <div className="w-1 h-4 bg-brand-500 rounded-full"></div>
             {trimmed.replace(/^###\s*/, '')}
           </h4>
         );
      }

      if (trimmed === '---' || trimmed === '***') {
        return <div key={i} className="h-px bg-stone-100 my-4 w-full" />;
      }

      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
         const content = trimmed.substring(2);
         return (
           <div key={i} className="flex items-start gap-2.5 mb-2 pl-1">
             <div className="w-1.5 h-1.5 rounded-full bg-brand-300 mt-2 shrink-0" />
             <div className="text-stone-600 leading-loose text-[15px]">
               {parseBold(content)}
             </div>
           </div>
         );
      }

      return (
        <p key={i} className="mb-3 leading-loose text-stone-600 text-[15px]">
          {parseBold(trimmed)}
        </p>
      );
    });
  };

  const topSpots = useMemo(() => {
    return itineraryItems
      .filter(c => c.type === 'spot' && c.rating)
      .sort((a, b) => {
         const ra = parseFloat(a.rating?.replace(/[^\d.]/g, '') || '0');
         const rb = parseFloat(b.rating?.replace(/[^\d.]/g, '') || '0');
         return rb - ra;
      })
      .slice(0, 3);
  }, [itineraryItems]);

  const heroImage = `https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2070&auto=format&fit=crop`; 

  return (
    <div className="w-full max-w-6xl mx-auto pb-20 animate-fade-in flex flex-col h-[calc(100vh-2rem)]">
      
      {/* Search Modal */}
      <SearchModal 
        isOpen={showSearchModal} 
        onClose={() => setShowSearchModal(false)} 
        onAddLocation={handleAddLocation}
        availableDays={dayKeys}
        defaultDay={searchModalDay}
      />
      
      {/* Review Modal */}
      <ReviewModal
         isOpen={showReviewModal}
         onClose={() => setShowReviewModal(false)}
         onSubmit={handleAddReview}
         initialValues={reviewInitialValues}
      />

      {/* Recommendation Selection Modal */}
      <RecommendationModal 
         isOpen={showRecModal}
         onClose={() => setShowRecModal(false)}
         type={recType}
         destination={destination}
         onSelect={handleSelectRecommendation}
      />

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 md:right-10 z-40 flex flex-col gap-4">
        {activeTab !== 'community' ? (
           <button 
             onClick={() => openSearchForDay(dayKeys[0])}
             className="bg-brand-600 hover:bg-brand-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center group"
             title="搜索并添加地点"
           >
             <Search size={24} />
             <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-out whitespace-nowrap group-hover:ml-2">
               添加地点
             </span>
           </button>
        ) : (
           <button 
             onClick={() => handleOpenReview()}
             className="bg-brand-600 hover:bg-brand-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center group"
             title="分享体验"
           >
             <PenTool size={24} />
             <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-out whitespace-nowrap group-hover:ml-2">
               分享体验
             </span>
           </button>
        )}
      </div>

      {/* Navbar */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl pt-6 pb-4 px-4 md:px-8 mb-6 flex-none border-b border-stone-100/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
             <button 
              onClick={onReset}
              className="flex items-center gap-2 text-stone-400 hover:text-stone-800 transition-colors font-medium text-sm group"
            >
              <div className="p-2 rounded-full bg-stone-100 group-hover:bg-stone-200 transition-colors">
                <ArrowLeft size={16} />
              </div>
            </button>
            <div>
              <h1 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">{destination}</h1>
              <p className="text-xs text-stone-400 font-sans tracking-widest uppercase">Jian Tu Guided Tour</p>
            </div>
          </div>

          {/* Animated Toggle Switch */}
          <div className="relative flex bg-stone-100 p-1.5 rounded-xl self-center md:self-auto w-80 h-12 shrink-0">
            <div 
              className={`absolute top-1.5 bottom-1.5 w-[calc(33.33%-4px)] bg-white rounded-lg shadow-sm transition-all duration-300 ease-out`}
              style={{ 
                  left: activeTab === 'plan' ? '6px' : activeTab === 'map' ? 'calc(33.33% + 2px)' : 'calc(66.66% - 2px)'
              }}
            ></div>
            <button
              onClick={() => setActiveTab('plan')}
              className={`relative z-10 w-1/3 flex items-center justify-center gap-1.5 text-sm font-medium transition-colors ${
                activeTab === 'plan' ? 'text-stone-800' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              <List size={14} /> 行程
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`relative z-10 w-1/3 flex items-center justify-center gap-1.5 text-sm font-medium transition-colors ${
                activeTab === 'map' ? 'text-stone-800' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              <MapIcon size={14} /> 地图
            </button>
            <button
              onClick={() => setActiveTab('community')}
              className={`relative z-10 w-1/3 flex items-center justify-center gap-1.5 text-sm font-medium transition-colors ${
                activeTab === 'community' ? 'text-stone-800' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              <Users size={14} /> 社区
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow overflow-hidden relative px-4 md:px-8">
        
        {/* TAB 1: PLAN */}
        {activeTab === 'plan' && (
          <div className="h-full overflow-y-auto custom-scrollbar pb-20">
            {/* ... Existing Plan Content ... */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
              <div className="lg:col-span-8 space-y-10">
                <div className="space-y-6">
                  <div className="relative h-48 w-full rounded-2xl overflow-hidden shadow-soft group">
                     <img src={heroImage} alt={destination} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" />
                     <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-8">
                        <p className="text-white/90 font-serif text-lg italic tracking-wide">"旅行是唯一让你花了钱却变得更富有的东西。"</p>
                     </div>
                  </div>
                  {introText && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
                       <div className="flex items-start gap-3">
                         <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 shrink-0 mt-1">
                           <MapIcon size={16} />
                         </div>
                         <div className="w-full">
                           {renderIntroText(introText)}
                         </div>
                       </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  {dayKeys.map((day, dayIdx) => (
                    <div key={day} className="mb-12 relative">
                       <div className="flex items-baseline gap-3 mb-6 sticky top-0 bg-[#f9f9f9]/95 backdrop-blur z-10 py-2">
                         <h2 className="text-3xl font-serif font-medium text-stone-900">{day.replace('Day ', 'Day ')}</h2>
                         <span className="text-lg font-serif text-stone-500 italic">— {dayThemes[day] || '探索之旅'}</span>
                         <button 
                           onClick={() => openSearchForDay(day)}
                           className="ml-auto p-1.5 rounded-full bg-stone-100 text-stone-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                           title="添加行程"
                         >
                           <Plus size={16} />
                         </button>
                       </div>
                       
                       {/* Warnings Section */}
                       {dayWarnings[day] && dayWarnings[day].length > 0 && (
                          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 animate-fade-in flex items-start gap-3">
                             <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                             <div className="space-y-1">
                                <h4 className="text-sm font-bold text-amber-800">行程安排提醒</h4>
                                {dayWarnings[day].map((warn, i) => (
                                   <p key={i} className="text-xs text-amber-700 leading-relaxed">{warn}</p>
                                ))}
                             </div>
                          </div>
                       )}

                       <div className="absolute left-[19px] top-12 bottom-0 w-px bg-stone-200 border-l border-dashed border-stone-300"></div>
                       <div className="space-y-8">
                         {daysMap[day].map((item, idx) => {
                           const globalIndex = itineraryItems.indexOf(item);
                           const isFoodOrHotel = item.type === 'food' || item.type === 'hotel';
                           const isEditingTime = editingTimeIndex === globalIndex;

                           return (
                             <div 
                                key={globalIndex} 
                                className="relative pl-12 group transition-all"
                                draggable={!isEditingTime}
                                onDragStart={(e) => handleDragStart(e, globalIndex)}
                                onDragEnd={handleDragEnd}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, item, day)}
                             >
                                <div className={`absolute left-0 top-1 w-10 h-10 rounded-full bg-white border border-stone-100 shadow-sm flex items-center justify-center z-10 transition-transform duration-300 group-hover:scale-110 group-hover:border-brand-200 group-hover:shadow-md cursor-grab active:cursor-grabbing`}>
                                   {getTypeIcon(item.type)}
                                </div>
                                
                                {/* Drag Grip Handle */}
                                <div className="absolute left-[-24px] top-3 text-stone-300 opacity-0 group-hover:opacity-100 hover:text-brand-500 cursor-grab active:cursor-grabbing transition-opacity p-1">
                                    <GripVertical size={16} />
                                </div>

                                <div className="flex flex-col gap-1 w-full bg-white/50 rounded-xl p-2 hover:bg-white transition-colors">
                                   <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 justify-between">
                                      <div className="flex items-center gap-2">
                                        {/* Editable Time Display */}
                                        {isEditingTime ? (
                                            <div className="flex items-center gap-1 animate-fade-in">
                                                <input 
                                                    type="text" 
                                                    value={tempTime}
                                                    onChange={(e) => setTempTime(e.target.value)}
                                                    className="font-mono text-sm font-bold text-brand-700 bg-white border-b-2 border-brand-500 outline-none w-32 px-1"
                                                    autoFocus
                                                    placeholder="09:00 - 10:00"
                                                    onBlur={handleSaveTime}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveTime()}
                                                />
                                                <button onClick={handleSaveTime} className="text-brand-600 hover:text-brand-800"><Save size={14}/></button>
                                            </div>
                                        ) : (
                                            item.time && (
                                                <span className="font-mono text-sm font-bold text-brand-600 tracking-tight shrink-0">
                                                    {item.time}
                                                </span>
                                            )
                                        )}
                                        
                                        <h3 className="text-lg font-bold text-stone-800 leading-tight group-hover:text-brand-800 transition-colors">
                                            {item.name}
                                        </h3>
                                      </div>
                                   </div>
                                   <div className="flex items-center gap-3 mt-1 mb-2">
                                      {item.rating && (
                                        <span className="text-xs font-bold text-amber-500 flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded">
                                          ★ {item.rating}
                                        </span>
                                      )}
                                      {item.type && (
                                        <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider border border-stone-100 px-1.5 py-0.5 rounded">
                                          {item.type === 'food' ? '美食' : item.type === 'hotel' ? '住宿' : '景点'}
                                        </span>
                                      )}
                                   </div>
                                   <p className="text-stone-600 leading-relaxed text-[15px] font-light">
                                     {item.desc}
                                   </p>
                                   {(item.cost || item.review) && (
                                     <div className="mt-3 flex items-center gap-4 text-xs text-stone-400">
                                        {item.cost && (
                                          <span className="flex items-center gap-1">
                                            <Calculator size={12} /> {item.cost}
                                          </span>
                                        )}
                                        {item.review && (
                                          <span className="italic opacity-70 truncate max-w-[200px]">
                                            "{item.review}"
                                          </span>
                                        )}
                                     </div>
                                   )}
                                   
                                   {/* Explicit Action Buttons Row - ALWAYS VISIBLE */}
                                   <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-stone-100">
                                        {isFoodOrHotel && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenRecommendation(globalIndex, item.type as LocationType);
                                            }}
                                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors text-xs font-medium"
                                          >
                                            <Award size={14} />
                                            <span>甄选推荐</span>
                                          </button>
                                        )}
                                        
                                        <button 
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenReview(item);
                                          }}
                                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-brand-600 transition-colors text-xs font-medium"
                                        >
                                          <PenTool size={14} />
                                          <span>写评价</span>
                                        </button>

                                        <button 
                                            onClick={() => handleStartEditTime(globalIndex, item.time)}
                                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-brand-600 transition-colors text-xs font-medium"
                                        >
                                            <Edit3 size={14} />
                                            <span>修改时间</span>
                                        </button>

                                        <button 
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteItem(globalIndex);
                                          }}
                                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors text-xs font-medium ml-auto"
                                        >
                                          <Trash2 size={14} />
                                          <span>删除行程</span>
                                        </button>
                                   </div>
                                </div>
                             </div>
                           );
                         })}
                         
                         {/* Large Add Button at the end of the day */}
                         <button 
                            onClick={() => openSearchForDay(day)}
                            className="w-full border-2 border-dashed border-stone-200 py-3 text-stone-400 font-bold hover:border-brand-300 hover:text-brand-600 rounded-xl flex items-center justify-center gap-2 transition-all group/add ml-6"
                         >
                            <div className="w-6 h-6 rounded-full bg-stone-100 text-stone-400 group-hover/add:bg-brand-100 group-hover/add:text-brand-600 flex items-center justify-center transition-colors">
                                <Plus size={14} />
                            </div>
                            添加行程至 {day}
                         </button>
                       </div>
                    </div>
                  ))}
                </div>

                {data.groundingMetadata?.groundingChunks && (
                  <div className="flex flex-wrap gap-4 pt-8 border-t border-stone-200">
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2">
                      <LinkIcon size={12} /> Sources
                    </span>
                    {data.groundingMetadata.groundingChunks.map((chunk: any, i: number) => {
                         if (chunk.web?.uri) {
                           return (
                             <a 
                               key={i} 
                               href={chunk.web.uri} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="text-xs text-stone-500 hover:text-brand-600 hover:underline transition-colors"
                             >
                               {chunk.web.title}
                             </a>
                           );
                         }
                         return null;
                    })}
                  </div>
                )}
              </div>

              <div className="lg:col-span-4">
                <div className="sticky top-28 space-y-6">
                  {hasCoordinates && (
                    <div className="bg-white rounded-3xl p-1 shadow-soft border border-stone-50 group">
                      <div className="relative h-64 w-full rounded-[20px] overflow-hidden">
                        <InteractiveMap 
                          coordinates={coordinates} 
                          className="pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity duration-500 grayscale-[20%] group-hover:grayscale-0" 
                          onMaximize={() => setActiveTab('map')}
                        />
                        <button 
                          onClick={() => setActiveTab('map')}
                          className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md text-stone-800 px-4 py-2 rounded-full shadow-glass flex items-center gap-2 text-xs font-bold hover:scale-105 transition-transform cursor-pointer z-[401]"
                        >
                          <Maximize2 size={12} /> 全屏查看
                        </button>
                      </div>
                    </div>
                  )}

                  {weatherData && weatherData.daily && (
                    <div className="bg-white rounded-3xl p-6 shadow-soft border border-stone-50">
                      <div className="flex items-center gap-2 mb-4 text-stone-400 uppercase text-xs font-bold tracking-wider">
                        <Cloud size={14} /> 当地天气
                      </div>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            {getWeatherIcon(weatherData.daily.weather_code[0])}
                            <div>
                               <div className="text-3xl font-serif font-bold text-stone-800">
                                 {Math.round(weatherData.daily.temperature_2m_max[0])}°
                               </div>
                               <div className="text-xs text-stone-500 font-medium">
                                 {getWeatherLabel(weatherData.daily.weather_code[0])} · {Math.round(weatherData.daily.temperature_2m_min[0])}° - {Math.round(weatherData.daily.temperature_2m_max[0])}°
                               </div>
                            </div>
                         </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-stone-100">
                         {weatherData.daily.time.slice(1, 4).map((t: string, i: number) => (
                           <div key={t} className="flex flex-col items-center gap-1.5">
                              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">{formatWeatherDate(t)}</span>
                              <div className="scale-75 origin-center transform">{getWeatherIcon(weatherData.daily.weather_code[i+1])}</div>
                              <span className="text-xs font-bold text-stone-600">
                                {Math.round(weatherData.daily.temperature_2m_max[i+1])}°
                              </span>
                           </div>
                         ))}
                      </div>
                    </div>
                  )}
                  
                  {topSpots.length > 0 && (
                     <div className="bg-white rounded-3xl p-6 shadow-soft border border-stone-50">
                        <div className="flex items-center gap-2 mb-4 text-stone-400 uppercase text-xs font-bold tracking-wider">
                          <TrendingUp size={14} /> 必打卡推荐
                        </div>
                        <div className="space-y-4">
                          {topSpots.map((spot, i) => (
                             <div key={i} className="flex items-start gap-3 pb-3 border-b border-stone-50 last:border-0 last:pb-0">
                                <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center shrink-0 overflow-hidden">
                                   <Camera size={16} className="text-stone-400" />
                                </div>
                                <div>
                                   <h4 className="text-sm font-bold text-stone-800 leading-tight mb-1">{spot.name}</h4>
                                   <div className="flex items-center gap-2">
                                     <span className="text-xs font-bold text-amber-500 flex items-center gap-0.5">
                                       <Star size={10} fill="currentColor" /> {spot.rating}
                                     </span>
                                     <span className="text-[10px] text-stone-400 truncate max-w-[120px]">{spot.desc}</span>
                                   </div>
                                </div>
                             </div>
                          ))}
                        </div>
                     </div>
                  )}

                  <div className="bg-white rounded-3xl p-6 shadow-soft border border-stone-50 relative overflow-hidden group hover:shadow-lg transition-shadow duration-500">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-stone-400 uppercase text-xs font-bold tracking-wider">
                        <Wallet size={14} /> 费用估算
                      </div>
                      <button 
                         onClick={() => setShowExpenseModal(true)}
                         className="text-brand-600 text-xs font-bold hover:text-brand-700 flex items-center hover:underline"
                      >
                         查看详情 <ChevronRight size={12} />
                      </button>
                    </div>
                    {totalBudget > 0 ? (
                      <div className="flex flex-col items-center cursor-pointer" onClick={() => setShowExpenseModal(true)}>
                        <div className="h-48 w-full relative">
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-xs text-stone-400 mb-1 font-medium">总预算</span>
                            <span className="text-2xl font-serif font-bold text-stone-800">¥{totalBudget.toLocaleString()}</span>
                          </div>
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={chartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={70}
                                  paddingAngle={5}
                                  dataKey="value"
                                  stroke="none"
                                >
                                  {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <RechartsTooltip 
                                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '8px 12px' }}
                                  itemStyle={{ fontSize: '12px', color: '#57534e', fontWeight: 600 }}
                                  formatter={(value: number) => `¥${value.toLocaleString()}`}
                                />
                              </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-full mt-2">
                           {chartData.slice(0, 4).map((item, i) => (
                             <div key={i} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5">
                                   <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                                   <span className="text-stone-500">{item.name}</span>
                                </div>
                                <span className="font-bold text-stone-700">¥{item.value.toLocaleString()}</span>
                             </div>
                           ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-3xl font-bold text-stone-800 py-8 text-center">¥{totalBudget > 0 ? totalBudget.toLocaleString() : '---'}</div>
                    )}
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-soft border border-stone-50">
                    <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2 text-xs uppercase tracking-wider text-stone-400">
                      <Briefcase size={14} /> 出行锦囊
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-stone-50 p-3 rounded-xl flex flex-col items-center justify-center text-center gap-2 hover:bg-brand-50 transition-colors group cursor-default">
                          <Sun size={20} className="text-stone-400 group-hover:text-brand-500 transition-colors" />
                          <span className="text-xs text-stone-600 font-medium group-hover:text-brand-700">防晒保湿</span>
                        </div>
                        <div className="bg-stone-50 p-3 rounded-xl flex flex-col items-center justify-center text-center gap-2 hover:bg-brand-50 transition-colors group cursor-default">
                          <Camera size={20} className="text-stone-400 group-hover:text-brand-500 transition-colors" />
                          <span className="text-xs text-stone-600 font-medium group-hover:text-brand-700">相机/胶卷</span>
                        </div>
                        <div className="bg-stone-50 p-3 rounded-xl flex flex-col items-center justify-center text-center gap-2 hover:bg-brand-50 transition-colors group cursor-default">
                          <Zap size={20} className="text-stone-400 group-hover:text-brand-500 transition-colors" />
                          <span className="text-xs text-stone-600 font-medium group-hover:text-brand-700">移动电源</span>
                        </div>
                        <div className="bg-stone-50 p-3 rounded-xl flex flex-col items-center justify-center text-center gap-2 hover:bg-brand-50 transition-colors group cursor-default">
                          <Footprints size={20} className="text-stone-400 group-hover:text-brand-500 transition-colors" />
                          <span className="text-xs text-stone-600 font-medium group-hover:text-brand-700">舒适鞋履</span>
                        </div>
                    </div>
                  </div>

                  {data.metadata?.tags && (
                    <div className="bg-white rounded-3xl p-6 shadow-soft border border-stone-50">
                      <div className="flex items-center gap-2 mb-4 text-stone-400 uppercase text-xs font-bold tracking-wider">
                        <Tag size={14} /> 行程 DNA
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {data.metadata.tags.map(tag => (
                          <span key={tag} className="bg-stone-50 text-stone-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-brand-50 hover:text-brand-700 transition-colors cursor-default">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MAP */}
        {activeTab === 'map' && (
          <div className="absolute inset-0 bg-stone-100 rounded-3xl overflow-hidden shadow-inner border border-stone-200">
            {hasCoordinates ? (
              <InteractiveMap 
                coordinates={coordinates} 
                isFullMode={true}
                className="h-full w-full"
                onAddReview={handleOpenReview}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-stone-400 gap-4">
                <AlertCircle size={48} className="opacity-50 text-stone-300" />
                <p className="text-lg font-serif text-stone-500">暂无地图数据</p>
                <p className="text-sm font-light">向导未能识别出具体的地点坐标。</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: COMMUNITY */}
        {activeTab === 'community' && (
           <div className="h-full overflow-y-auto custom-scrollbar pb-20 animate-fade-in">
             <div className="max-w-4xl mx-auto space-y-8">
               
               {/* Community Header */}
               <div className="text-center space-y-2 py-6">
                 <h2 className="text-2xl font-serif font-bold text-stone-800">
                   {destination} 探索者社区
                 </h2>
                 <p className="text-stone-500 text-sm">
                   发现 {reviews.length} 条来自其他旅行者的灵感
                 </p>
               </div>

               {/* Reviews Grid */}
               <div className="columns-1 md:columns-2 gap-6 space-y-6">
                 {reviews.map((review) => (
                   <div key={review.id} className="break-inside-avoid bg-white rounded-2xl p-5 shadow-sm border border-stone-100 hover:shadow-md transition-shadow group">
                     
                     {/* User Header */}
                     <div className="flex items-center justify-between mb-3">
                       <div className="flex items-center gap-3">
                         <div className={`w-8 h-8 rounded-full ${review.avatarColor} flex items-center justify-center text-xs font-bold text-stone-700 border-2 border-white shadow-sm`}>
                            {review.userName.charAt(0)}
                         </div>
                         <div>
                            <div className="text-xs font-bold text-stone-800">{review.userName}</div>
                            <div className="text-[10px] text-stone-400">{review.date}</div>
                         </div>
                       </div>
                       <button className="text-stone-300 hover:text-brand-500 transition-colors">
                         <Share2 size={16} />
                       </button>
                     </div>

                     {/* Image (Optional) */}
                     {review.image && (
                       <div className="relative mb-4 rounded-xl overflow-hidden h-40 bg-stone-100">
                         <img src={review.image} alt={review.locationName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                         <div className="absolute top-2 right-2 bg-black/40 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                            <ImageIcon size={10} className="inline mr-1" />
                            Live图
                         </div>
                       </div>
                     )}

                     {/* Content */}
                     <div className="mb-3">
                       <div className="flex items-center gap-2 mb-2">
                         <h3 className="font-bold text-stone-800 text-sm">{review.locationName}</h3>
                         <div className={`text-[10px] px-1.5 py-0.5 rounded text-white font-medium 
                            ${review.type === 'hotel' ? 'bg-indigo-500' : review.type === 'food' ? 'bg-orange-500' : 'bg-emerald-500'}`}>
                           {review.type === 'hotel' ? '住宿' : review.type === 'food' ? '美食' : '景点'}
                         </div>
                       </div>
                       <p className="text-stone-600 text-xs leading-relaxed text-justify">
                         {review.content}
                       </p>
                     </div>

                     {/* Tags */}
                     <div className="flex flex-wrap gap-1.5 mb-4">
                       {review.tags.map(tag => (
                         <span key={tag} className="text-[10px] bg-stone-50 text-stone-500 px-2 py-0.5 rounded-full">#{tag}</span>
                       ))}
                     </div>

                     {/* Footer Stats */}
                     <div className="pt-3 border-t border-stone-50 flex items-center justify-between text-stone-400 text-xs">
                        <div className="flex items-center gap-1 text-amber-500 font-bold bg-amber-50 px-2 py-0.5 rounded-full">
                           <Star size={10} fill="currentColor" /> {review.rating}
                        </div>
                        <div className="flex items-center gap-4">
                          <button className="flex items-center gap-1 hover:text-pink-500 transition-colors group/like">
                             <Heart size={14} className="group-hover/like:fill-pink-500" /> {review.likes}
                          </button>
                          <button className="flex items-center gap-1 hover:text-brand-500 transition-colors">
                             <MessageSquare size={14} /> 评论
                          </button>
                        </div>
                     </div>
                   </div>
                 ))}
               </div>
               
               <div className="text-center py-8">
                 <button className="text-stone-400 text-xs hover:text-stone-600 flex items-center justify-center gap-2 mx-auto">
                    加载更多 <ChevronRight size={12} />
                 </button>
               </div>
             </div>
           </div>
        )}
      </div>

      {/* Expense Modal (Existing) */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={() => setShowExpenseModal(false)} />
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden relative z-10 flex flex-col animate-fade-in-up">
            <div className="flex items-center justify-between p-6 border-b border-stone-100 bg-stone-50/50">
              <div className="flex items-center gap-3">
                 <div className="p-2.5 bg-brand-100 text-brand-700 rounded-xl">
                    <Wallet size={20} />
                 </div>
                 <div>
                    <h2 className="text-xl font-bold text-stone-800">财务明细</h2>
                    <p className="text-xs text-stone-500">基于行程单的自动记账</p>
                 </div>
              </div>
              <button onClick={() => setShowExpenseModal(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-500">
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col md:flex-row h-full overflow-hidden">
                <div className="w-full md:w-1/3 bg-stone-50/50 p-6 flex flex-col items-center border-r border-stone-100 overflow-y-auto">
                    <div className="relative w-64 h-64 my-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                            >
                                {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <RechartsTooltip formatter={(val: number) => `¥${val.toLocaleString()}`} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-stone-400 text-xs font-medium">总预算</span>
                            <span className="text-3xl font-serif font-bold text-stone-800">¥{totalBudget.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="w-full space-y-3 mt-4">
                        {chartData.map((item, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm border border-stone-100">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                                    <span className="text-sm font-medium text-stone-600">{item.name}</span>
                                </div>
                                <span className="font-bold text-stone-800">¥{item.value.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="w-full md:w-2/3 p-6 overflow-y-auto custom-scrollbar bg-white">
                   <div className="space-y-6">
                      {expenseBreakdown.hotel > 0 && (
                          <div>
                              <h3 className="flex items-center gap-2 text-sm font-bold text-stone-400 uppercase tracking-wider mb-3">
                                <Bed size={14} className="text-indigo-500" /> 住宿支出
                              </h3>
                              <div className="space-y-2">
                                  {expenseBreakdown.items.filter(i => i.type === 'hotel').map((item, i) => (
                                      <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0">
                                          <div className="flex flex-col">
                                              <span className="font-medium text-stone-800">{item.name}</span>
                                              <span className="text-xs text-stone-400">{item.day}</span>
                                          </div>
                                          <span className="font-mono font-bold text-indigo-600">¥{item.cost}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                      {expenseBreakdown.food > 0 && (
                          <div>
                              <h3 className="flex items-center gap-2 text-sm font-bold text-stone-400 uppercase tracking-wider mb-3">
                                <Utensils size={14} className="text-orange-500" /> 餐饮支出
                              </h3>
                              <div className="space-y-2">
                                  {expenseBreakdown.items.filter(i => i.type === 'food').map((item, i) => (
                                      <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0">
                                          <div className="flex flex-col">
                                              <span className="font-medium text-stone-800">{item.name}</span>
                                              <span className="text-xs text-stone-400">{item.day}</span>
                                          </div>
                                          <span className="font-mono font-bold text-orange-600">¥{item.cost}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                       {expenseBreakdown.transport > 0 && (
                          <div>
                              <h3 className="flex items-center gap-2 text-sm font-bold text-stone-400 uppercase tracking-wider mb-3">
                                <Navigation size={14} className="text-cyan-500" /> 交通支出
                              </h3>
                              <div className="space-y-2">
                                  {expenseBreakdown.items.filter(i => i.type === 'transport').map((item, i) => (
                                      <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0">
                                          <div className="flex flex-col">
                                              <span className="font-medium text-stone-800">{item.name}</span>
                                              <span className="text-xs text-stone-400">{item.day}</span>
                                          </div>
                                          <span className="font-mono font-bold text-cyan-600">¥{item.cost}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                      {expenseBreakdown.spot > 0 && (
                          <div>
                              <h3 className="flex items-center gap-2 text-sm font-bold text-stone-400 uppercase tracking-wider mb-3">
                                <Camera size={14} className="text-emerald-500" /> 景点与玩乐
                              </h3>
                              <div className="space-y-2">
                                  {expenseBreakdown.items.filter(i => i.type === 'spot' || !['food', 'hotel', 'transport'].includes(i.type)).map((item, i) => (
                                      <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0">
                                          <div className="flex flex-col">
                                              <span className="font-medium text-stone-800">{item.name}</span>
                                              <span className="text-xs text-stone-400">{item.day}</span>
                                          </div>
                                          <span className="font-mono font-bold text-emerald-600">¥{item.cost}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                      {expenseBreakdown.reserve > 0 && (
                        <div className="mt-8 bg-stone-50 p-4 rounded-xl border border-dashed border-stone-300">
                           <div className="flex items-start gap-3">
                              <Coins className="text-stone-400 mt-1" size={20} />
                              <div>
                                <h4 className="text-stone-800 font-bold text-sm">预留资金 / 未列明项</h4>
                                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                                  当前已识别的行程费用总计 <span className="font-bold text-stone-800">¥{expenseBreakdown.trackedTotal}</span>。
                                  剩余的 <span className="font-bold text-stone-800">¥{expenseBreakdown.reserve}</span> 建议作为购物、应急或未标注价格项目的备用金。
                                </p>
                              </div>
                           </div>
                        </div>
                      )}
                   </div>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultView;