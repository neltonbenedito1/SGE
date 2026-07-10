import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Moon, 
  Sun, 
  Loader2, 
  BookOpen, 
  LayoutList,
  Maximize2,
  Minimize2,
  X,
  RefreshCw,
  FileText
} from 'lucide-react';

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

interface InternalPdfViewerProps {
  pdfUrl: string;
  bookTitle: string;
  editionNumber: number;
  initialPage: number;
  onPageChange: (pageNum: number, totalPages: number) => void;
  onClose: () => void;
}

interface PdfPageProps {
  pdfDocument: any;
  pageNumber: number;
  zoom: number;
  isDarkMode: boolean;
  onVisible: (pageNumber: number) => void;
}

// Subcomponent to render a single page for Continuous Scroll
const PdfPage: React.FC<PdfPageProps> = ({ pdfDocument, pageNumber, zoom, isDarkMode, onVisible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    const renderPage = async () => {
      try {
        if (!pdfDocument || !canvasRef.current) return;
        const page = await pdfDocument.getPage(pageNumber);
        if (!isMounted) return;

        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        // Adjust dimensions
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        // Cancel previous rendering task if it's still running
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {
            // Ignored
          }
        }

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
      } catch (error: any) {
        if (error?.name !== 'RenderingCancelledException') {
          console.error(`Error rendering page ${pageNumber}:`, error);
        }
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {}
      }
    };
  }, [pdfDocument, pageNumber, zoom]);

  // Observer to check which page is in view
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onVisible(pageNumber);
          }
        });
      },
      {
        root: null, // viewport of the list container
        rootMargin: '-35% 0px -35% 0px', // trigger middle of viewport
        threshold: 0.1,
      }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  return (
    <div 
      ref={containerRef} 
      className={`flex flex-col items-center my-6 p-4 rounded-xl shadow-xl transition-all border ${
        isDarkMode 
          ? 'bg-slate-900 border-slate-800' 
          : 'bg-slate-50 border-slate-250'
      }`}
    >
      <div className={`mb-2 font-mono text-xs font-semibold px-2.5 py-1 rounded-full ${
        isDarkMode ? 'bg-slate-850 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'
      }`}>
        Página {pageNumber}
      </div>
      <div className="overflow-auto max-w-full">
        <canvas
          ref={canvasRef}
          style={{
            filter: isDarkMode ? 'invert(0.9) hue-rotate(180deg)' : 'none',
            maxWidth: '100%',
            height: 'auto',
          }}
          className="rounded shadow bg-white transition-all duration-300"
        />
      </div>
    </div>
  );
};

