import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { RouteCoordinate, LocationType } from '../types';
import { Maximize2, X, Star, AlertTriangle, Clock, MapPin, PenTool } from 'lucide-react';

// Define SVGs for markers
const SVGs = {
  hotel: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`,
  food: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
  spot: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/></svg>`
};

const getCustomIcon = (type: LocationType = 'spot') => {
  let bgColor = 'bg-brand-600'; 
  let svg = SVGs.spot;

  if (type === 'hotel') {
    bgColor = 'bg-indigo-500';
    svg = SVGs.hotel;
  } else if (type === 'food') {
    bgColor = 'bg-orange-500'; 
    svg = SVGs.food;
  } else if (type === 'spot') {
    bgColor = 'bg-emerald-500'; 
    svg = SVGs.spot;
  }

  return L.divIcon({
    className: 'custom-marker-icon', 
    html: `<div class="${bgColor} w-8 h-8 rounded-full flex items-center justify-center text-white shadow-lg border-2 border-white transform transition-transform hover:scale-110">${svg}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 30], 
    popupAnchor: [0, -32]
  });
};

interface InteractiveMapProps {
  coordinates: RouteCoordinate[];
  className?: string;
  onMaximize?: () => void;
  isFullMode?: boolean;
  onAddReview?: (location: RouteCoordinate) => void;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({ coordinates, className = "", onMaximize, isFullMode = false, onAddReview }) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [shouldLoadMap, setShouldLoadMap] = useState(false); // Controls lazy loading of the map engine
  const [mapError, setMapError] = useState(false); // Tracks tile loading errors
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const isExpanded = isFullMode || internalExpanded;

  const handleToggle = () => {
    if (onMaximize) {
      onMaximize();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  // 1. Lazy Initialization: IntersectionObserver
  useEffect(() => {
    if (shouldLoadMap || !mapContainerRef.current) return;

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setShouldLoadMap(true);
        if (observerRef.current) observerRef.current.disconnect();
      }
    }, { threshold: 0.01 }); // Trigger as soon as 1% is visible

    observerRef.current.observe(mapContainerRef.current);

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [shouldLoadMap]);

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!shouldLoadMap || !mapContainerRef.current || mapInstanceRef.current) return;

    // Define layers
    const cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    });

    const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 18
    });

    // Error handling for tiles
    cartoLight.on('tileerror', () => setMapError(true));
    esriSatellite.on('tileerror', () => setMapError(true));

    // Create Map Instance
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      layers: [cartoLight], // Only load basic tiles initially
      touchZoom: true,      
      scrollWheelZoom: true,
      dragging: true
    });
    
    // Add Controls
    // Standard Layer Control at topright
    L.control.layers({ "简约 (Light)": cartoLight, "卫星 (Satellite)": esriSatellite }, undefined, { position: 'topright' }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Create Marker Layer Group
    const markerLayer = L.layerGroup().addTo(map);
    
    markerLayerRef.current = markerLayer;
    mapInstanceRef.current = map;

    // Cleanup
    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerLayerRef.current = null;
    };
  }, [shouldLoadMap]);

  // 3. Handle Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markerLayer = markerLayerRef.current;
    
    if (!map || !markerLayer) return;

    // Filter and normalize coordinates
    const validCoords = coordinates
        .map(c => ({
            ...c,
            // Ensure lat/lng are numbers, handling string numbers if necessary
            lat: typeof c.lat === 'string' ? parseFloat(c.lat) : c.lat,
            lng: typeof c.lng === 'string' ? parseFloat(c.lng) : c.lng
        }))
        .filter(c => 
            c.lat !== undefined && !isNaN(c.lat as number) && 
            c.lng !== undefined && !isNaN(c.lng as number) &&
            c.lat !== 0 && c.lng !== 0 
        );

    // --- MARKER RENDERING LOGIC ---
    const renderVisibleMarkers = () => {
       if (!map || !markerLayer) return;
       
       const bounds = map.getBounds().pad(0.5); 
       markerLayer.clearLayers();

       validCoords.forEach((coord) => {
          // @ts-ignore
          const latLng = L.latLng(coord.lat, coord.lng);
          
          if (bounds.contains(latLng)) {
             // Create Popup Content
             const type = coord.type || 'spot';
             const icon = getCustomIcon(type);
             const typeLabel = type === 'hotel' ? '住宿' : type === 'food' ? '美食' : '景点';
             const typeColor = type === 'hotel' ? 'bg-indigo-500' : type === 'food' ? 'bg-orange-500' : 'bg-emerald-500';
             
             const openingHoursHtml = coord.opening_hours 
               ? `<div class="flex items-start gap-2 text-xs text-stone-600 mt-1.5"><span class="shrink-0 pt-0.5 opacity-60">🕒</span> <span class="leading-tight">${coord.opening_hours}</span></div>` 
               : '';
             
             const contactHtml = coord.contact
               ? `<div class="flex items-start gap-2 text-xs text-stone-600 mt-1"><span class="shrink-0 pt-0.5 opacity-60">📞</span> <span class="leading-tight select-all">${coord.contact}</span></div>`
               : '';
             
             const cleanCost = coord.cost ? coord.cost.replace(/[¥￥]/g, '') : '';
             const costHtml = cleanCost
               ? `<div class="flex items-start gap-2 text-xs text-stone-600 mt-0.5"><span class="shrink-0 pt-0.5 opacity-60">💰</span> <span class="leading-tight">¥${cleanCost}</span></div>`
               : (coord.cost && coord.cost.includes('免费') 
                   ? `<div class="flex items-start gap-2 text-xs text-stone-600 mt-0.5"><span class="shrink-0 pt-0.5 opacity-60">💰</span> <span class="leading-tight">免费</span></div>` 
                   : '');
             
             const ratingHtml = coord.rating
               ? `<div class="flex items-center gap-1.5 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 self-start mt-1 mb-2 w-fit">
                    <span class="text-amber-500 text-sm">★</span> 
                    <span class="text-xs font-bold text-amber-700 pt-0.5">${coord.rating}</span>
                  </div>`
               : '';
       
             const reviewHtml = coord.review
               ? `<div class="mt-3 relative bg-stone-50 p-2.5 rounded-lg border border-stone-100 group-hover:border-stone-200 transition-colors">
                    <div class="absolute -top-2 left-3 text-stone-300 bg-white px-1 text-lg leading-none">“</div>
                    <p class="text-[11px] text-stone-600 italic leading-relaxed m-0">${coord.review}</p>
                  </div>`
               : '';

             L.marker(latLng, { icon })
               .addTo(markerLayer)
               .bindPopup(`
                 <div class="font-sans min-w-[220px] max-w-[260px] pb-1">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white ${typeColor}">
                        ${typeLabel}
                      </span>
                      ${coord.time ? `<span class="text-[10px] font-bold text-stone-500 border border-stone-200 px-1.5 py-0.5 rounded ml-auto flex items-center gap-1"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${coord.time}</span>` : ''}
                    </div>
                   <strong class="block text-brand-900 text-base leading-tight">${coord.name}</strong>
                   ${ratingHtml}
                   <div class="text-xs text-stone-500 leading-snug mt-1 text-justify">${coord.desc}</div>
                   <div class="my-2 border-t border-dashed border-stone-200"></div>
                   ${openingHoursHtml}
                   ${contactHtml}
                   ${costHtml}
                   ${reviewHtml}
                 </div>
               `);
          }
       });
    };

    // Initial Render
    if (validCoords.length > 0) {
       // @ts-ignore
       const bounds = L.latLngBounds(validCoords.map(c => [c.lat, c.lng]));
       map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
       renderVisibleMarkers();
    }

    // Listeners
    map.on('moveend', renderVisibleMarkers);
    map.on('zoomend', renderVisibleMarkers);

    // Invalidate size on expand/collapse
    setTimeout(() => map.invalidateSize(), 300);

    return () => {
       map.off('moveend', renderVisibleMarkers);
       map.off('zoomend', renderVisibleMarkers);
    };

  }, [coordinates, isExpanded, shouldLoadMap]);

  // Helper to fly to location
  const flyToLocation = (lat?: number | string, lng?: number | string) => {
     if (!mapInstanceRef.current) return;
     const nLat = typeof lat === 'string' ? parseFloat(lat) : lat;
     const nLng = typeof lng === 'string' ? parseFloat(lng) : lng;

     if (nLat && !isNaN(nLat) && nLng && !isNaN(nLng) && nLat !== 0 && nLng !== 0) {
        mapInstanceRef.current.flyTo([nLat, nLng], 15, { duration: 1.5 });
     }
  };

  const containerClass = internalExpanded 
    ? 'fixed inset-0 z-[100] w-screen h-screen bg-stone-100' 
    : `w-full h-full rounded-xl overflow-hidden bg-stone-100 relative group ${className}`;

  return (
    <div className={containerClass}>
      <div ref={mapContainerRef} className="w-full h-full" />
      
      {/* Map Error Overlay */}
      {mapError && (
        <div className="absolute top-4 right-16 z-[1002] animate-fade-in pointer-events-none">
          <div className="bg-red-50/90 backdrop-blur px-3 py-1.5 rounded-lg border border-red-100 text-red-600 text-xs font-medium flex items-center gap-1.5 shadow-sm">
             <AlertTriangle size={14} />
             <span>地图加载受限</span>
          </div>
        </div>
      )}

      {!isFullMode && (
        <button 
          onClick={handleToggle}
          className={`absolute z-[1001] bg-white p-2 shadow-md border border-stone-200 text-stone-600 hover:text-brand-600 hover:bg-stone-50 transition-colors
            ${internalExpanded 
              ? 'top-6 left-6 w-12 h-12 rounded-full hover:text-red-500 hover:bg-red-50 hover:border-red-100 shadow-xl flex items-center justify-center' 
              : 'top-4 left-4 rounded-lg bg-white/90 backdrop-blur'
            }`}
          title={internalExpanded ? "关闭全屏" : "全屏查看"}
          aria-label={internalExpanded ? "关闭全屏" : "全屏查看"}
        >
          {internalExpanded ? <X size={24} /> : <Maximize2 size={20} />}
        </button>
      )}

      {/* Sidebar Overview (Visible in Expanded or Full Mode) */}
      {(internalExpanded || isFullMode) && (
        <div className="absolute top-0 left-0 bottom-0 z-[1000] w-80 bg-white/95 backdrop-blur-md shadow-xl border-r border-stone-100 animate-fade-in flex flex-col">
           <div className="flex-none p-5 border-b border-stone-100 bg-white/50">
             <h3 className="font-bold text-stone-800 flex items-center gap-2 text-lg">
               行程概览
             </h3>
           </div>
           
           <div className="flex-grow overflow-y-auto custom-scrollbar p-5 space-y-8">
             {Array.from(new Set(coordinates.map(c => c.day || '未定日期'))).map((day, dayIndex) => {
                const dayItems = coordinates
                  .filter(c => (c.day || '未定日期') === day)
                  .sort((a, b) => {
                      const timeA = a.time || "00:00";
                      const timeB = b.time || "00:00";
                      return timeA.localeCompare(timeB);
                  });

                if (dayItems.length === 0) return null;

                return (
                  <div key={day} className="relative">
                    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur py-1 mb-4 flex items-center gap-2">
                       <div className="w-1 h-4 bg-stone-800 rounded-full"></div>
                       <h4 className="font-bold text-stone-800 text-sm tracking-wide uppercase">{day}</h4>
                    </div>

                    <div className="border-l-2 border-dashed border-stone-200 ml-2 space-y-6 pb-2">
                      {dayItems.map((c, i) => {
                        const type = c.type || 'spot';
                        let typeColor = 'bg-emerald-500';
                        if (type === 'hotel') typeColor = 'bg-indigo-500';
                        if (type === 'food') typeColor = 'bg-orange-500';
                        
                        // Parse lat/lng to check if they are valid numbers for the sidebar dot indicator
                        const lat = typeof c.lat === 'string' ? parseFloat(c.lat) : c.lat;
                        const lng = typeof c.lng === 'string' ? parseFloat(c.lng) : c.lng;
                        const hasCoords = lat !== undefined && !isNaN(lat) && lng !== undefined && !isNaN(lng) && lat !== 0 && lng !== 0;

                        const dotColor = hasCoords ? typeColor : 'bg-stone-300';
                        const cleanCost = c.cost ? c.cost.replace(/[¥￥]/g, '') : '';

                        return (
                          <div 
                             key={i} 
                             className={`relative pl-6 transition-colors rounded-lg p-2 -ml-2 ${hasCoords ? 'hover:bg-stone-50 cursor-pointer group' : ''}`}
                             onClick={() => hasCoords && flyToLocation(lat, lng)}
                          >
                            <div className={`absolute left-[-5px] top-3.5 w-3 h-3 rounded-full ${dotColor} ring-4 ring-white`}></div>
                            <div className="space-y-1">
                              {/* Time and Title Header */}
                              <div className="flex flex-col items-start gap-1">
                                  {c.time && (
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-100 self-start whitespace-nowrap">
                                      <Clock size={12} className="text-brand-500"/>
                                      <span>{c.time}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between w-full">
                                    <span className={`font-bold text-sm leading-tight mt-0.5 ${hasCoords ? 'text-brand-900 group-hover:text-brand-700' : 'text-stone-700'}`}>
                                      {c.name}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      {hasCoords && <MapPin size={12} className="text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                      {onAddReview && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onAddReview(c);
                                          }}
                                          className="text-stone-400 hover:text-brand-600 transition-colors p-1.5 hover:bg-brand-50 rounded-full"
                                          title="写评价"
                                        >
                                          <PenTool size={14} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                              </div>

                              {/* Meta Info */}
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                 <span className={`text-[10px] px-1.5 py-0.5 rounded text-white ${typeColor} font-medium shrink-0`}>
                                   {type === 'hotel' ? '住' : type === 'food' ? '吃' : '玩'}
                                 </span>
                                 {c.rating && (
                                   <div className="flex items-center gap-0.5 text-[10px] font-bold text-amber-500 shrink-0">
                                     <Star size={10} className="fill-amber-500" /> {c.rating}
                                   </div>
                                 )}
                                 {cleanCost && (
                                   <div className="text-[10px] text-stone-500 font-medium bg-stone-100 px-1.5 py-0.5 rounded shrink-0">
                                     ¥{cleanCost}
                                   </div>
                                 )}
                              </div>

                              {/* Description */}
                              <p className="text-xs text-stone-500 leading-relaxed mt-1.5 border-l-2 border-stone-100 pl-2">
                                {c.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
             })}
           </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveMap;