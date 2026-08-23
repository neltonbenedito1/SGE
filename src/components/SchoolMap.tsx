import React, { useEffect, useRef, useState } from 'react';
import { Search, MapPin, Navigation, Maximize2, Minimize2 } from 'lucide-react';

interface School {
  id: string;
  nome: string;
  provincia_id: string;
  endereco: string;
  telefone: string;
  email: string;
  diretor_id: string;
  ativo: boolean;
  latitude?: string | number;
  longitude?: string | number;
}

interface Province {
  id: string;
  nome: string;
}

interface SchoolMapProps {
  schools: School[];
  provinces: Province[];
}

// Coordinate fallbacks for Mozambique provinces
const PROVINCE_COORDS: Record<string, [number, number]> = {
  'maputo_cidade': [-25.9692, 32.5732],
  'maputo': [-25.6022, 32.3496],
  'gaza': [-23.5132, 32.6517],
  'inhambane': [-22.8643, 34.4140],
  'sofala': [-19.8316, 34.3400],
  'manica': [-19.1164, 33.4735],
  'tete': [-16.1564, 33.5867],
  'zambezia': [-16.2941, 37.1126],
  'nampula': [-15.1163, 39.2633],
  'cabo_delgado': [-12.9627, 40.5053],
  'niassa': [-12.7826, 36.6019]
};