export const InternalPdfViewer: React.FC<InternalPdfViewerProps> = ({
  pdfUrl,
  bookTitle,
  editionNumber,
  initialPage = 1,
  onPageChange,
  onClose
}) => {
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [zoom, setZoom] = useState<number>(1.2);
  const [scrollMode, setScrollMode] = useState<'paginas' | 'continuo'>('paginas');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);

  // Dynamic injection of PDF.js
  useEffect(() => {
    let active = true;
    const loadPdfjs = () => {
      if (window.pdfjsLib) {
        if (active) setPdfjsLoaded(true);
        return;
      }

      // Append Script for PDF.js
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = () => {
        if (!active) return;
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        setPdfjsLoaded(true);
      };
      script.onerror = () => {
        if (active) setError('Não foi possível carregar o renderizador de PDF (erro de script).');
      };
      document.body.appendChild(script);
    };

    loadPdfjs();
    return () => {
      active = false;
    };
  }, []);

  // Load PDF document once library is loaded
  useEffect(() => {
    if (!pdfjsLoaded) return;
    let active = true;

    const loadDocument = async () => {
      setLoading(true);
      setError(null);
      try {
        let loadingTask;

        // Support base64 PDFs nicely
        if (pdfUrl.startsWith('data:application/pdf;base64,') || pdfUrl.startsWith('data:binary/octet-stream;base64,')) {
          const base64Data = pdfUrl.substring(pdfUrl.indexOf(',') + 1);
          const binaryString = atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          loadingTask = window.pdfjsLib.getDocument({ data: bytes });
        } else {
          loadingTask = window.pdfjsLib.getDocument(pdfUrl);
        }

        const pdf = await loadingTask.promise;
        if (!active) return;
        setPdfDocument(pdf);
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (err: any) {
        console.error("Error loading PDF document:", err);
        if (active) {
          setError(`Falha ao ler o PDF: ${err.message || 'Arquivo corrompido ou formato incompatível.'}`);
          setLoading(false);
        }
      }
    };

    loadDocument();
    return () => {
      active = false;
    };
  }, [pdfUrl, pdfjsLoaded]);

  // Page-by-page render logic
  const renderSinglePage = useCallback(async (pageNo: number) => {
    if (!pdfDocument || !mainCanvasRef.current || scrollMode !== 'paginas') return;

    try {
      const page = await pdfDocument.getPage(pageNo);
      const viewport = page.getViewport({ scale: zoom });
      const canvas = mainCanvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {}
      }

      const task = page.render(renderContext);
      renderTaskRef.current = task;
      await task.promise;
    } catch (error: any) {
      if (error?.name !== 'RenderingCancelledException') {
        console.error("Error rendering single page:", error);
      }
    }
  }, [pdfDocument, zoom, scrollMode]);

  // Trigger single page rendering when current page/zoom/scrollMode changes
  useEffect(() => {
    if (scrollMode === 'paginas') {
      renderSinglePage(currentPage);
    }
  }, [currentPage, zoom, scrollMode, renderSinglePage]);

  // Page turning handlers
  const handlePageTurn = (direction: 'next' | 'prev') => {
    if (!numPages) return;
    let targetPage = currentPage;
    if (direction === 'next' && currentPage < numPages) {
      targetPage = currentPage + 1;
    } else if (direction === 'prev' && currentPage > 1) {
      targetPage = currentPage - 1;
    }

    if (targetPage !== currentPage) {
      setCurrentPage(targetPage);
      onPageChange(targetPage, numPages);
    }
  };

  // Continuous scroll visible page callback
  const handleContinuousPageVisible = useCallback((pageNo: number) => {
    if (scrollMode === 'continuo' && pageNo !== currentPage) {
      setCurrentPage(pageNo);
      onPageChange(pageNo, numPages);
    }
  }, [scrollMode, currentPage, numPages, onPageChange]);

  // Zoom handlers
  const handleZoom = (type: 'in' | 'out') => {
    setZoom((prev) => {
      if (type === 'in') return Math.min(prev + 0.25, 2.5);
      return Math.max(prev - 0.25, 0.5);
    });
  };

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (scrollMode !== 'paginas') return;
      if (e.key === 'ArrowRight') {
        handlePageTurn('next');
      } else if (e.key === 'ArrowLeft') {
        handlePageTurn('prev');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scrollMode, currentPage, numPages]);

  // Full Screen toggle
  const toggleFullScreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
        .then(() => setIsFullScreen(true))
        .catch((err) => console.error("Error attempting full screen:", err));
    } else {
      document.exitFullscreen()
        .then(() => setIsFullScreen(false));
    }
  };

  // Handle exiting full screen using Esc key automatically
  useEffect(() => {
    const onFsChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  return (
    <div 
      ref={containerRef}
      id="internal_interactive_pdf_viewer"
      className={`rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      } ${isFullScreen ? 'h-screen w-screen fixed inset-0 z-50 rounded-none' : 'h-[650px]'}`}
    >
      {/* Upper Control Bar */}
      <div className={`px-4 py-3 border-b flex flex-wrap justify-between items-center shrink-0 gap-3 transition-colors ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-2.5">
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-700'
            }`}
            title="Fechar Visualizador"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="max-w-[200px] sm:max-w-[320px] truncate">
            <h3 className={`text-xs font-bold leading-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {bookTitle}
            </h3>
            <p className={`text-[10px] font-mono font-medium ${isDarkMode ? 'text-indigo-400' : 'text-indigo-650'}`}>
              Edição #{editionNumber}
            </p>
          </div>
        </div>

        {/* View Mode Controls (Paging / Continuous Scroll) */}
        {!loading && !error && (
          <div className="flex items-center gap-1.5">
            <div className={`flex rounded-lg p-0.5 border ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <button
                onClick={() => setScrollMode('paginas')}
                className={`py-1 px-2.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  scrollMode === 'paginas'
                    ? (isDarkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-650 text-white')
                    : (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" /> Pág a Pág
              </button>
              <button
                onClick={() => setScrollMode('continuo')}
                className={`py-1 px-2.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  scrollMode === 'continuo'
                    ? (isDarkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-650 text-white')
                    : (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" /> Contínuo
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Navigation and Zoom Toolbar */}
        {!loading && !error && (
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Paging controls */}
            {scrollMode === 'paginas' && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handlePageTurn('prev')}
                  disabled={currentPage === 1}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isDarkMode 
                      ? 'bg-slate-800 hover:bg-slate-700 disabled:opacity-20 text-white' 
                      : 'bg-slate-100 hover:bg-slate-250 disabled:opacity-35 text-slate-800'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="text-xs font-mono select-none px-1">
                  Pág. <span className={`font-extrabold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-650'}`}>{currentPage}</span> de <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{numPages}</span>
                </div>

                <button
                  onClick={() => handlePageTurn('next')}
                  disabled={currentPage === numPages}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isDarkMode 
                      ? 'bg-slate-800 hover:bg-slate-700 disabled:opacity-20 text-white' 
                      : 'bg-slate-100 hover:bg-slate-250 disabled:opacity-35 text-slate-800'
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {scrollMode === 'continuo' && (
              <div className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold font-mono ${
                isDarkMode ? 'bg-slate-950 text-indigo-400 border border-slate-800' : 'bg-indigo-50 text-indigo-700 border border-indigo-150'
              }`}>
                Pág. <span className="text-xs font-extrabold">{currentPage}</span> / {numPages}
              </div>
            )}

            <div className={`h-4 w-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />

            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleZoom('out')}
                disabled={zoom <= 0.5}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title="Afastar (Zoom -)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold select-none min-w-[36px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => handleZoom('in')}
                disabled={zoom >= 2.5}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title="Aproximar (Zoom +)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            <div className={`h-4 w-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />

            {/* Theme Toggle & Fullscreen */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isDarkMode ? 'hover:bg-slate-800 text-yellow-400' : 'hover:bg-slate-200 text-slate-800'
                }`}
                title={isDarkMode ? 'Modo Claro (Fundo Branco)' : 'Modo Escuro (Eye Protection)'}
              >
                {isDarkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
              </button>

              <button
                onClick={toggleFullScreen}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title={isFullScreen ? 'Sair da Tela Cheia' : 'Visualização em Tela Cheia'}
              >
                {isFullScreen ? <Minimize2 className="w-4.5 h-4.5" /> : <Maximize2 className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Reader Canvas Workspace */}
      <div className={`flex-1 overflow-auto relative p-6 flex flex-col items-center ${
        isDarkMode ? 'bg-slate-900/45' : 'bg-slate-200/50'
      }`}>
        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-inherit">
            <Loader2 className={`w-12 h-12 animate-spin mb-4 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-650'}`} />
            <p className="text-xs font-bold animate-pulse">Carregando livro digital...</p>
            <p className="text-[10px] text-slate-400 mt-1">Isso pode levar alguns segundos dependendo do tamanho do PDF.</p>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto bg-inherit">
            <FileText className="w-16 h-16 text-rose-500 mb-4 animate-bounce" />
            <h4 className="text-sm font-extrabold text-rose-600 mb-1">Ocorreu um erro</h4>
            <p className="text-xs text-slate-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-rose-650 hover:bg-rose-600 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Recarregar App
            </button>
          </div>
        )}

        {/* Workspace views based on scroll mode selection */}
        {!loading && !error && pdfDocument && (
          <div className="w-full max-w-4xl flex justify-center">
            {scrollMode === 'paginas' ? (
              <div className="flex flex-col items-center select-none w-full">
                <div className="relative overflow-auto max-w-full p-2">
                  <canvas
                    ref={mainCanvasRef}
                    style={{
                      filter: isDarkMode ? 'invert(0.9) hue-rotate(180deg)' : 'none',
                      maxWidth: '100%',
                      height: 'auto',
                    }}
                    className="rounded-xl shadow-2xl bg-white border border-slate-700/30 transition-all duration-300"
                  />
                </div>
              </div>
            ) : (
              <div className="w-full">
                {Array.from({ length: numPages }).map((_, i) => (
                  <PdfPage
                    key={i + 1}
                    pdfDocument={pdfDocument}
                    pageNumber={i + 1}
                    zoom={zoom}
                    isDarkMode={isDarkMode}
                    onVisible={handleContinuousPageVisible}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reader Progress Info Footer */}
      {!loading && !error && (
        <div className={`px-4 py-2 border-t flex justify-between items-center text-[10px] font-mono shrink-0 transition-colors ${
          isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}>
          <span>Modo de visualização: {scrollMode === 'paginas' ? 'Viragem de Página' : 'Rolagem Contínua'}</span>
          <span className={`font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-650'}`}>
            Progresso: {Math.round((currentPage / numPages) * 100)}% ({currentPage}/{numPages})
          </span>
        </div>
      )}
    </div>
  );
};
