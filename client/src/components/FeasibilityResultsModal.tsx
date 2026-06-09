import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileText, AlertTriangle } from 'lucide-react';

interface FeasibilityResultsModalProps {
    isOpen: boolean;
    onClose: () => void;
    loading: boolean;
    error: string | null;
    result: any;
    onAction: (type: 'quote' | 'download') => void;
}

export default function FeasibilityResultsModal({
    isOpen,
    onClose,
    loading,
    error,
    result,
    onAction
}: FeasibilityResultsModalProps) {
    const getFontSize = (val: any, extra: string = '') => {
        const str = String(val || '') + extra;
        if (str.length > 18) return 'text-base';
        if (str.length > 14) return 'text-lg';
        if (str.length > 10) return 'text-xl';
        return 'text-2xl';
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-slate-900/90 border border-white/10 rounded-3xl p-6 md:p-8 max-w-4xl w-full shadow-2xl relative overflow-hidden"
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition"
                        >
                            <X size={20} />
                        </button>

                        {/* Content */}
                        <div className="relative z-10">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-96 space-y-6">
                                    <div className="animate-spin text-6xl">☀️</div>
                                    <h3 className="text-2xl font-semibold text-white">Analyzing Roof Potential...</h3>
                                    <p className="text-blue-200">Calculating solar irradiance and financial returns</p>
                                </div>
                            ) : error ? (
                                <div className="flex flex-col items-center justify-center h-96 space-y-6 text-center">
                                    <div className="p-4 bg-red-500/10 rounded-full">
                                        <AlertTriangle size={48} className="text-red-500" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-red-400">Analysis Failed</h3>
                                    <div className="bg-red-900/20 border border-red-500/20 p-4 rounded-xl max-w-lg">
                                        <p className="text-red-200 font-mono text-sm">{error}</p>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="mt-4 bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-xl transition font-medium"
                                    >
                                        Close & Try Again
                                    </button>
                                </div>
                            ) : result ? (
                                <>
                                    <div className="text-center mb-8">
                                        <h2 className="text-3xl font-bold text-white mb-2">Your Solar Potential</h2>
                                        <p className="text-blue-200">Based on your location and inputs</p>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                        <div className="p-5 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition">
                                            <div className="text-blue-300 text-xs uppercase tracking-wider mb-2">System Size</div>
                                            <div className={`${getFontSize(result?.feasibility?.systemSizeKW, ' kW')} font-bold text-white`}>{result?.feasibility?.systemSizeKW || '0'} kW</div>
                                        </div>
                                        <div className="p-5 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition">
                                            <div className="text-blue-300 text-xs uppercase tracking-wider mb-2">Net Cost</div>
                                            <div className={`${getFontSize((result?.feasibility?.netCost / 100000).toFixed(2), 'L')} font-bold text-white`}>₹{(result?.feasibility?.netCost / 100000).toFixed(2) || '0'}L</div>
                                            <div className="text-xs text-green-400 mt-1">After ₹{(result?.feasibility?.subsidy / 1000).toFixed(0) || '0'}k subsidy</div>
                                        </div>
                                        <div className="p-5 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition">
                                            <div className="text-blue-300 text-xs uppercase tracking-wider mb-2">Annual Savings</div>
                                            <div className={`${getFontSize(result?.feasibility?.annualSavings.toLocaleString())} font-bold text-white`}>₹{result?.feasibility?.annualSavings.toLocaleString() || '0'}</div>
                                        </div>
                                        <div className="p-5 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition">
                                            <div className="text-blue-300 text-xs uppercase tracking-wider mb-2">Payback</div>
                                            <div className={`${getFontSize(result?.feasibility?.paybackPeriodYears, ' Yrs')} font-bold text-white`}>{result?.feasibility?.paybackPeriodYears || '0'} Yrs</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                        <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20 flex items-center gap-4">
                                            <div className="text-3xl">💰</div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm text-green-200 mb-1">Lifetime Savings</div>
                                                <div className={`${getFontSize((result?.feasibility?.lifetimeSavings / 100000).toFixed(2), ' Lakhs')} font-bold text-green-400 truncate`}>₹{(result?.feasibility?.lifetimeSavings / 100000).toFixed(2) || '0'} Lakhs</div>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 flex items-center gap-4">
                                            <div className="text-3xl">🏠</div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm text-blue-200 mb-1">Roof Area Needed</div>
                                                <div className={`${getFontSize(result?.feasibility?.requiredRoofAreaSqFt, ' sq.ft')} font-bold text-blue-400 truncate`}>{result?.feasibility?.requiredRoofAreaSqFt || '0'} sq.ft</div>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20 flex items-center gap-4">
                                            <div className="text-3xl">🌳</div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm text-yellow-200 mb-1">Impact</div>
                                                <div className={`${getFontSize(result?.feasibility?.treesPlanted, ' Trees')} font-bold text-yellow-400 truncate`}>{result?.feasibility?.treesPlanted || '0'} Trees</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:flex-row gap-4">
                                        <button
                                            onClick={() => onAction('quote')}
                                            className="flex-1 bg-gradient-to-r from-solar-500 to-solar-600 hover:from-solar-400 hover:to-solar-500 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-solar-500/20 flex items-center justify-center gap-2"
                                        >
                                            <FileText size={20} /> Get Detailed Quote
                                        </button>
                                        <button
                                            onClick={() => onAction('download')}
                                            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-4 px-6 rounded-xl transition-all backdrop-blur-md flex items-center justify-center gap-2"
                                        >
                                            <Download size={20} /> Download Report
                                        </button>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
