import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, LayersControl, FeatureGroup, Polygon, Polyline, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import * as turf from '@turf/turf';
import ToolsMenu from './ToolsMenu';
import { clientGenerateIndividualPanels, type Panel } from '../utils/solarMath';

// Fix for default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface RoofDesignProps {
    lat: number;
    lng: number;
    onAreaCalculated?: (areaSqM: number, panelCount: number, estimatedCapacity: number) => void;
}

// Component to capture map reference
function MapRefCapture({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
    const map = useMap();

    useEffect(() => {
        mapRef.current = map;
    }, [map, mapRef]);

    return null;
}

// Custom Drawing Component with Advanced Vector Editing and Tactile Eraser
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
    currentDrawnLayer: L.Polygon | L.Rectangle | null,
    setCurrentDrawnLayer: (layer: L.Polygon | L.Rectangle | null) => void,
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
            setEraserRadiusMeters(eraserSize * 0.15);
        }
    };

    useMapEvents({
        click(e) {
            if (activeTool === 'pencil' || activeTool === 'scissors') {
                // Check if clicking near first point to close (15px threshold)
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

            {/* Apple/Figma style HUD at top center */}
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
                        {activeTool === 'eraser' && (eraserMode === 'full' ? "🧽 Full Eraser: Click inside roof outline to delete it entirely." : "🧽 Partial Eraser: Click any red point or hold & drag (rub) to wipe vertices.") }
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

// Component to handle interactive pin dropping
function PinDropper({
    isPinning,
    onPinDrop
}: {
    isPinning: boolean,
    onPinDrop: (lat: number, lng: number) => void
}) {
    useMapEvents({
        click(e) {
            if (isPinning) {
                onPinDrop(e.latlng.lat, e.latlng.lng);
            }
        }
    });
    return null;
}

export default function RoofDesign({ lat, lng, onAreaCalculated }: RoofDesignProps) {
    const featureGroupRef = useRef<L.FeatureGroup>(null);
    const mapRef = useRef<L.Map | null>(null);
    const [estimationMode, setEstimationMode] = useState<'new' | 'existing'>('new');
    const [isDetecting, setIsDetecting] = useState(false);

    // Tool State
    const [activeTool, setActiveTool] = useState<'pencil' | 'freehand' | 'eraser' | 'scissors' | 'pin' | null>(null);
    const [eraserMode, setEraserMode] = useState<'full' | 'partial'>('full');
    const [eraserSize, setEraserSize] = useState(20);
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

    const [showActionModal, setShowActionModal] = useState(false);
    const [currentDrawnLayer, setCurrentDrawnLayer] = useState<L.Polygon | L.Rectangle | null>(null);
    const [locationMarker, setLocationMarker] = useState<L.Marker | null>(null);
    const [isPanelsOverlaid, setIsPanelsOverlaid] = useState(false);
    const [panels, setPanels] = useState<Panel[]>([]);
    const [measurements, setMeasurements] = useState<{
        area: number;
        panelCount: number;
        capacity: number;
        tiltAngle: number;
        azimuth: string;
        shadowLoss: number;
        mountHeight: number;
    } | null>(null);

    // Calculate geodesic area of a polygon
    const calculateGeodesicArea = (latlngs: L.LatLng[]): number => {
        if (latlngs.length < 3) return 0;

        const R = 6371000; // Earth's radius in meters
        let area = 0;

        for (let i = 0; i < latlngs.length; i++) {
            const j = (i + 1) % latlngs.length;
            const lat1 = latlngs[i].lat * Math.PI / 180;
            const lat2 = latlngs[j].lat * Math.PI / 180;
            const lng1 = latlngs[i].lng * Math.PI / 180;
            const lng2 = latlngs[j].lng * Math.PI / 180;

            area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
        }

        area = Math.abs(area * R * R / 2);
        return area;
    };

    // Estimate panel count and capacity with scientifically backed parameters
    const estimateSolarPanels = (areaSqM: number, mode: 'new' | 'existing', latitude: number) => {
        // Unified sizing parameters:
        // - 550W Bifacial panels with a footprint of 2.58 m² per panel.
        // - Usable roof area: 75% for new installations, 80% for existing (flat roof optimizing).
        const PANEL_AREA_SQM = 2.58;
        const PANEL_WATTAGE = 550;
        const USABLE_ROOF_PERCENTAGE = mode === 'new' ? 0.75 : 0.80;

        const optimalTiltAngle = Math.round(Math.abs(latitude));
        const azimuthDirection = latitude >= 0 ? 'South (180°)' : 'North (0°)';
        const shadowImpactPercentage = 5;
        const recommendedMountingHeight = optimalTiltAngle > 20 ? 15 : 10;

        const usableArea = areaSqM * USABLE_ROOF_PERCENTAGE;
        const panelCount = Math.floor(usableArea / PANEL_AREA_SQM);
        const theoreticalCapacityKW = (panelCount * PANEL_WATTAGE) / 1000;
        const effectiveCapacityKW = theoreticalCapacityKW * (1 - shadowImpactPercentage / 100);

        return {
            panelCount,
            capacityKW: Math.round(effectiveCapacityKW * 100) / 100,
            tiltAngle: optimalTiltAngle,
            azimuth: azimuthDirection,
            shadowLoss: shadowImpactPercentage,
            mountHeight: recommendedMountingHeight
        };
    };

    // Handle custom drawing completion
    const handleDrawComplete = (latlngs: L.LatLng[]) => {
        setActiveTool(null);

        // Create a polygon layer from points
        const polygon = L.polygon(latlngs, {
            color: '#f99b00',
            weight: 3
        });

        if (featureGroupRef.current) {
            featureGroupRef.current.clearLayers(); // Clear previous
            featureGroupRef.current.addLayer(polygon);
            setCurrentDrawnLayer(polygon);

            updateMeasurements(latlngs, polygon);

            // Enhanced popup with shadow & angle info
            // (Re-calculate result for popup text)
            const areaSqM = calculateGeodesicArea(latlngs);
            const result = estimateSolarPanels(areaSqM, estimationMode, lat);

            polygon.bindPopup(`
                <div style="font-family: sans-serif; font-size: 12px;">
                    <strong style="color: #1e40af; font-size: 14px">☀️ Roof Analysis</strong><br/><br/>
                    <b>📐 Area:</b> ${Math.round(areaSqM)} m² (${Math.round(areaSqM * 10.764)} sq.ft)<br/>
                    <b>🔋 Panels:</b> ${result.panelCount} × 400W<br/>
                    <b>⚡ Capacity:</b> <span style="color: #16a34a; font-weight: bold;">${result.capacityKW} kW</span><br/><br/>
                    <div style="background: #f0f9ff; padding: 6px; border-radius: 4px; margin-top: 4px;">
                        <b style="color: #0369a1;">📊 Optimization:</b><br/>
                        • Tilt Angle: <b>${result.tiltAngle}°</b><br/>
                        • Direction: <b>${result.azimuth}</b><br/>
                        • Mount Height: <b>${result.mountHeight} cm</b><br/>
                        • Shadow Loss: <b>~${result.shadowLoss}%</b>
                    </div>
                    <br/><em style="color: #666; font-size: 10px;">Mode: ${estimationMode === 'new' ? 'New RTS' : 'Existing RTS'}</em>
                </div>
            `).openPopup();
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
                const newLayer = L.geoJSON(difference, {
                    style: {
                        color: '#f99b00',
                        weight: 3
                    }
                }).getLayers()[0] as L.Polygon;

                featureGroupRef.current.addLayer(newLayer);
                setCurrentDrawnLayer(newLayer);

                const newLatLngs = (newLayer.getLatLngs()[0] as any).map((p: any) => L.latLng(p.lat, p.lng));
                updateMeasurements(newLatLngs, newLayer);
                setActiveTool(null);
            } else {
                alert("Cut resulted in empty shape!");
            }
        } catch (e) {
            console.error("Error subtracting polygon:", e);
            alert("Could not trim shape. Ensure the cut overlaps correctly.");
        }
    };

    const updateMeasurements = (latlngs: L.LatLng[], updatedLayer?: L.Polygon | L.Rectangle) => {
        const areaSqM = calculateGeodesicArea(latlngs);
        const result = estimateSolarPanels(areaSqM, estimationMode, lat);

        setMeasurements({
            area: Math.round(areaSqM * 100) / 100,
            ...result,
            capacity: result.capacityKW
        });

        if (onAreaCalculated) {
            onAreaCalculated(areaSqM, result.panelCount, result.capacityKW);
        }

        // Auto re-render solar panels overlay in real-time if active!
        if (isPanelsOverlaid) {
            const layerToUse = updatedLayer || currentDrawnLayer;
            if (layerToUse) {
                setTimeout(() => {
                    handleOverlayPanels(layerToUse, true);
                }, 0);
            }
        }
    };

    useEffect(() => {
        if (currentDrawnLayer) {
            const latlngs = currentDrawnLayer.getLatLngs();
            let coords: L.LatLng[] = [];
            if (latlngs.length > 0) {
                if (latlngs[0] instanceof L.LatLng) {
                    coords = latlngs as L.LatLng[];
                } else if (Array.isArray(latlngs[0])) {
                    coords = latlngs[0] as L.LatLng[];
                }
            }
            if (coords.length >= 3) {
                updateMeasurements(coords, currentDrawnLayer);
            }
        }
    }, [estimationMode, orientation]);

    const handleClear = () => {
        if (featureGroupRef.current) {
            featureGroupRef.current.clearLayers();
        }
        setCurrentDrawnLayer(null);
        setMeasurements(null);
        setPanels([]);
        setIsPanelsOverlaid(false);
    };

    // Overlay solar panels in the selected area
    const handleOverlayPanels = (customLayer?: L.Polygon | L.Rectangle, skipAlert: boolean = false) => {
        const layerToUse = customLayer || currentDrawnLayer;
        if (!layerToUse || !featureGroupRef.current || !mapRef.current) {
            if (!customLayer) {
                alert('Please draw a polygon or rectangle first to select an area.');
            }
            return;
        }

        // Clear existing layers and redraw the polygon
        featureGroupRef.current.clearLayers();
        featureGroupRef.current.addLayer(layerToUse);

        // Get the points of the drawn shape
        const latlngs = layerToUse.getLatLngs()[0] as L.LatLng[];

        // Calculate area and panel count
        const areaSqM = calculateGeodesicArea(latlngs);
        const result = estimateSolarPanels(areaSqM, estimationMode, lat);

        const polygonCoords = latlngs.map(p => ({ lat: p.lat, lng: p.lng }));
        const generated = clientGenerateIndividualPanels(lat, lng, polygonCoords, result.panelCount, orientation);
        setPanels(generated);
        setIsPanelsOverlaid(true);
        setShowActionModal(false);

        if (!skipAlert) {
            alert(`Overlaid ${generated.length} solar panels (${result.capacityKW} kW estimated capacity)`);
        }
    };

    const handleSolarPanelButtonClick = () => {
        if (!currentDrawnLayer) {
            // If no area drawn, zoom to location and drop pin
            handleZoomToLocation();
        } else {
            // Show action modal
            setShowActionModal(true);
        }
    };

    const handleZoomToLocation = () => {
        if (!mapRef.current) return;

        // Remove existing marker if any
        if (locationMarker && mapRef.current.hasLayer(locationMarker)) {
            mapRef.current.removeLayer(locationMarker);
        }

        // Zoom to location
        mapRef.current.setView([lat, lng], 20, {
            animate: true,
            duration: 0.5 // Faster zoom
        });

        // Drop a pin marker after zoom
        setTimeout(() => {
            placePin(lat, lng);
        }, 600);
    };

    const placePin = (latitude: number, longitude: number) => {
        if (!mapRef.current) return;

        // Remove existing marker if any
        if (locationMarker && mapRef.current.hasLayer(locationMarker)) {
            mapRef.current.removeLayer(locationMarker);
        }

        const marker = L.marker([latitude, longitude], {
            icon: L.divIcon({
                className: 'custom-pin-marker',
                html: '<div style="font-size: 32px;">📍</div>',
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            })
        });

        marker.addTo(mapRef.current);
        setLocationMarker(marker);
        marker.bindPopup(`
            <div style="font-family: sans-serif; font-size: 12px;">
                <strong>📍 Location</strong><br/>
                Lat: ${latitude.toFixed(6)}<br/>
                Lng: ${longitude.toFixed(6)}
            </div>
        `).openPopup();
    };

    const handlePinDrop = (latitude: number, longitude: number) => {
        placePin(latitude, longitude);
        setActiveTool(null);
    };

    const handleAutoDetectInArea = async () => {
        if (!currentDrawnLayer) {
            alert('Please draw a polygon or rectangle first to select an area.');
            return;
        }

        setShowActionModal(false);
        
        // Extract polygon coordinates
        const latlngs = currentDrawnLayer.getLatLngs()[0] as L.LatLng[];
        const polygonCoords = latlngs.map(p => ({ lat: p.lat, lng: p.lng }));
        await handleAutoDetect(polygonCoords);
    };

    const handleAutoDetect = async (polygonCoords?: { lat: number; lng: number }[]) => {
        if (!featureGroupRef.current) return;

        setIsDetecting(true);
        try {
            const axios = (await import('../api/axios')).default;

            const response = await axios.post('/detection/detect-panels', { 
                lat, 
                lng,
                polygon: polygonCoords,
                orientation
            });

            if (response.data.success && response.data.polygons && response.data.polygons.length > 0) {
                // Clear existing layers
                featureGroupRef.current.clearLayers();

                response.data.polygons.forEach((poly: any[]) => {
                    const latlngs = poly.map(p => [p.lat, p.lng] as [number, number]);
                    const polygon = L.polygon(latlngs, {
                        color: '#f99b00',
                        weight: 3
                    });

                    if (featureGroupRef.current) {
                        featureGroupRef.current.addLayer(polygon);
                        setCurrentDrawnLayer(polygon);

                        // Trigger measurement for the first polygon
                        const areaSqM = calculateGeodesicArea(latlngs.map(p => L.latLng(p[0], p[1])));
                        const result = estimateSolarPanels(areaSqM, estimationMode, lat);

                        setMeasurements({
                            area: Math.round(areaSqM * 100) / 100,
                            ...result,
                            capacity: result.capacityKW
                        });

                        if (onAreaCalculated) {
                            onAreaCalculated(areaSqM, result.panelCount, result.capacityKW);
                        }

                        polygon.bindPopup(`
                            <div style="font-family: sans-serif; font-size: 12px;">
                                <strong style="color: #1e40af; font-size: 14px;">🤖 AI Detected Array</strong><br/><br/>
                                <b>📐 Area:</b> ${Math.round(areaSqM)} m²<br/>
                                <b>⚡ Capacity:</b> ${result.capacityKW} kW<br/>
                                <em style="color: #666;">Confidence: ${Math.round(response.data.confidence * 100)}%</em>
                            </div>
                        `).openPopup();

                        // Automatically trigger panel overlay inside the detected polygon!
                        setTimeout(() => {
                            if (response.data.detectedPanels && response.data.detectedPanels.length > 0) {
                                setPanels(response.data.detectedPanels);
                                setIsPanelsOverlaid(true);
                            } else {
                                handleOverlayPanels(polygon, true);
                            }
                        }, 50);
                    }
                });
            }
        } catch (error) {
            console.error('Detection failed:', error);
            alert('Failed to detect panels. Please try drawing manually.');
        } finally {
            setIsDetecting(false);
        }
    };

    return (
        <div className="relative h-full w-full">
            {/* Estimation Mode Selector & Measurements */}
            <div className="absolute top-4 left-4 z-[1000] pointer-events-none flex flex-col gap-3">
                <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-3 border border-gray-200 max-w-xs pointer-events-auto">
                    <label className="block text-xs font-semibold text-gray-700 mb-2">Estimation Mode</label>
                    <select
                        value={estimationMode}
                        onChange={(e) => setEstimationMode(e.target.value as 'new' | 'existing')}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white mb-3"
                    >
                        <option value="new">🔧 Estimate New RTS</option>
                        <option value="existing">☀️ Estimate Existing RTS</option>
                    </select>

                    <label className="block text-xs font-semibold text-gray-700 mb-2">Orientation</label>
                    <select
                        value={orientation}
                        onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white mb-3"
                    >
                        <option value="portrait">📱 Portrait (Vertical)</option>
                        <option value="landscape">📐 Landscape (Horizontal)</option>
                    </select>

                    {measurements && (
                        <div className="mt-3 pt-3 border-t border-gray-200 text-xs space-y-1">
                            <div className="font-semibold text-gray-700 mb-2">📊 Measurements</div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Area:</span>
                                <span className="font-semibold text-gray-900">{measurements.area} m²</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Panels:</span>
                                <span className="font-semibold text-gray-900">{measurements.panelCount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Capacity:</span>
                                <span className="font-semibold text-blue-600">{measurements.capacity} kW</span>
                            </div>

                            <div className="mt-2 pt-2 border-t border-gray-200">
                                <div className="font-semibold text-gray-700 mb-2">⚙️ Optimization</div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Tilt Angle:</span>
                                    <span className="font-semibold text-gray-900">{measurements.tiltAngle}°</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Direction:</span>
                                    <span className="font-semibold text-gray-900">{measurements.azimuth}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Mount Height:</span>
                                    <span className="font-semibold text-gray-900">{measurements.mountHeight} cm</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Shadow Loss:</span>
                                    <span className="font-semibold text-orange-600">~{measurements.shadowLoss}%</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Advanced Tools Menu */}
            <ToolsMenu
                activeTool={activeTool}
                onToolSelect={setActiveTool}
                eraserMode={eraserMode}
                onEraserModeChange={setEraserMode}
                eraserSize={eraserSize}
                onEraserSizeChange={setEraserSize}
            />

            {/* Auto-Detect Button */}
            <div className="absolute bottom-6 left-6 z-[1001] pointer-events-none group flex items-end">
                <button
                    onClick={handleSolarPanelButtonClick}
                    disabled={isDetecting}
                    className={`
                        relative w-12 h-12 rounded-xl shadow-xl transition-all duration-500 transform hover:scale-110 active:scale-95
                        ${isDetecting ? 'cursor-wait opacity-80' : 'cursor-pointer'}
                        bg-gradient-to-br from-blue-900 via-blue-700 to-indigo-900 border border-white/20 pointer-events-auto
                    `}
                >
                    {isDetecting ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-yellow-400 border-t-transparent shadow-[0_0_10px_rgba(250,204,21,0.5)]"></div>
                        </div>
                    ) : (
                        <div className="absolute inset-0 overflow-visible">
                            {/* Moving Sun */}
                            <div className="absolute top-4 left-0 text-xs animate-sun-traverse z-0">☀️</div>

                            {/* Container for Panel & Shadow */}
                            <div className="absolute bottom-1 right-1 z-10 flex flex-col items-center">
                                {/* Solar Panel Icon */}
                                <div className="relative w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-700 rounded-md border-[0.5px] border-blue-300 shadow-sm flex flex-wrap gap-[1px] p-[1px] content-start overflow-hidden">
                                    {[...Array(6)].map((_, i) => (
                                        <div key={i} className="w-[8px] h-[6px] bg-blue-950/50 rounded-[0.5px] backdrop-blur-sm"></div>
                                    ))}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-panel-shine"></div>
                                </div>

                                {/* Shifting Shadow */}
                                <div className="w-5 h-1.5 bg-black/40 rounded-full blur-[1px] mt-0.5 animate-shadow-shift"></div>
                            </div>
                        </div>
                    )}
                </button>

                {/* Tooltip */}
                <div className="absolute left-full bottom-2 ml-4 px-3 py-1.5 bg-gray-900/90 backdrop-blur-md text-white text-[11px] font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-[-10px] group-hover:translate-x-0 shadow-[0_0_15px_rgba(0,0,0,0.3)] border border-white/10 pointer-events-none whitespace-nowrap">
                    <span className="text-yellow-400 mr-1">⚡</span> Solar Panel Actions
                    <div className="absolute left-0 bottom-3 -ml-1 w-2 h-2 bg-gray-900/90 transform rotate-45 border-l border-b border-white/10"></div>
                </div>
            </div>

            {/* Action Modal */}
            {showActionModal && (
                <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto"
                    onClick={() => setShowActionModal(false)}
                >
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-gray-900 mb-4">⚡ Solar Panel Actions</h3>
                        <p className="text-sm text-gray-600 mb-6">Choose an action for the selected area:</p>

                        <div className="space-y-3">
                            <button
                                onClick={() => handleOverlayPanels()}
                                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                            >
                                <span className="mr-2">🔲</span>
                                Overlay Solar Panels in Selected Area
                            </button>

                            <button
                                onClick={handleAutoDetectInArea}
                                className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-orange-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                            >
                                <span className="mr-2">🤖</span>
                                Auto-Detect Panels in Selected Area
                            </button>

                            <button
                                onClick={() => setShowActionModal(false)}
                                className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-all duration-300"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <MapContainer
                center={[lat, lng]}
                zoom={20}
                maxZoom={25}
                scrollWheelZoom={true}
                doubleClickZoom={true}
                className={`h-full w-full rounded-2xl z-0 ${activeTool === 'pin' ? 'cursor-crosshair' : ''} ${activeTool === 'eraser' ? 'cursor-not-allowed' : ''} ${activeTool && activeTool !== 'pin' ? 'touch-none' : ''}`}
                attributionControl={false}
            >
                <LayersControl position="topright">
                    <LayersControl.BaseLayer checked name="Satellite (Esri)">
                        <TileLayer
                            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            maxZoom={25}
                            maxNativeZoom={19}
                        />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="Street (OSM)">
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                    </LayersControl.BaseLayer>
                </LayersControl>

                <MapRefCapture mapRef={mapRef} />
                <PinDropper isPinning={activeTool === 'pin'} onPinDrop={handlePinDrop} />

                {/* Render individual panels dynamically */}
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
                    onVerticesChange={updateMeasurements}
                />

            </MapContainer>
        </div >
    );
}
