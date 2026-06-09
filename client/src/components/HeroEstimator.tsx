import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Zap } from 'lucide-react';
import Map from './Map';
import api from '../api/axios';
import FeasibilityResultsModal from './FeasibilityResultsModal';
import { generateProposal } from '../utils/pdfGenerator';
import { clientGenerateIndividualPanels } from '../utils/solarMath';

export default function HeroEstimator() {
    const [lat, setLat] = useState(20.5937);
    const [lng, setLng] = useState(78.9629);
    const [bill, setBill] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [detectedPolygon, setDetectedPolygon] = useState<any>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [userDrawnPolygon, setUserDrawnPolygon] = useState<any>(null);
    const [category, setCategory] = useState('Residential');
    const [areaType, setAreaType] = useState('Rooftop');
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
    const [error, setError] = useState<string | null>(null);

    // Human-in-the-Loop (HITL) calibration and feedback states
    const [detectedPanels, setDetectedPanels] = useState<any[] | null>(null);
    const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
    const [aiDetectedCount, setAiDetectedCount] = useState(0);
    const [correctedCount, setCorrectedCount] = useState(0);
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Manual/Auto-filled inputs
    const [manualArea, setManualArea] = useState<string>('');
    const [manualPanels, setManualPanels] = useState<string>('');
    const [manualCapacity, setManualCapacity] = useState<string>('');
    const [isLocating, setIsLocating] = useState(false);

    // Lead Gen State
    const [showLeadModal, setShowLeadModal] = useState(false);
    const [showResultsModal, setShowResultsModal] = useState(false);
    const [isReportUnlocked, setIsReportUnlocked] = useState(false);
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const resultsRef = useRef<HTMLDivElement>(null);

    const handleLocationSelect = (newLat: number, newLng: number) => {
        setLat(newLat);
        setLng(newLng);
    };

    const detectLocation = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            return;
        }

        setIsLocating(true);
        let watchId: number | null = null;
        let bestAccuracy = Infinity;
        let bestPosition: GeolocationPosition | null = null;

        // Stop watching after 10 seconds
        const timeoutId = setTimeout(() => {
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            setIsLocating(false);

            if (bestPosition) {
                // Silent success or fallback to best position
            } else {
                console.warn('Could not get a location fix.');
            }
        }, 10000);

        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                console.log(`GPS Update: ${latitude}, ${longitude} (Accuracy: ${accuracy}m)`);

                if (accuracy < bestAccuracy) {
                    bestAccuracy = accuracy;
                    bestPosition = position;
                    setLat(latitude);
                    setLng(longitude);
                    setUserLocation({ lat: latitude, lng: longitude });
                }

                if (accuracy <= 20) {
                    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
                    clearTimeout(timeoutId);
                    setIsLocating(false);
                }
            },
            (error) => {
                console.error("GPS Error:", error);
                if (error.code === error.PERMISSION_DENIED) {
                    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
                    clearTimeout(timeoutId);
                    setIsLocating(false);
                    // Silent fail on permission denied
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };

    const handleUserLocationUpdate = (lat: number, lng: number) => {
        setUserLocation({ lat, lng });
    };

    useEffect(() => {
        const polygonToUse = detectedPolygon || userDrawnPolygon;
        if (polygonToUse && polygonToUse.length >= 3 && manualPanels) {
            const count = parseInt(manualPanels) || 0;
            if (count > 0) {
                const polygonCoords = polygonToUse.map((p: any) => ({ lat: p.lat, lng: p.lng }));
                const generated = clientGenerateIndividualPanels(lat, lng, polygonCoords, count, orientation);
                setDetectedPanels(generated);
            }
        }
    }, [orientation]);

    const handleDetectPanels = async () => {
        if (!userDrawnPolygon || userDrawnPolygon.length < 3) {
            alert("Please draw an area on the roof first using the Pencil tool.");
            return;
        }

        setLoading(true);
        try {
            // Send the drawn polygon to the backend for analysis
            const response = await api.post('/detection/detect-panels', {
                lat,
                lng,
                polygon: userDrawnPolygon,
                orientation
            });

            if (response.data.success) {
                const { panelCount, capacityKW, polygons, detectedPanels: serverPanels } = response.data;
                
                if (polygons && polygons.length > 0) {
                    setDetectedPolygon(polygons[0]);
                }

                const finalPolygon = (polygons && polygons.length > 0) ? polygons[0] : userDrawnPolygon;

                // Save panels state
                if (serverPanels && serverPanels.length > 0) {
                    setDetectedPanels(serverPanels);
                } else {
                    const polygonCoords = finalPolygon.map((p: any) => ({ lat: p.lat, lng: p.lng }));
                    const generated = clientGenerateIndividualPanels(lat, lng, polygonCoords, panelCount, orientation);
                    setDetectedPanels(generated);
                }

                // Initialize HITL dialog state
                setAiDetectedCount(panelCount);
                setCorrectedCount(panelCount);
                setShowFeedbackDialog(true);

                // Update manual inputs in estimator HUD
                const R = 6371000;
                let areaSum = 0;
                for (let i = 0; i < finalPolygon.length; i++) {
                    const j = (i + 1) % finalPolygon.length;
                    const lat1 = finalPolygon[i].lat * Math.PI / 180;
                    const lat2 = finalPolygon[j].lat * Math.PI / 180;
                    const lng1 = finalPolygon[i].lng * Math.PI / 180;
                    const lng2 = finalPolygon[j].lng * Math.PI / 180;
                    areaSum += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
                }
                const areaSqM = Math.abs(areaSum * R * R / 2);
                
                setManualArea(areaSqM.toFixed(1));
                setManualPanels(panelCount.toString());
                setManualCapacity(capacityKW.toString());

            } else {
                alert("No panels detected in the selected area.");
            }
        } catch (error) {
            console.error("Detection failed:", error);
            alert("Failed to analyze area.");
        } finally {
            setLoading(false);
        }
    };

    const handleCorrectedCountChange = (newCount: number) => {
        if (newCount < 0) return;
        setCorrectedCount(newCount);
        
        // Dynamically update map rendering
        const polygonToUse = detectedPolygon || userDrawnPolygon;
        if (polygonToUse && polygonToUse.length >= 3) {
            const polygonCoords = polygonToUse.map((p: any) => ({ lat: p.lat, lng: p.lng }));
            const generated = clientGenerateIndividualPanels(lat, lng, polygonCoords, newCount, orientation);
            setDetectedPanels(generated);
            
            // Also update HUD inputs in real-time
            setManualPanels(newCount.toString());
            const capacity = Math.round(((newCount * 550) / 1000) * 100) / 100;
            setManualCapacity(capacity.toString());
        }
    };

    const handleFeedbackConfirm = async () => {
        setFeedbackSubmitting(true);
        try {
            const polygonToUse = detectedPolygon || userDrawnPolygon;
            const polygonCoords = polygonToUse ? polygonToUse.map((p: any) => ({ lat: p.lat, lng: p.lng })) : [];
            
            const response = await api.post('/detection/detect-feedback', {
                lat,
                lng,
                polygon: polygonCoords,
                aiDetectedCount,
                userCorrectedCount: correctedCount,
                missedCount: correctedCount - aiDetectedCount
            });

            if (response.data.success) {
                setToastMessage("Feedback logged! System is learning from this roof structure.");
                setTimeout(() => setToastMessage(null), 4000);
            }
        } catch (error) {
            console.error("Failed to log feedback:", error);
        } finally {
            setFeedbackSubmitting(false);
            setShowFeedbackDialog(false);
        }
    };

    const calculateFeasibility = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.post('/feasibility/calculate', {
                lat,
                lng,
                bill: bill ? parseFloat(bill) : undefined,
                capacityKW: manualCapacity ? parseFloat(manualCapacity) : undefined,
                category
            });
            setResult(response.data);
        } catch (error: any) {
            console.error(error);
            setError(error.response?.data?.error || 'Failed to calculate feasibility. Please try again.');
            setShowResultsModal(true); // Show modal on error
            // alert('Failed to calculate feasibility.'); // Removed alert in favor of UI error
        } finally {
            setLoading(false);
        }
    };

    const handleAnalyzeClick = () => {
        if (!bill && !manualCapacity) {
            alert('Please either draw a roof area OR enter your monthly bill.');
            return;
        }
        setShowLeadModal(true);
        // Start calculation immediately in background
        calculateFeasibility();
    };

    const handleLeadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userName || !userEmail) return;

        // Unlock immediately for "instant" feel
        setIsReportUnlocked(true);
        setShowLeadModal(false);
        setShowResultsModal(true); // Open results modal

        try {
            // Save Lead to Firestore in background
            const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
            const { db } = await import('../firebase');

            await addDoc(collection(db, 'leads'), {
                name: userName,
                email: userEmail,
                type: 'analysis_request',
                feasibilityResult: result, // Note: result might be null if calculation is still pending
                location: { lat, lng },
                category,
                areaType,
                timestamp: serverTimestamp()
            });

        } catch (error) {
            console.error("Error saving lead:", error);
        }
    };

    const handleExtraAction = async (type: 'quote' | 'download') => {
        if (type === 'quote') {
            alert("Request received! Our solar representative will contact you shortly.");
            return;
        }

        if (type === 'download') {
            if (result?.feasibility) {
                try {
                    const f = result.feasibility;
                    generateProposal({
                        customerName: userName || 'Valued Customer',
                        address: userLocation 
                            ? `Lat: ${userLocation.lat.toFixed(4)}, Lng: ${userLocation.lng.toFixed(4)}` 
                            : `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`,
                        phone: '',
                        email: userEmail || '',
                        category: f.category || category,
                        monthlyBill: bill ? parseFloat(bill) : Math.round(f.annualSavings / 12),
                        roofArea: manualArea ? parseFloat(manualArea) : f.requiredRoofAreaSqM,
                        systemSizeKW: f.systemSizeKW,
                        panelCount: manualPanels ? parseInt(manualPanels) : Math.floor((f.requiredRoofAreaSqM * 0.75) / 2.58),
                        annualSavings: f.annualSavings,
                        systemCost: f.totalCost,
                        subsidy: f.subsidy,
                        netCost: f.netCost,
                        paybackPeriod: f.paybackPeriodYears
                    });
                } catch (err) {
                    console.error("PDF generation failed:", err);
                    alert("Failed to generate PDF proposal.");
                }
            } else {
                alert("Calculating feasibility, please wait a moment then try downloading again.");
            }
        }
    };

    const getFontSize = (val: any, extra: string = '') => {
        const str = String(val || '') + extra;
        if (str.length > 18) return 'text-base';
        if (str.length > 14) return 'text-lg';
        if (str.length > 10) return 'text-xl';
        return 'text-2xl';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 md:p-8 relative">

            {/* Lead Gen Modal */}
            {showLeadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-slate-800 border border-white/10 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl relative z-50"
                    >
                        <h2 className="text-2xl font-bold text-white mb-2">Unlock Your Solar Report</h2>
                        <p className="text-blue-200 mb-6">Enter your details to see your personalized solar savings analysis.</p>

                        <form onSubmit={handleLeadSubmit} className="space-y-4">
                            <div>
                                <label className="text-xs text-blue-200 block mb-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    className="glass-input w-full px-4 py-3 rounded-xl text-white placeholder-white/30 bg-white/5 border border-white/10 focus:border-solar-400 focus:ring-1 focus:ring-solar-400 outline-none transition"
                                    placeholder="John Doe"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-blue-200 block mb-1">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={userEmail}
                                    onChange={(e) => setUserEmail(e.target.value)}
                                    className="glass-input w-full px-4 py-3 rounded-xl text-white placeholder-white/30 bg-white/5 border border-white/10 focus:border-solar-400 focus:ring-1 focus:ring-solar-400 outline-none transition"
                                    placeholder="john@example.com"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-gradient-to-r from-solar-500 to-solar-600 hover:from-solar-400 hover:to-solar-500 text-white font-bold py-4 rounded-xl shadow-lg transform transition hover:scale-[1.02] flex justify-center items-center gap-2 mt-4"
                            >
                                View My Report
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowLeadModal(false)}
                                className="w-full text-sm text-gray-400 hover:text-white mt-2"
                            >
                                Cancel
                            </button>
                        </form>
                    </motion.div>
                </div>
            )}

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 md:pt-12">

                {/* Left Column: Inputs */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="lg:col-span-5 space-y-6 order-1 lg:order-1"
                >
                    <h1 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-solar-200 text-center lg:text-left">
                        SolarScout
                    </h1>
                    <p className="text-blue-100/80 text-base md:text-lg text-center lg:text-left">
                        AI-driven solar feasibility analysis for your rooftop.
                    </p>

                    <div className="glass rounded-3xl p-4 md:p-8 space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-semibold flex items-center gap-2">
                                <MapPin className="text-solar-400" /> Location
                            </h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setUserLocation({ lat, lng });
                                    }}
                                    className="text-xs bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full hover:bg-blue-500 hover:text-white transition flex items-center gap-1"
                                    title="Set blue dot to current pin location"
                                >
                                    <MapPin size={12} /> Set as My Location
                                </button>
                                <button
                                    onClick={detectLocation}
                                    disabled={isLocating}
                                    className="text-xs bg-solar-500/20 text-solar-300 px-3 py-1 rounded-full hover:bg-solar-500 hover:text-white transition disabled:opacity-50 disabled:cursor-wait flex items-center gap-1"
                                >
                                    {isLocating ? (
                                        <>
                                            <span className="animate-spin">⏳</span> Detecting...
                                        </>
                                    ) : (
                                        <>
                                            <MapPin size={12} /> Auto-Detect GPS
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-blue-200 block mb-1">Latitude</label>
                                    <input type="text" value={lat.toFixed(4)} readOnly className="glass-input w-full px-4 py-2 rounded-xl" />
                                </div>
                                <div>
                                    <label className="text-xs text-blue-200 block mb-1">Longitude</label>
                                    <input type="text" value={lng.toFixed(4)} readOnly className="glass-input w-full px-4 py-2 rounded-xl" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs text-blue-200 block mb-1">Category</label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="glass-input w-full px-2 py-3 rounded-xl text-[13px] md:text-sm bg-slate-800/50"
                                >
                                    <option value="Residential" className="text-gray-900">Residential</option>
                                    <option value="Gated Community" className="text-gray-900">Gated Community</option>
                                    <option value="Commercial" className="text-gray-900">Commercial</option>
                                    <option value="Industrial" className="text-gray-900">Industrial</option>
                                    <option value="Water Body" className="text-gray-900">Water Body</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-blue-200 block mb-1">Area Type</label>
                                <select
                                    value={areaType}
                                    onChange={(e) => setAreaType(e.target.value)}
                                    className="glass-input w-full px-2 py-3 rounded-xl text-[13px] md:text-sm bg-slate-800/50"
                                >
                                    <option value="Rooftop" className="text-gray-900">Rooftop</option>
                                    <option value="Angled Roof" className="text-gray-900">Angled Roof</option>
                                    <option value="Land" className="text-gray-900">Land</option>
                                    <option value="Water Body" className="text-gray-900">Water Body</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-blue-200 block mb-1">Orientation</label>
                                <select
                                    value={orientation}
                                    onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
                                    className="glass-input w-full px-2 py-3 rounded-xl text-[13px] md:text-sm bg-slate-800/50"
                                >
                                    <option value="portrait" className="text-gray-900">Portrait (Vert.)</option>
                                    <option value="landscape" className="text-gray-900">Landscape (Horiz.)</option>
                                </select>
                            </div>
                        </div>

                        {/* Roof Analysis Inputs */}
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs text-blue-200 block mb-1">Area (m²)</label>
                                <input
                                    type="number"
                                    value={manualArea}
                                    onChange={(e) => setManualArea(e.target.value)}
                                    className="glass-input w-full px-3 py-2 rounded-xl text-sm"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-blue-200 block mb-1">Potential Panels</label>
                                <input
                                    type="number"
                                    value={manualPanels}
                                    onChange={(e) => setManualPanels(e.target.value)}
                                    className="glass-input w-full px-3 py-2 rounded-xl text-sm"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-blue-200 block mb-1">Capacity (kW)</label>
                                <input
                                    type="number"
                                    value={manualCapacity}
                                    onChange={(e) => setManualCapacity(e.target.value)}
                                    className="glass-input w-full px-3 py-2 rounded-xl text-sm font-semibold text-solar-300"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-blue-200 block mb-1">Monthly Bill (₹) <span className="text-gray-400">(Optional)</span></label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300">₹</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={bill}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === '' || /^[1-9][0-9]*$/.test(value)) {
                                            setBill(value);
                                        }
                                    }}
                                    className="glass-input w-full pl-8 pr-4 py-3 rounded-xl text-lg"
                                    placeholder="1500"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleAnalyzeClick}
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-solar-500 to-solar-600 hover:from-solar-400 hover:to-solar-500 text-white font-bold py-4 rounded-xl shadow-lg transform transition hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        >
                            {loading ? 'Analyzing...' : <>Analyze Feasibility <Zap size={20} /></>}
                        </button>
                    </div>
                </motion.div>

                {/* Right Column: Map & Results */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="lg:col-span-7 space-y-6 order-2 lg:order-2"
                >
                    <div className="glass rounded-3xl p-2 h-[400px] md:h-[500px] relative z-0 overflow-hidden">
                        <Map
                            lat={lat}
                            lng={lng}
                            onLocationSelect={handleLocationSelect}
                            enableDrawing={true}
                            detectedPolygon={detectedPolygon}
                            detectedPanels={detectedPanels}
                            onDetectPanels={handleDetectPanels}
                            userLocation={userLocation}
                            orientation={orientation}
                            onRoofMeasured={(area, panelCount, capacity, polygon) => {
                                console.log('Roof measured:', { area, panelCount, capacity });
                                setManualArea(area.toFixed(1));
                                setManualPanels(panelCount.toString());
                                setManualCapacity(capacity.toString());

                                if (polygon) {
                                    setUserDrawnPolygon(polygon);
                                }
                            }}
                            onUserLocationUpdate={handleUserLocationUpdate}
                        />
                    </div>

                    {/* Results Section - Removed in favor of Modal */}
                </motion.div>
            </div>

            <FeasibilityResultsModal
                isOpen={showResultsModal}
                onClose={() => setShowResultsModal(false)}
                loading={loading}
                error={error}
                result={result}
                onAction={handleExtraAction}
            />

            {/* Glassmorphic HITL Calibration Dialog */}
            {showFeedbackDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="relative bg-slate-900/80 border border-white/10 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-xl"
                    >
                        {/* Radiant design accents */}
                        <div className="absolute -top-16 -right-16 w-36 h-36 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
                        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-solar-500/20 rounded-full blur-2xl pointer-events-none" />

                        <div className="relative z-10 text-center space-y-5">
                            <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
                                <Zap size={24} className="animate-pulse" />
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-white tracking-tight">Human-in-the-Loop</h3>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    AI detected <span className="font-semibold text-blue-400">{aiDetectedCount}</span> solar panels in the highlighted region. Did we miss any?
                                </p>
                            </div>

                            {/* Tactile Stepper Controller */}
                            <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4">
                                <button
                                    type="button"
                                    onClick={() => handleCorrectedCountChange(correctedCount - 1)}
                                    disabled={correctedCount <= 0}
                                    className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 active:scale-95 disabled:opacity-40 transition-all font-bold text-lg select-none"
                                >
                                    －
                                </button>
                                <div className="text-center">
                                    <div className="text-3xl font-extrabold text-white">{correctedCount}</div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">Solar Panels</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleCorrectedCountChange(correctedCount + 1)}
                                    className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all font-bold text-lg select-none"
                                >
                                    ＋
                                </button>
                            </div>

                            {/* Capacity Info HUD */}
                            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/20 rounded-xl p-3 border border-white/5">
                                <div className="text-left">
                                    <span className="text-slate-400">Total Capacity:</span>
                                    <div className="text-sm font-semibold text-blue-400 mt-0.5">
                                        {Math.round(((correctedCount * 550) / 1000) * 100) / 100} kWp
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-slate-400">Calibration Delta:</span>
                                    <div className={`text-sm font-semibold mt-0.5 ${correctedCount === aiDetectedCount ? 'text-slate-300' : correctedCount > aiDetectedCount ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {correctedCount - aiDetectedCount === 0 ? 'No change' : correctedCount - aiDetectedCount > 0 ? `+${correctedCount - aiDetectedCount} panels` : `${correctedCount - aiDetectedCount} panels`}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowFeedbackDialog(false)}
                                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold py-3 rounded-xl transition active:scale-95 text-sm"
                                >
                                    Dismiss
                                </button>
                                <button
                                    type="button"
                                    onClick={handleFeedbackConfirm}
                                    disabled={feedbackSubmitting}
                                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-500/25 transition active:scale-95 disabled:opacity-50 text-sm"
                                >
                                    {feedbackSubmitting ? 'Logging...' : 'Confirm Layout'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Sleek Mini Toast */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-[9999] pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        className="bg-slate-950/90 border border-emerald-500/20 text-emerald-300 px-5 py-3 rounded-2xl shadow-xl backdrop-blur-md flex items-center gap-3"
                    >
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-sm font-semibold tracking-wide">{toastMessage}</span>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
