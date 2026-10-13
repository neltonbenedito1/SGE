import React, { useEffect, useRef, useState } from 'react';
import { Search, MapPin, Maximize2, Minimize2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  }
};

export function SchoolMap({ schools, provinces }: SchoolMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapInstance = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const tileLayerRef = useRef<any>(null);
  
  const [leafletLoaded, setLeafletLoaded] = useState(true);
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

  // 1. Initialize Map Instance
  useEffect(() => {
    if (!mapRef.current) return;

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

    // Initial tile layer
    const layerInfo = MAP_LAYERS[activeLayer];
    tileLayerRef.current = L.tileLayer(layerInfo.url, {
      attribution: layerInfo.attribution,
      subdomains: 'abc',
      maxZoom: 19
    }).addTo(map);

    // Ensure map tiles and dimensions calculate accurately across tabs/renders
    const resizeTimer1 = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    const resizeTimer2 = setTimeout(() => {
      map.invalidateSize();
    }, 400);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapRef.current) {
      ro = new ResizeObserver(() => {
        map.invalidateSize();
      });
      ro.observe(mapRef.current);
    }

    return () => {
      clearTimeout(resizeTimer1);
      clearTimeout(resizeTimer2);
      if (ro) ro.disconnect();
      if (leafletMapInstance.current) {
        leafletMapInstance.current.remove();
        leafletMapInstance.current = null;
      }
    };
  }, []);

  // 2. Tile Layer Switcher
  useEffect(() => {
    if (!leafletMapInstance.current) return;
    const map = leafletMapInstance.current;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    const layerInfo = MAP_LAYERS[activeLayer];
    tileLayerRef.current = L.tileLayer(layerInfo.url, {
      attribution: layerInfo.attribution,
      subdomains: 'abc',
      maxZoom: 19
    }).addTo(map);
  }, [activeLayer]);

  // 3. Render Markers & Zoom to Fit Bounds / Selected School
  useEffect(() => {
    if (!leafletMapInstance.current) return;
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
      className={`relative border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs bg-slate-50 dark:bg-slate-950 ${isFullscreen ? 'p-2 bg-slate-950 w-screen h-screen' : ''}`}
    >
      {/* MAP OVERLAY: Search, Layers and Fullscreen */}
      <div className="absolute top-4 left-4 right-4 z-40 flex flex-wrap gap-2 items-center justify-between pointer-events-none">
        {/* Search Input Box */}
        <div className="relative max-w-xs w-full pointer-events-auto">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-md hover:border-indigo-400 dark:hover:border-indigo-500/60 transition-all duration-200 flex items-center p-2">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 ml-1 shrink-0" />
            <input
              type="text"
              placeholder="Pesquisar escola no mapa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-0 outline-hidden text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 px-2 py-1 font-semibold focus:ring-0"
            />
          </div>

          {/* Search autocomplete results */}
          {filteredSchools.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 z-50">
              {filteredSchools.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectSchool(s)}
                  className="w-full text-left p-3 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 flex items-center gap-3 transition-colors text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer group"
                >
                  <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform shrink-0">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <p className="font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{s.nome}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-400 truncate">{s.endereco}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Controls Overlay */}
        <div className="flex gap-2 items-center pointer-events-auto">
          {/* Map Type Switcher */}
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/80 shadow-md rounded-xl p-1 flex gap-1 items-center">
            {(Object.keys(MAP_LAYERS) as Array<keyof typeof MAP_LAYERS>).map((key) => (
              <button
                key={key}
                onClick={() => handleLayerChange(key)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 cursor-pointer ${
                  activeLayer === key
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {MAP_LAYERS[key].name}
              </button>
            ))}
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200/90 dark:border-slate-700/80 rounded-xl p-2.5 shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0"
            title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> : <Maximize2 className="w-4 h-4 text-slate-600 dark:text-slate-300" />}
          </button>
        </div>
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
