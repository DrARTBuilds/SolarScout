import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, LayersControl, FeatureGroup, Polygon, Polyline, ZoomControl, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { Zap, Search, Grid } from 'lucide-react';
import ToolsMenu from './ToolsMenu';
import { clientGenerateIndividualPanels, type Panel } from '../utils/solarMath';

// Fix for default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import pinIcon from '../assets/icons/pin-tool.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const RedIcon = L.divIcon({
    className: 'bg-transparent', // Ensure no background class
    html: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(1px 2px 4px rgba(0,0,0,0.3));">
        <path fill="#EA4335" d="M12 0C7.58 0 4 3.58 4 8c0 5.25 7 13 7 13s7-7.75 7-13c0-4.42-3.58-8-8-8z"/>
        <circle cx="12" cy="8" r="3.5" fill="#8B1D10"/>
    </svg>`,
    iconSize: [36, 36], // Google Maps scale
    iconAnchor: [18, 36], // Tip at bottom center
    popupAnchor: [0, -36]
});

interface MapProps {
    lat: number;
    lng: number;
    onLocationSelect?: (lat: number, lng: number) => void;
    enableDrawing?: boolean;
    onRoofMeasured?: (area: number, panelCount: number, capacity: number, polygon: L.LatLng[]) => void;
    detectedPolygon?: L.LatLng[] | null;
    detectedPanels?: Panel[] | null;
    onDetectPanels?: () => void;
    userLocation?: { lat: number; lng: number } | null;
    onUserLocationUpdate?: (lat: number, lng: number) => void;
    orientation?: 'portrait' | 'landscape';
}

interface UserLocationMarkerProps {
    position: { lat: number; lng: number };
    onUpdate: (lat: number, lng: number) => void;
}

function UserLocationMarker({ position, onUpdate }: UserLocationMarkerProps) {
    const markerRef = useRef<L.Marker>(null);

    const eventHandlers = {
        dragend() {
            const marker = markerRef.current;
            if (marker != null) {
                const { lat, lng } = marker.getLatLng();
                onUpdate(lat, lng);
            }
        },
    };

    return (
        <>
            <Marker
                draggable={true}
                eventHandlers={eventHandlers}
                position={[position.lat, position.lng]}
                ref={markerRef}
                icon={L.divIcon({
                    className: 'bg-blue-500 border-2 border-white rounded-full shadow-lg cursor-move',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                })}
            >
            </Marker>
            <Marker
                position={[position.lat, position.lng]}
                icon={L.divIcon({
                    className: '', // Empty class for wrapper to avoid transform conflict
                    html: '<div class="w-full h-full bg-blue-500/30 rounded-full animate-ping pointer-events-none"></div>',
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                })}
            />
        </>
    );
}

function MapController({ lat, lng }: { lat: number; lng: number }) {
    const map = useMap();
    useEffect(() => {
        map.setView([lat, lng], 18); // Force zoom to 18 on location change
    }, [lat, lng, map]);
    return null;
}

// Google Maps Measure-style Drawing Component with Advanced Vector Editing and Tactile Eraser
function MapDrawer({
    activeTool,
    eraserMode,
    eraserSize,
    currentDrawnLayer,
    setCurrentDrawnLayer,
    onDrawComplete,
    onClear,
    onSubtract,
    onVerticesChange
}: {
    activeTool: 'pencil' | 'freehand' | 'eraser' | 'scissors' | 'pin' | null,
    eraserMode: 'full' | 'partial',
    eraserSize: number,
    currentDrawnLayer: L.Polygon | null,
    setCurrentDrawnLayer: (layer: L.Polygon | null) => void,
    onDrawComplete: (latlngs: L.LatLng[]) => void,
    onClear: () => void,
    onSubtract: (latlngs: L.LatLng[]) => void,
    onVerticesChange: (latlngs: L.LatLng[]) => void
}) {
    const [points, setPoints] = useState<L.LatLng[]>([]);
    const pointsRef = useRef<L.LatLng[]>([]); // Use Ref for synchronous access
    const [cursorPos, setCursorPos] = useState<L.LatLng | null>(null);
    const [mouseLatLng, setMouseLatLng] = useState<L.LatLng | null>(null);
    const [isErasing, setIsErasing] = useState(false);
    const [isDrawingFreehand, setIsDrawingFreehand] = useState(false);
    const [eraserRadiusMeters, setEraserRadiusMeters] = useState<number>(5);
    const map = useMap();

    // Sync Ref with State for initial load or external changes
    useEffect(() => {
        if (points.length === 0 && pointsRef.current.length > 0) {
            pointsRef.current = [];
        }
    }, [points]);

    // Disable double click zoom and map dragging when drawing or rubbing eraser
    useEffect(() => {
        if (activeTool === 'pencil' || activeTool === 'freehand' || activeTool === 'scissors' || (activeTool === 'eraser' && eraserMode === 'partial')) {
            map.dragging.disable();
            map.doubleClickZoom.disable();
        } else {
            map.dragging.enable();
            map.doubleClickZoom.enable();
        }
        return () => {
            map.dragging.enable();
            map.doubleClickZoom.enable();
        };
    }, [activeTool, eraserMode, map]);

    const addPoint = (latlng: L.LatLng) => {
        pointsRef.current = [...pointsRef.current, latlng];
        setPoints([...pointsRef.current]);
    };

    const clearPoints = () => {
        pointsRef.current = [];
        setPoints([]);
        onClear();
    };

    const finishDrawing = () => {
        if (pointsRef.current.length >= 3) {
            if (activeTool === 'scissors') {
                onSubtract(pointsRef.current);
            } else {
                onDrawComplete(pointsRef.current);
            }
            pointsRef.current = [];
            setPoints([]);
            setCursorPos(null);
        }
    };

    // Helper to extract vertices of the current outer layer
    const getVertices = (): L.LatLng[] => {
        if (!currentDrawnLayer) return [];
        const latlngs = currentDrawnLayer.getLatLngs();
        if (latlngs.length === 0) return [];
        if (latlngs[0] instanceof L.LatLng) {
            return latlngs as L.LatLng[];
        } else if (Array.isArray(latlngs[0])) {
            return latlngs[0] as L.LatLng[];
        }
        return [];
    };

    const handleVertexDrag = (index: number, newLatLng: L.LatLng) => {
        if (!currentDrawnLayer) return;
        const latlngs = currentDrawnLayer.getLatLngs();
        
        if (latlngs[0] instanceof L.LatLng) {
            const copy = [...(latlngs as L.LatLng[])];
            copy[index] = newLatLng;
            currentDrawnLayer.setLatLngs(copy);
            currentDrawnLayer.redraw();
            onVerticesChange(copy);
        } else if (Array.isArray(latlngs[0])) {
            const outer = [...(latlngs[0] as L.LatLng[])];
            outer[index] = newLatLng;
            const newCoords = [outer, ...latlngs.slice(1)];
            currentDrawnLayer.setLatLngs(newCoords as any);
            currentDrawnLayer.redraw();
            onVerticesChange(outer);
        }
    };

    const handleVertexDelete = (index: number) => {
        if (!currentDrawnLayer) return;
        const latlngs = currentDrawnLayer.getLatLngs();
        
        if (latlngs[0] instanceof L.LatLng) {
            const copy = [...(latlngs as L.LatLng[])];
            copy.splice(index, 1);
            if (copy.length < 3) {
                clearPoints();
            } else {
                currentDrawnLayer.setLatLngs(copy);
                currentDrawnLayer.redraw();
                onVerticesChange(copy);
            }
        } else if (Array.isArray(latlngs[0])) {
            const outer = [...(latlngs[0] as L.LatLng[])];
            outer.splice(index, 1);
            if (outer.length < 3) {
                clearPoints();
            } else {
                const newCoords = [outer, ...latlngs.slice(1)];
                currentDrawnLayer.setLatLngs(newCoords as any);
                currentDrawnLayer.redraw();
                onVerticesChange(outer);
            }
        }
    };

    const checkAndEraseVertices = (latlng: L.LatLng) => {
        if (!currentDrawnLayer) return;
        const cursorPixel = map.latLngToContainerPoint(latlng);
        const vertices = getVertices();
        
        let toEraseIdx: number[] = [];
        
        vertices.forEach((v, idx) => {
            const vertexPixel = map.latLngToContainerPoint(v);
            const dist = cursorPixel.distanceTo(vertexPixel);
            if (dist <= eraserSize) {
                toEraseIdx.push(idx);
            }
        });
        
        if (toEraseIdx.length > 0) {
            toEraseIdx.sort((a, b) => b - a);
            const latlngs = currentDrawnLayer.getLatLngs();
            
            if (latlngs[0] instanceof L.LatLng) {
                const copy = [...(latlngs as L.LatLng[])];
                toEraseIdx.forEach(idx => copy.splice(idx, 1));
                if (copy.length < 3) {
                    clearPoints();
                } else {
                    currentDrawnLayer.setLatLngs(copy);
                    currentDrawnLayer.redraw();
                    onVerticesChange(copy);
                }
            } else if (Array.isArray(latlngs[0])) {
                const outer = [...(latlngs[0] as L.LatLng[])];
                toEraseIdx.forEach(idx => outer.splice(idx, 1));
                if (outer.length < 3) {
                    clearPoints();
                } else {
                    const newCoords = [outer, ...latlngs.slice(1)];
                    currentDrawnLayer.setLatLngs(newCoords as any);
                    currentDrawnLayer.redraw();
                    onVerticesChange(outer);
                }
            }
        }
    };

    const updateEraserRadius = (latlng: L.LatLng) => {
        try {
            const centerPixel = map.latLngToContainerPoint(latlng);
            const edgePixel = centerPixel.add(L.point(eraserSize, 0));
            const edgeLatLng = map.containerPointToLatLng(edgePixel);
            const distance = latlng.distanceTo(edgeLatLng);
            setEraserRadiusMeters(distance);
        } catch (err) {
            // Safe fallback
            setEraserRadiusMeters(eraserSize * 0.15);
        }
    };

    useMapEvents({
        click(e) {
            if (activeTool === 'pencil' || activeTool === 'scissors') {
                // Check if clicking near first point to close
                if (pointsRef.current.length >= 3) {
                    const firstPoint = pointsRef.current[0];
                    const p1 = map.latLngToContainerPoint(e.latlng);
                    const p2 = map.latLngToContainerPoint(firstPoint);
                    const distPixels = p1.distanceTo(p2);

                    if (distPixels < 15) {
                        finishDrawing();
                        return;
                    }
                }
                addPoint(e.latlng);
            } else if (activeTool === 'eraser' && eraserMode === 'full') {
                if (currentDrawnLayer) {
                    const clickPoint = turf.point([e.latlng.lng, e.latlng.lat]);
                    const geoJSON = currentDrawnLayer.toGeoJSON() as any;
                    const isInside = turf.booleanPointInPolygon(clickPoint, geoJSON);
                    if (isInside) {
                        clearPoints();
                    }
                }
            }
        },
        dblclick(e) {
            if (activeTool === 'pencil' || activeTool === 'scissors') {
                L.DomEvent.stopPropagation(e);
                finishDrawing();
            }
        },
        mousedown(e) {
            if (activeTool === 'eraser' && eraserMode === 'partial') {
                setIsErasing(true);
                setMouseLatLng(e.latlng);
                updateEraserRadius(e.latlng);
                checkAndEraseVertices(e.latlng);
            } else if (activeTool === 'freehand') {
                setIsDrawingFreehand(true);
                pointsRef.current = [e.latlng];
                setPoints([e.latlng]);
            }
        },
        mousemove(e) {
            setMouseLatLng(e.latlng);
            if (activeTool === 'pencil' || activeTool === 'scissors') {
                setCursorPos(e.latlng);
            } else if (activeTool === 'freehand' && isDrawingFreehand) {
                const lastPt = pointsRef.current[pointsRef.current.length - 1];
                if (lastPt) {
                    const dist = lastPt.distanceTo(e.latlng);
                    if (dist > 1.5) { // 1.5 meters spacing
                        pointsRef.current = [...pointsRef.current, e.latlng];
                        setPoints([...pointsRef.current]);
                    }
                }
            } else if (activeTool === 'eraser' && eraserMode === 'partial') {
                updateEraserRadius(e.latlng);
                if (isErasing) {
                    checkAndEraseVertices(e.latlng);
                }
            }
        },
        mouseup() {
            setIsErasing(false);
            if (activeTool === 'freehand' && isDrawingFreehand) {
                setIsDrawingFreehand(false);
                if (pointsRef.current.length >= 3) {
                    finishDrawing();
                } else {
                    pointsRef.current = [];
                    setPoints([]);
                }
            }
        },
        mouseout() {
            setIsErasing(false);
            setIsDrawingFreehand(false);
            setMouseLatLng(null);
        }
    });

    const vertices = getVertices();

    return (
        <>
            {/* Draw Path Polyline */}
            {points.length > 0 && (
                <>
                    <Polyline
                        positions={points}
                        color={activeTool === 'scissors' ? '#ef4444' : '#FFD700'}
                        weight={3}
                    />
                    {cursorPos && points.length >= 1 && (activeTool === 'pencil' || activeTool === 'scissors') && (
                        <Polyline
                            positions={[points[points.length - 1], cursorPos]}
                            color={activeTool === 'scissors' ? '#ef4444' : '#FFD700'}
                            weight={2}
                            opacity={0.5}
                            dashArray="5, 10"
                        />
                    )}
                    {cursorPos && points.length >= 2 && (activeTool === 'pencil' || activeTool === 'scissors') && (
                        <Polyline
                            positions={[cursorPos, points[0]]}
                            color={activeTool === 'scissors' ? '#ef4444' : '#FFD700'}
                            weight={1}
                            opacity={0.3}
                            dashArray="5, 10"
                        />
                    )}
                    {activeTool !== 'freehand' && points.map((p, i) => (
                        <Marker
                            key={i}
                            position={p}
                            icon={L.divIcon({
                                className: `bg-white border-2 ${activeTool === 'scissors' ? 'border-red-500' : 'border-yellow-500'} rounded-full w-3 h-3 ${i === 0 && points.length >= 3 ? 'animate-pulse !w-4 !h-4 !border-4 !border-green-500 shadow-md shadow-green-400/50' : ''}`
                            })}
                            eventHandlers={{
                                click: (e) => {
                                    if (i === 0 && points.length >= 3) {
                                        L.DomEvent.stopPropagation(e);
                                        finishDrawing();
                                    }
                                }
                            }}
                        />
                    ))}
                    <Polygon
                        positions={activeTool === 'pencil' || activeTool === 'scissors' ? [...points, cursorPos || points[0]] : points}
                        color={activeTool === 'scissors' ? '#ef4444' : '#FFD700'}
                        fillOpacity={0.1}
                    />
                </>
            )}

            {/* Render completed vector handles when Pencil, Freehand, Scissors, or Eraser is active */}
            {currentDrawnLayer && activeTool && (activeTool === 'pencil' || activeTool === 'freehand' || activeTool === 'scissors' || activeTool === 'eraser') && (
                <>
                    {vertices.map((latlng, idx) => (
                        <Marker
                            key={`${idx}-${latlng.lat.toFixed(6)}-${latlng.lng.toFixed(6)}`}
                            position={latlng}
                            draggable={activeTool === 'pencil' || activeTool === 'freehand' || activeTool === 'scissors'}
                            eventHandlers={{
                                drag: (e) => {
                                    const marker = e.target;
                                    const newLatLng = marker.getLatLng();
                                    handleVertexDrag(idx, newLatLng);
                                },
                                click: (e) => {
                                    if (activeTool === 'eraser') {
                                        L.DomEvent.stopPropagation(e);
                                        handleVertexDelete(idx);
                                    }
                                }
                            }}
                            icon={L.divIcon({
                                className: `rounded-full border border-white shadow-lg transition-all duration-150 cursor-pointer hover:scale-125
                                    ${activeTool === 'eraser' 
                                        ? 'bg-rose-500 w-4 h-4 md:w-3 h-3 hover:bg-rose-600 animate-pulse' 
                                        : 'bg-indigo-500 w-4 h-4 md:w-3 h-3 hover:bg-indigo-600'}`
                            })}
                        />
                    ))}
                </>
            )}

            {/* Glowing red eraser cursor helper */}
            {activeTool === 'eraser' && eraserMode === 'partial' && mouseLatLng && (
                <Circle
                    center={mouseLatLng}
                    radius={eraserRadiusMeters}
                    pathOptions={{
                        color: '#f43f5e',
                        fillColor: '#fda4af',
                        fillOpacity: 0.35,
                        weight: 1.5,
                        dashArray: '4, 4'
                    }}
                />
            )}

            {/* Apple/Figma style sleek overlay HUD bar at top center of map */}
            {activeTool && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-slate-950/90 border border-white/10 text-white px-4 py-2.5 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md animate-in slide-in-from-top-4 duration-300 w-[90%] sm:w-auto min-w-[280px] max-w-[450px]">
                    <span className="flex h-2 w-2 relative flex-shrink-0">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeTool === 'eraser' ? 'bg-rose-400' : 'bg-amber-400'}`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${activeTool === 'eraser' ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                    </span>
                    <span className="text-[11px] sm:text-xs font-medium leading-tight flex-1 text-slate-100">
                        {activeTool === 'pencil' && "✏️ Pencil Tool: Click map to place roof corners. Click green dot or double-click to finish."}
                        {activeTool === 'freehand' && "✨ Freehand Tool: Click and drag (swipe) continuously over the roof, then release to finish."}
                        {activeTool === 'scissors' && "✂️ Scissors Tool: Outline area to trim. Double-click to trim."}
                        {activeTool === 'eraser' && (eraserMode === 'full' ? "🧽 Full Eraser: Click anywhere inside the drawn roof outline to delete it completely." : "🧽 Partial Eraser: Click any red point, or hold & drag (rub) to wipe vertices.") }
                        {activeTool === 'pin' && "📍 Pin Tool: Click anywhere on map to select custom installation address."}
                    </span>
                    {activeTool !== 'pin' && activeTool !== 'eraser' && activeTool !== 'freehand' && (
                        <div className="flex gap-1.5 ml-2 flex-shrink-0">
                            <button
                                onClick={finishDrawing}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-sm transition active:scale-95"
                            >
                                Finish
                            </button>
                            <button
                                onClick={clearPoints}
                                className="bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-sm transition active:scale-95"
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

function PinDropper({ isPinning, onPinDrop }: { isPinning: boolean, onPinDrop: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            if (isPinning) {
                onPinDrop(e.latlng.lat, e.latlng.lng);
            }
        }
    });
    return null;
}

export default function Map({ lat, lng, onLocationSelect, enableDrawing = false, onRoofMeasured, detectedPolygon, detectedPanels, onDetectPanels, userLocation, onUserLocationUpdate, orientation = 'portrait' }: MapProps) {
    const featureGroupRef = useRef<L.FeatureGroup>(null);
    const mapRef = useRef<L.Map | null>(null);

    const [activeTool, setActiveTool] = useState<'pencil' | 'freehand' | 'eraser' | 'scissors' | 'pin' | null>(null);
    const [eraserMode, setEraserMode] = useState<'full' | 'partial'>('full');
    // @ts-ignore
    const [eraserSize, setEraserSize] = useState(20);
    const [currentDrawnLayer, setCurrentDrawnLayer] = useState<L.Polygon | null>(null);
    const [measurements, setMeasurements] = useState<{ area: number; panelCount: number; capacity: number } | null>(null);
    const [isSolarMenuOpen, setIsSolarMenuOpen] = useState(false);
    const [isPanelsOverlaid, setIsPanelsOverlaid] = useState(false);
    const [panels, setPanels] = useState<Panel[]>([]);

    // Sync detected panels prop with local state
    useEffect(() => {
        if (detectedPanels) {
            setPanels(detectedPanels);
            setIsPanelsOverlaid(true);
        } else {
            setPanels([]);
            setIsPanelsOverlaid(false);
        }
    }, [detectedPanels]);

    // Auto-update overlay when orientation changes reactively
    useEffect(() => {
        if (isPanelsOverlaid && currentDrawnLayer && !detectedPanels) {
            handleOverlayPanels(currentDrawnLayer);
        }
    }, [orientation]);

    // Overlay solar panels in the selected area (scientifically backed layout)
    const handleOverlayPanels = (customLayer?: L.Polygon | L.Rectangle) => {
        const layerToUse = customLayer || currentDrawnLayer;
        if (!layerToUse || !featureGroupRef.current || !mapRef.current) {
            if (!customLayer) {
                alert('Please draw a polygon or rectangle first to select an area.');
            }
            return;
        }

        const latlngs = layerToUse.getLatLngs()[0] as L.LatLng[];
        const areaSqM = calculateGeodesicArea(latlngs);
        const result = estimateSolarPanels(areaSqM);

        // Clear existing layers and redraw the polygon boundary
        featureGroupRef.current.clearLayers();
        featureGroupRef.current.addLayer(layerToUse);

        // Generate individual bounds and update panels state
        const polygonCoords = latlngs.map(p => ({ lat: p.lat, lng: p.lng }));
        const generated = clientGenerateIndividualPanels(lat, lng, polygonCoords, result.panelCount, orientation);
        setPanels(generated);
        setIsPanelsOverlaid(true);
        setIsSolarMenuOpen(false);
        
        if (!customLayer) {
            alert(`Overlaid ${generated.length} solar panels (${result.capacityKW} kW estimated capacity)`);
        }
    };

    // Effect to handle externally detected polygon
    useEffect(() => {
        if (detectedPolygon && detectedPolygon.length >= 3 && featureGroupRef.current) {
            const polygon = L.polygon(detectedPolygon, { color: '#00FF00', weight: 3 }); // Green for detected
            featureGroupRef.current.clearLayers();
            featureGroupRef.current.addLayer(polygon);
            setCurrentDrawnLayer(polygon);

            const areaSqM = calculateGeodesicArea(detectedPolygon);
            const result = estimateSolarPanels(areaSqM);
            setMeasurements({ area: Math.round(areaSqM * 100) / 100, panelCount: result.panelCount, capacity: result.capacityKW });

            if (onRoofMeasured) {
                onRoofMeasured(areaSqM, result.panelCount, result.capacityKW, detectedPolygon);
            }

            // Center map on polygon
            if (mapRef.current) {
                mapRef.current.fitBounds(polygon.getBounds());
            }

            // Automatically trigger panel overlay inside the detected polygon!
            setTimeout(() => {
                if (detectedPanels && detectedPanels.length > 0) {
                    setPanels(detectedPanels);
                    setIsPanelsOverlaid(true);
                } else {
                    handleOverlayPanels(polygon);
                }
            }, 100);
        }
    }, [detectedPolygon, detectedPanels]);

    const calculateGeodesicArea = (latlngs: L.LatLng[]): number => {
        if (latlngs.length < 3) return 0;
        const R = 6371000;
        let area = 0;
        for (let i = 0; i < latlngs.length; i++) {
            const j = (i + 1) % latlngs.length;
            const lat1 = latlngs[i].lat * Math.PI / 180;
            const lat2 = latlngs[j].lat * Math.PI / 180;
            const lng1 = latlngs[i].lng * Math.PI / 180;
            const lng2 = latlngs[j].lng * Math.PI / 180;
            area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
        }
        return Math.abs(area * R * R / 2);
    };

    const estimateSolarPanels = (areaSqM: number) => {
        // Scientifically backed rooftop solar estimation formula (NREL / MNRE standards):
        // 1. Usable Roof Area: Typically 70% to 80% (we use 75% as standard) to account for edge setbacks (mandatory 1m), maintenance walkways, and structural constraints.
        // 2. Modern High-Efficiency Panel Specifications: 550W Monocrystalline Bifacial module.
        // 3. Physical Footprint per Panel: ~2.58 m² (based on dimensions 2.28m x 1.13m).

        const USABLE_AREA_RATIO = 0.75;
        const usableArea = areaSqM * USABLE_AREA_RATIO;
        const PANEL_AREA = 2.58; // m² per 550W panel
        const PANEL_WATTAGE = 550; // W

        // Calculate number of panels that physically fit inside the usable area
        const panelCount = Math.floor(usableArea / PANEL_AREA);

        // Calculate Capacity in kWp (1 kWp = 1000 W)
        const capacityKW = Math.round(((panelCount * PANEL_WATTAGE) / 1000) * 100) / 100;

        return { panelCount, capacityKW };
    };

    const handleDrawComplete = (latlngs: L.LatLng[]) => {
        setActiveTool(null);
        const polygon = L.polygon(latlngs, { color: '#FFD700', weight: 3 });

        if (featureGroupRef.current) {
            featureGroupRef.current.clearLayers();
            featureGroupRef.current.addLayer(polygon);
            setCurrentDrawnLayer(polygon);

            const areaSqM = calculateGeodesicArea(latlngs);
            const result = estimateSolarPanels(areaSqM);
            setMeasurements({ area: Math.round(areaSqM * 100) / 100, panelCount: result.panelCount, capacity: result.capacityKW });

            if (onRoofMeasured) {
                onRoofMeasured(areaSqM, result.panelCount, result.capacityKW, latlngs);
            }
        }
    };

    const handleSubtractPolygon = (cutLatLngs: L.LatLng[]) => {
        if (!currentDrawnLayer || !featureGroupRef.current) {
            alert("No shape to trim from!");
            return;
        }
        try {
            const currentGeoJSON = currentDrawnLayer.toGeoJSON() as any;
            const cutPoints = cutLatLngs.map(p => [p.lng, p.lat]);
            cutPoints.push(cutPoints[0]);
            const cutPolygon = turf.polygon([cutPoints]);
            const difference = turf.difference(turf.featureCollection([currentGeoJSON, cutPolygon]));

            if (difference) {
                featureGroupRef.current.clearLayers();
                const newLayer = L.geoJSON(difference, { style: { color: '#FFD700', weight: 3 } }).getLayers()[0] as L.Polygon;
                featureGroupRef.current.addLayer(newLayer);
                setCurrentDrawnLayer(newLayer);
                setActiveTool(null);
                
                // Recalculate area and panels
                const newLatLngs = (newLayer.getLatLngs()[0] as any).map((p: any) => L.latLng(p.lat, p.lng));
                handleVerticesChange(newLatLngs, newLayer);
            }
        } catch (e) {
            console.error("Error:", e);
            alert("Could not trim shape.");
        }
    };

    const handleVerticesChange = (newLatLngs: L.LatLng[], updatedLayer?: L.Polygon) => {
        const areaSqM = calculateGeodesicArea(newLatLngs);
        const result = estimateSolarPanels(areaSqM);
        setMeasurements({ area: Math.round(areaSqM * 100) / 100, panelCount: result.panelCount, capacity: result.capacityKW });

        if (onRoofMeasured) {
            onRoofMeasured(areaSqM, result.panelCount, result.capacityKW, newLatLngs);
        }

        // Auto re-render solar panels overlay in real-time if active!
        if (isPanelsOverlaid) {
            const layerToUse = updatedLayer || currentDrawnLayer;
            if (layerToUse) {
                setTimeout(() => {
                    handleOverlayPanels(layerToUse);
                }, 0);
            }
        }
    };

    const handleClear = () => {
        if (featureGroupRef.current) {
            featureGroupRef.current.clearLayers();
        }
        setCurrentDrawnLayer(null);
        setMeasurements(null);
        setPanels([]);
        setIsPanelsOverlaid(false);
    };

    const handlePinDrop = (latitude: number, longitude: number) => {
        setActiveTool(null);
        if (onLocationSelect) {
            onLocationSelect(latitude, longitude);
        }
    };

    useEffect(() => {
        if (mapRef.current) {
            mapRef.current.invalidateSize();
        }
    }, []);

    return (
        <div className="relative h-full w-full">
            {enableDrawing && measurements && (
                <div className="absolute top-4 left-4 z-[2000] bg-white/95 backdrop-blur-sm rounded-xl shadow-lg px-4 py-3 border border-blue-200 max-w-xs">
                    <div className="text-xs font-semibold text-gray-700 mb-2">📐 Roof Analysis</div>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between gap-3">
                            <span className="text-gray-600">Area:</span>
                            <span className="font-semibold text-gray-900">{measurements.area} m²</span>
                        </div>
                        <div className="flex justify-between gap-3">
                            <span className="text-gray-600">
                                {detectedPolygon ? 'Detected Panels:' : 'Potential Panels:'}
                            </span>
                            <span className="font-semibold text-gray-900">{measurements.panelCount}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                            <span className="text-gray-600">Capacity:</span>
                            <span className="font-semibold text-blue-600">{measurements.capacity} kW</span>
                        </div>
                    </div>
                </div>
            )}

            {enableDrawing && (
                <ToolsMenu
                    activeTool={activeTool}
                    onToolSelect={setActiveTool}
                    eraserMode={eraserMode}
                    onEraserModeChange={setEraserMode}
                    eraserSize={eraserSize}
                    onEraserSizeChange={setEraserSize}
                />
            )}

            {/* Pin Location Button */}
            {enableDrawing && (
                <div className="absolute top-32 md:top-40 right-2.5 z-[1000] flex flex-col items-end">
                    <div className="group relative flex items-center justify-end">
                        <span className="hidden md:block absolute right-14 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Pin Location
                        </span>
                        <button
                            onClick={() => setActiveTool(activeTool === 'pin' ? null : 'pin')}
                            className={`
                                w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl border-2 shadow-lg flex items-center justify-center
                                hover:bg-gray-50 transition-all duration-200 transform hover:scale-105
                                ${activeTool === 'pin' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}
                            `}
                        >
                            <img src={pinIcon} alt="Pin" className="w-5 h-5 md:w-6 md:h-6 object-contain" />
                        </button>
                    </div>
                </div>
            )}

            {/* Solar Panel Actions Control */}
            {enableDrawing && (
                <div className="absolute bottom-4 left-2 z-[1000] flex flex-col-reverse items-start gap-2 pointer-events-none">
                    {/* Main Solar Icon */}
                    <button
                        onClick={() => setIsSolarMenuOpen(!isSolarMenuOpen)}
                        className={`
                            w-10 h-10 bg-white rounded-full shadow-lg border-2 border-yellow-400 flex items-center justify-center text-yellow-500 
                            hover:bg-yellow-50 transition-all duration-300 transform pointer-events-auto
                            ${isSolarMenuOpen ? 'scale-110 rotate-12 bg-yellow-50' : 'hover:scale-105'}
                        `}
                    >
                        <Zap size={20} fill="currentColor" className="drop-shadow-sm" />
                    </button>

                    {/* Menu Options */}
                    <div className={`
                        flex flex-col-reverse gap-2 transition-all duration-300 transform origin-bottom-left mb-2
                        ${isSolarMenuOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}
                    `}>

                        {/* Detect Button */}
                        <button
                            onClick={() => onDetectPanels && onDetectPanels()}
                            className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-lg border border-gray-200 hover:bg-blue-50 transition-all hover:scale-105 whitespace-nowrap"
                        >
                            <Search size={16} className="text-blue-600" />
                            <span className="text-sm font-medium text-gray-700">Detect Solar Panels</span>
                        </button>

                        {/* Overlay Button */}
                        <button
                            onClick={() => handleOverlayPanels()}
                            className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-lg border border-gray-200 hover:bg-blue-50 transition-all hover:scale-105 whitespace-nowrap animate-pulse"
                        >
                            <Grid size={16} className="text-green-600" />
                            <span className="text-sm font-medium text-gray-700">Overlay Solar Panels</span>
                        </button>
                    </div>
                </div>
            )}

            <MapContainer
                center={[lat, lng]}
                zoom={18}
                maxZoom={22}
                zoomControl={false}
                scrollWheelZoom={true}
                className={`h-full w-full ${activeTool === 'pin' ? 'cursor-crosshair' : ''} ${activeTool && activeTool !== 'pin' ? 'touch-none' : ''}`}
                attributionControl={false}
                ref={(map) => { if (map) mapRef.current = map; }}
            >
                <ZoomControl position="bottomright" />
                <LayersControl position="topright">
                    <LayersControl.BaseLayer checked name="Satellite">
                        <TileLayer
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            maxZoom={22}
                            maxNativeZoom={19}
                        />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="Street">
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            maxZoom={22}
                            maxNativeZoom={19}
                        />
                    </LayersControl.BaseLayer>
                </LayersControl>

                <MapController lat={lat} lng={lng} />
                <PinDropper isPinning={activeTool === 'pin'} onPinDrop={handlePinDrop} />

                {/* Show User Location Blue Dot (GPS) */}
                {userLocation && (
                    <UserLocationMarker
                        position={userLocation}
                        onUpdate={(lat, lng) => {
                            if (onUserLocationUpdate) onUserLocationUpdate(lat, lng);
                        }}
                    />
                )}

                {/* Always show Target Location Pin */}
                <Marker position={[lat, lng]} icon={RedIcon} />

                {/* Render individual panels with premium highlights */}
                {panels && panels.length > 0 && panels.map((panel) => (
                    <Polygon
                        key={panel.id}
                        positions={panel.bounds.map(p => [p.lat, p.lng] as [number, number])}
                        pathOptions={{
                            color: '#3b82f6',
                            weight: 1.5,
                            fillColor: '#1d4ed8',
                            fillOpacity: 0.65
                        }}
                        eventHandlers={{
                            mouseover: (e) => {
                                const layer = e.target;
                                layer.setStyle({
                                    fillColor: '#60a5fa',
                                    fillOpacity: 0.85,
                                    color: '#2563eb',
                                    weight: 2
                                });
                            },
                            mouseout: (e) => {
                                const layer = e.target;
                                layer.setStyle({
                                    fillColor: '#1d4ed8',
                                    fillOpacity: 0.65,
                                    color: '#3b82f6',
                                    weight: 1.5
                                });
                            }
                        }}
                    />
                ))}

                {enableDrawing && (
                    <>
                        <FeatureGroup ref={featureGroupRef} />
                        <MapDrawer
                            activeTool={activeTool}
                            eraserMode={eraserMode}
                            eraserSize={eraserSize}
                            currentDrawnLayer={currentDrawnLayer}
                            setCurrentDrawnLayer={setCurrentDrawnLayer}
                            onDrawComplete={handleDrawComplete}
                            onClear={handleClear}
                            onSubtract={handleSubtractPolygon}
                            onVerticesChange={handleVerticesChange}
                        />
                    </>
                )}
            </MapContainer>
        </div >
    );
}