const MAP_LAYERS = {
  streets: {
    name: 'Padrão',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  satellite: {
    name: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  },
  terrain: {
    name: 'Terreno',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Style &copy; OpenTopoMap'
  },
  dark: {
    name: 'Escuro',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }
};

export function SchoolMap({ schools, provinces }: SchoolMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapInstance = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const tileLayerRef = useRef<any>(null);
  
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLayer, setActiveLayer] = useState<keyof typeof MAP_LAYERS>('streets');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Filter schools for search auto-complete
  const filteredSchools = searchQuery.trim() === ''
    ? []
    : schools.filter(s => s.nome.toLowerCase().includes(searchQuery.toLowerCase()));

  // Get geographic coordinates for a school, defaulting with deterministic jitter based on its ID if not set
  const getSchoolCoordinates = (school: School): [number, number] => {
    if (school.latitude && school.longitude) {
      const lat = parseFloat(school.latitude.toString());
      const lng = parseFloat(school.longitude.toString());
      if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
    }

    // Determine coordinate base from province ID
    const baseCoords = PROVINCE_COORDS[school.provincia_id] || PROVINCE_COORDS['maputo_cidade'];
    
    // Add stable pseudo-random jitter based on the school's ID to prevent overlap
    let hash = 0;
    for (let i = 0; i < school.id.length; i++) {
      hash = school.id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const latJitter = ((hash % 100) / 1000) - 0.05; // -0.05 to +0.05
    const lngJitter = (((hash >> 3) % 100) / 1000) - 0.05;

    return [baseCoords[0] + latJitter, baseCoords[1] + lngJitter];
  };

  // 1. Dynamic Leaflet CDN Loader
  useEffect(() => {
    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.onload = () => {
      setLeafletLoaded(true);
    };
    document.body.appendChild(script);
  }, []);

  // 2. Initialize Map Instance
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Destroy existing instance if any
    if (leafletMapInstance.current) {
      leafletMapInstance.current.remove();
      leafletMapInstance.current = null;
    }

    // Centered in Mozambique
    const map = L.map(mapRef.current, {
      center: [-18.6657, 35.5296],
      zoom: 5.5,
      zoomControl: false // Add it manually at the top right
    });

    leafletMapInstance.current = map;

    // Add Zoom Control at custom position
    L.control.zoom({
      position: 'topright'
    }).addTo(map);

    return () => {
      if (leafletMapInstance.current) {
        leafletMapInstance.current.remove();
        leafletMapInstance.current = null;
      }
    };
  }, [leafletLoaded]);

  // 3. Tile Layer Switcher
  useEffect(() => {
    if (!leafletLoaded || !leafletMapInstance.current) return;
    const L = (window as any).L;
    const map = leafletMapInstance.current;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    const layerInfo = MAP_LAYERS[activeLayer];
    tileLayerRef.current = L.tileLayer(layerInfo.url, {
      attribution: layerInfo.attribution,
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);
  }, [leafletLoaded, activeLayer]);

  // 4. Render Markers & Zoom to Fit Bounds / Selected School
  useEffect(() => {
    if (!leafletLoaded || !leafletMapInstance.current) return;

    const L = (window as any).L;
    const map = leafletMapInstance.current;

    // Clear old markers
    Object.values(markersRef.current).forEach((m: any) => m.remove());
    markersRef.current = {};

    if (schools.length === 0) return;

    const coordsList: [number, number][] = [];

    schools.forEach(school => {
      const coords = getSchoolCoordinates(school);
      coordsList.push(coords);
      const prov = provinces.find(p => p.id === school.provincia_id);

      // Create highly styled custom HTML marker using Leaflet divIcon
      const customIcon = L.divIcon({
        className: 'custom-map-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 bg-indigo-600/30 rounded-full animate-ping"></div>
            <div class="relative w-6 h-6 bg-indigo-600 border border-white text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m22 10-6-6M2 10l6-6M4 22V10h16v12M2 10h20M12 14v4M12 14v4"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      // HTML Content for the popup
      const popupContent = document.createElement('div');
      popupContent.className = 'p-3 font-sans max-w-xs space-y-2';
      popupContent.innerHTML = `
        <div class="border-b border-slate-100 pb-2">
          <h4 class="font-bold text-slate-900 text-sm leading-tight">${school.nome}</h4>
          <p class="text-[10px] text-indigo-600 font-bold mt-1 uppercase tracking-wider flex items-center gap-1">
            📍 ${prov?.nome || 'Província'}
          </p>
        </div>
        <div class="space-y-1 text-xs text-slate-600">
          <p>📞 <span class="font-medium text-slate-800">${school.telefone}</span></p>
          <p>✉️ <span class="font-medium text-slate-800">${school.email}</span></p>
          <p class="text-[11px] leading-relaxed text-slate-500">${school.endereco}</p>
        </div>
        <div class="flex justify-between items-center pt-2 text-[10px] text-slate-400 font-mono">
          <span>Lat: ${coords[0].toFixed(4)}</span>
          <span>Lng: ${coords[1].toFixed(4)}</span>
        </div>
      `;

      // Create marker and bind popup
      const marker = L.marker(coords, { icon: customIcon })
        .addTo(map)
        .bindPopup(popupContent, {
          maxWidth: 260,
          className: 'custom-leaflet-popup'
        });

      markersRef.current[school.id] = marker;
    });

    // Zoom Handling
    if (schools.length > 1) {
      const bounds = L.latLngBounds(coordsList);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (schools.length === 1) {
      map.setView(coordsList[0], 14);
    }
  }, [leafletLoaded, schools, provinces]);

  // Handle flying/panning to school from search
  const handleSelectSchool = (school: School) => {
    if (!leafletMapInstance.current) return;
    const coords = getSchoolCoordinates(school);
    
    // Pan and Zoom map
    leafletMapInstance.current.flyTo(coords, 14, {
      duration: 1.5
    });

    // Open school popup with delay to let flight finish
    setTimeout(() => {
      const marker = markersRef.current[school.id];
      if (marker) {
        marker.openPopup();
      }
    }, 1500);

    setSearchQuery('');
  };

  const handleLayerChange = (layer: keyof typeof MAP_LAYERS) => {
    setActiveLayer(layer);
  };

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.()
        .then(() => setIsFullscreen(true))
        .catch(err => console.error(err));
    } else {
      document.exitFullscreen?.()
        .then(() => setIsFullscreen(false))
        .catch(err => console.error(err));
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Trigger map resize so leaflet redraws itself properly
      setTimeout(() => {
        if (leafletMapInstance.current) {
          leafletMapInstance.current.invalidateSize();
        }
      }, 200);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={`relative border border-slate-150 rounded-2xl overflow-hidden shadow-xs bg-slate-50 ${isFullscreen ? 'p-2 bg-slate-900 w-screen h-screen' : ''}`}
    >
      {/* MAP OVERLAY: Search, Layers and Fullscreen */}
      <div className="absolute top-4 left-4 right-4 z-40 flex flex-wrap gap-2 items-center justify-between pointer-events-none">
        {/* Search Input Box */}
        <div className="relative max-w-xs w-full pointer-events-auto">
          <div className="bg-white/90 backdrop-blur-md rounded-xl border border-slate-200/80 shadow-md flex items-center p-2">
            <Search className="w-4 h-4 text-slate-400 ml-1 shrink-0" />
            <input
              type="text"
              placeholder="Pesquisar escola no mapa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-0 outline-hidden text-xs text-slate-800 placeholder-slate-400 px-2 py-1 font-semibold focus:ring-0"
            />
          </div>

          {/* Search autocomplete results */}
          {filteredSchools.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-100 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-50 z-50">
              {filteredSchools.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectSchool(s)}
                  className="w-full text-left p-3 hover:bg-slate-50 flex items-center gap-3 transition-colors text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <div className="truncate">
                    <p className="font-bold text-slate-900 truncate">{s.nome}</p>
                    <p className="text-[10px] text-slate-400 truncate">{s.endereco}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Controls Overlay */}
        <div className="flex gap-2 items-center pointer-events-auto">
          {/* Map Type Switcher */}
          <div className="bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-md rounded-xl p-1 flex gap-1 items-center">
            {(Object.keys(MAP_LAYERS) as Array<keyof typeof MAP_LAYERS>).map((key) => (
              <button
                key={key}
                onClick={() => handleLayerChange(key)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  activeLayer === key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {MAP_LAYERS[key].name}
              </button>
            ))}
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="bg-white/90 backdrop-blur-md hover:bg-slate-50 text-slate-700 border border-slate-200/80 rounded-xl p-2.5 shadow-md transition-all cursor-pointer flex items-center justify-center shrink-0"
            title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-indigo-600" /> : <Maximize2 className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </div>

      {/* Map Guidelines Overlay */}
      <div className="absolute bottom-4 right-4 z-40 bg-white/80 backdrop-blur-md text-slate-500 rounded-lg p-2.5 border border-slate-200/50 shadow-xs text-[10px] font-semibold space-y-1 max-w-xs pointer-events-none">
        <div className="flex items-center gap-1.5 text-slate-700 font-bold mb-1">
          <Navigation className="w-3.5 h-3.5 text-indigo-600" />
          <span>Navegação no Mapa</span>
        </div>
        <p>• Arraste o cursor para navegar pelo território</p>
        <p>• Use a roda do mouse ou toque para dar zoom</p>
        <p>• Clique em qualquer pino para abrir detalhes</p>
      </div>

      {/* Loading Canvas Placeholder */}
      {!leafletLoaded && (
        <div className="w-full h-[400px] flex flex-col items-center justify-center bg-slate-50/50 text-slate-400 gap-2">
          <div className="w-8 h-8 rounded-full border-4 border-slate-300 border-t-indigo-600 animate-spin"></div>
          <span className="text-xs font-semibold">Carregando mapa interativo...</span>
        </div>
      )}

      {/* Actual Map Target div */}
      <div 
        ref={mapRef} 
        className={`w-full ${isFullscreen ? 'h-[calc(100vh-20px)]' : 'h-[400px]'} rounded-2xl overflow-hidden z-10 transition-all`} 
      />
    </div>
  );
}
