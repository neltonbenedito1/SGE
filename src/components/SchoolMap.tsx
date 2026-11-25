import React, { useEffect, useRef, useState } from 'react';
import { Search, MapPin, Maximize2, Minimize2, Lock, Unlock } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { escapeHtml } from '../lib/sanitize';

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

function detectDesktopPointer(): boolean {
  if (typeof window === 'undefined') return true;
  const finePointer = window.matchMedia?.('(pointer: fine)').matches ?? false;
  const anyFinePointer = window.matchMedia?.('(any-pointer: fine)').matches ?? false;
  const coarseOnly = window.matchMedia?.('(pointer: coarse)').matches && !anyFinePointer;
  if (coarseOnly) return false;
  return finePointer || window.innerWidth >= 1024;
}

export function SchoolMap({ schools, provinces }: SchoolMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapInstance = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const tileLayerRef = useRef<any>(null);

  const isMountedRef = useRef(true);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullscreenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [leafletLoaded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLayer, setActiveLayer] = useState<keyof typeof MAP_LAYERS>('streets');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(detectDesktopPointer);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [showCtrlHint, setShowCtrlHint] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMapAlive = (map: any): map is L.Map => {
    if (!isMountedRef.current || !map) return false;
    if (leafletMapInstance.current !== map) return false;
    const container = map._container as HTMLElement | undefined;
    const mapPane = map._mapPane as (HTMLElement & { _leaflet_pos?: L.Point }) | undefined;
    if (!container || !container.isConnected) return false;
    if (!mapPane || !mapPane.isConnected || !mapPane._leaflet_pos) return false;
    return true;
  };

  const safeInvalidateSize = (map: any) => {
    if (!isMapAlive(map)) return;
    const rect = map.getContainer()?.getBoundingClientRect?.();
    if (!rect || (rect.width === 0 && rect.height === 0)) return;
    try {
      map.invalidateSize({ animate: false });
    } catch {
      // Ignora erros transitórios do Leaflet durante desmontagem ou redimensionamento oculto
    }
  };

  const triggerCtrlHint = () => {
    setShowCtrlHint(true);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setShowCtrlHint(false), 2600);
  };

  // Detect desktop vs touch/mobile dynamically
  useEffect(() => {
    const updateDeviceType = () => {
      setIsDesktop(detectDesktopPointer());
    };
    updateDeviceType();
    window.addEventListener('resize', updateDeviceType);
    const mq = window.matchMedia?.('(pointer: fine)');
    mq?.addEventListener?.('change', updateDeviceType);
    return () => {
      window.removeEventListener('resize', updateDeviceType);
      mq?.removeEventListener?.('change', updateDeviceType);
    };
  }, []);

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

    const baseCoords = PROVINCE_COORDS[school.provincia_id] || PROVINCE_COORDS['maputo_cidade'];

    let hash = 0;
    for (let i = 0; i < school.id.length; i++) {
      hash = school.id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const latJitter = ((hash % 100) / 1000) - 0.05;
    const lngJitter = (((hash >> 3) % 100) / 1000) - 0.05;

    return [baseCoords[0] + latJitter, baseCoords[1] + lngJitter];
  };

  // 1. Initialize Map Instance (Standard interactions enabled on non-desktop; desktop gated by CTRL)
  useEffect(() => {
    isMountedRef.current = true;
    const container = mapRef.current;
    if (!container) return;

    let cancelled = false;

    if (leafletMapInstance.current) {
      try {
        leafletMapInstance.current.stop?.();
        leafletMapInstance.current.remove();
      } catch {
        // noop
      }
      leafletMapInstance.current = null;
    }

    const initialDesktop = detectDesktopPointer();
    const map = L.map(container, {
      center: [-18.6657, 35.5296],
      zoom: 5.5,
      zoomControl: false,
      trackResize: false,
      dragging: !initialDesktop,
      scrollWheelZoom: !initialDesktop,
      doubleClickZoom: !initialDesktop,
      boxZoom: !initialDesktop,
      touchZoom: true,
      keyboard: !initialDesktop
    });

    leafletMapInstance.current = map;

    L.control.zoom({
      position: 'topright'
    }).addTo(map);

    const layerInfo = MAP_LAYERS[activeLayer];
    tileLayerRef.current = L.tileLayer(layerInfo.url, {
      attribution: layerInfo.attribution,
      subdomains: 'abc',
      maxZoom: 19
    }).addTo(map);

    const handleSafeResize = () => {
      if (cancelled) return;
      safeInvalidateSize(map);
    };

    const resizeTimer1 = setTimeout(handleSafeResize, 100);
    const resizeTimer2 = setTimeout(handleSafeResize, 450);

    window.addEventListener('resize', handleSafeResize);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(handleSafeResize);
      ro.observe(container);
    }

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      clearTimeout(resizeTimer1);
      clearTimeout(resizeTimer2);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
      if (fullscreenTimerRef.current) clearTimeout(fullscreenTimerRef.current);
      window.removeEventListener('resize', handleSafeResize);
      if (ro) ro.disconnect();
      Object.values(markersRef.current).forEach((m: any) => {
        try {
          m?.remove?.();
        } catch {
          // noop
        }
      });
      markersRef.current = {};
      if (tileLayerRef.current) {
        try {
          tileLayerRef.current.remove?.();
        } catch {
          // noop
        }
        tileLayerRef.current = null;
      }
      if (leafletMapInstance.current) {
        try {
          leafletMapInstance.current.stop?.();
          leafletMapInstance.current.remove();
        } catch {
          // noop
        }
        leafletMapInstance.current = null;
      }
    };
  }, []);

  // Track CTRL key state (only relevant on desktop)
  useEffect(() => {
    if (!isDesktop) {
      setIsCtrlPressed(false);
      setShowCtrlHint(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.ctrlKey) {
        setIsCtrlPressed(true);
        setShowCtrlHint(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || !e.ctrlKey) {
        setIsCtrlPressed(false);
      }
    };

    const handleWindowBlur = () => {
      setIsCtrlPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isDesktop]);

  // Toggle Leaflet interactions: standard on non-desktop; CTRL-gated on desktop
  useEffect(() => {
    const map = leafletMapInstance.current;
    if (!map) return;

    const allowMouseInteraction = !isDesktop || isCtrlPressed;
    const mouseHandlers = [
      map.dragging,
      map.scrollWheelZoom,
      map.doubleClickZoom,
      map.boxZoom,
      map.keyboard
    ];

    mouseHandlers.forEach((handler) => {
      if (!handler) return;
      if (allowMouseInteraction) {
        handler.enable();
      } else {
        handler.disable();
      }
    });

    if (map.touchZoom) {
      if (!isDesktop || isCtrlPressed) {
        map.touchZoom.enable();
      } else {
        map.touchZoom.disable();
      }
    }
  }, [isDesktop, isCtrlPressed]);

  // 2. Tile Layer Switcher
  useEffect(() => {
    const map = leafletMapInstance.current;
    if (!isMapAlive(map)) return;

    if (tileLayerRef.current) {
      try {
        tileLayerRef.current.remove();
      } catch {
        // noop
      }
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
    const map = leafletMapInstance.current;
    if (!isMapAlive(map)) return;

    let cancelled = false;

    Object.values(markersRef.current).forEach((m: any) => {
      try {
        m?.remove?.();
      } catch {
        // noop
      }
    });
    markersRef.current = {};

    if (schools.length === 0) {
      safeInvalidateSize(map);
      return;
    }

    const coordsList: [number, number][] = [];

    schools.forEach(school => {
      const coords = getSchoolCoordinates(school);
      coordsList.push(coords);
      const prov = provinces.find(p => p.id === school.provincia_id);

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

      const popupContent = document.createElement('div');
      popupContent.className = 'p-3 font-sans max-w-xs space-y-2';
      popupContent.innerHTML = `
        <div class="border-b border-slate-100 pb-2">
          <h4 class="font-bold text-slate-900 text-sm leading-tight">${escapeHtml(school.nome || '')}</h4>
          <p class="text-[10px] text-indigo-600 font-bold mt-1 uppercase tracking-wider flex items-center gap-1">
            ${escapeHtml(prov?.nome || 'Província')}
          </p>
        </div>
        <div class="space-y-1 text-xs text-slate-600">
          <p>Tel: <span class="font-medium text-slate-800">${escapeHtml(school.telefone || '-')}</span></p>
          <p>Email: <span class="font-medium text-slate-800">${escapeHtml(school.email || '-')}</span></p>
          <p class="text-[11px] leading-relaxed text-slate-500">${escapeHtml(school.endereco || '')}</p>
        </div>
        <div class="flex justify-between items-center pt-2 text-[10px] text-slate-400 font-mono">
          <span>Lat: ${coords[0].toFixed(4)}</span>
          <span>Lng: ${coords[1].toFixed(4)}</span>
        </div>
      `;

      const marker = L.marker(coords, { icon: customIcon })
        .addTo(map)
        .bindPopup(popupContent, {
          maxWidth: 260,
          className: 'custom-leaflet-popup'
        });

      markersRef.current[school.id] = marker;
    });

    if (isMapAlive(map)) {
      try {
        if (schools.length > 1) {
          const bounds = L.latLngBounds(coordsList);
          map.fitBounds(bounds, { padding: [50, 50], animate: false });
        } else if (schools.length === 1) {
          map.setView(coordsList[0], 14, { animate: false });
        }
      } catch {
        // Ignora falhas de viewport caso o contêiner ainda não esteja pronto
      }
    }

    const markerResizeTimer = setTimeout(() => {
      if (!cancelled) {
        safeInvalidateSize(map);
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(markerResizeTimer);
    };
  }, [leafletLoaded, schools, provinces]);

  const handleSelectSchool = (school: School) => {
    const map = leafletMapInstance.current;
    if (!isMapAlive(map)) return;
    const coords = getSchoolCoordinates(school);

    try {
      map.flyTo(coords, 14, {
        duration: 1.5
      });
    } catch {
      return;
    }

    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    popupTimerRef.current = setTimeout(() => {
      if (!isMapAlive(map)) return;
      const marker = markersRef.current[school.id];
      if (marker) {
        try {
          marker.openPopup();
        } catch {
          // noop
        }
      }
    }, 1500);

    setSearchQuery('');
  };

  const handleLayerChange = (layer: keyof typeof MAP_LAYERS) => {
    setActiveLayer(layer);
  };

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
      if (fullscreenTimerRef.current) clearTimeout(fullscreenTimerRef.current);
      fullscreenTimerRef.current = setTimeout(() => {
        safeInvalidateSize(leafletMapInstance.current);
      }, 200);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (fullscreenTimerRef.current) clearTimeout(fullscreenTimerRef.current);
    };
  }, []);

  const blockMouseOnDesktop = isDesktop && !isCtrlPressed;

  return (
    <div
      ref={containerRef}
      className={`sge-map-container relative border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs bg-slate-100 dark:bg-slate-900 ${isFullscreen ? 'p-2 bg-slate-950 w-screen h-screen' : ''}`}
    >
      {/* MAP OVERLAY: Search, Layers and Fullscreen */}
      <div className="absolute top-4 left-4 right-4 z-40 flex flex-wrap gap-2 items-center justify-between pointer-events-none">
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

        <div className="flex gap-2 items-center pointer-events-auto">
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

          <button
            onClick={toggleFullscreen}
            className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200/90 dark:border-slate-700/80 rounded-xl p-2.5 shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0"
            title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> : <Maximize2 className="w-4 h-4 text-slate-600 dark:text-slate-300" />}
          </button>
        </div>
      </div>

      {!leafletLoaded && (
        <div className="w-full h-[400px] flex flex-col items-center justify-center bg-slate-50/50 text-slate-400 gap-2">
          <div className="w-8 h-8 rounded-full border-4 border-slate-300 border-t-indigo-600 animate-spin"></div>
          <span className="text-xs font-semibold">Carregando mapa interativo...</span>
        </div>
      )}

      {/* Actual Map Target div — fully transparent & crisp so tiles are always 100% visible */}
      <div className="relative w-full">
        <div
          ref={mapRef}
          className={`w-full ${isFullscreen ? 'h-[calc(100vh-20px)]' : 'h-[400px]'} z-10`}
          style={{ minHeight: isFullscreen ? 'calc(100vh - 20px)' : '400px' }}
        />

        {/* Desktop-only transparent mouse blocker when CTRL is NOT pressed */}
        {isDesktop && (
          <div
            onMouseMove={(e) => {
              if (e.ctrlKey && !isCtrlPressed) {
                setIsCtrlPressed(true);
                setShowCtrlHint(false);
              } else if (!e.ctrlKey && isCtrlPressed) {
                setIsCtrlPressed(false);
              }
            }}
            onMouseDown={(e) => {
              if (e.ctrlKey) {
                setIsCtrlPressed(true);
                setShowCtrlHint(false);
                return;
              }
              e.preventDefault();
              e.stopPropagation();
              triggerCtrlHint();
            }}
            onClick={(e) => {
              if (!e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                triggerCtrlHint();
              }
            }}
            onDoubleClick={(e) => {
              if (!e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                triggerCtrlHint();
              }
            }}
            onWheel={(e) => {
              if (e.ctrlKey) {
                setIsCtrlPressed(true);
                setShowCtrlHint(false);
                return;
              }
              triggerCtrlHint();
            }}
            className={`absolute inset-0 z-20 ${
              blockMouseOnDesktop ? 'pointer-events-auto cursor-not-allowed' : 'pointer-events-none'
            }`}
            style={{ backgroundColor: 'transparent', backdropFilter: 'none' }}
            title={blockMouseOnDesktop ? 'Mapa bloqueado no desktop: mantenha CTRL pressionado para interagir com o rato' : 'CTRL pressionado: interação liberada'}
          />
        )}

        {/* Desktop floating feedback banner when user clicks/scrolls without CTRL */}
        {blockMouseOnDesktop && showCtrlHint && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-30 flex justify-center px-4 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900/95 text-white border border-slate-700/80 rounded-xl px-4 py-2.5 shadow-2xl flex items-center gap-2.5 text-xs font-bold">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Mantenha a tecla <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-[11px] font-mono text-amber-300">CTRL</kbd> pressionada para interagir com o mapa no desktop</span>
            </div>
          </div>
        )}

        {/* Desktop bottom-left indicator */}
        {isDesktop && (
          <div className="absolute bottom-3 left-3 z-30 pointer-events-none">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-md border transition-all ${
              isCtrlPressed
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/70'
                : 'bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-700/80'
            }`}>
              {isCtrlPressed ? (
                <>
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>CTRL ativo — Interação liberada</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Segure <kbd className="px-1 py-0.2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-[10px] font-mono">CTRL</kbd> para usar o mapa com o rato</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
