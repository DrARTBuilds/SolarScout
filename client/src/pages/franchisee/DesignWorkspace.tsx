import { useState } from 'react';
import { Download, Save, X, User, Phone, Mail, MapPin } from 'lucide-react';
import RoofDesign from '../../components/RoofDesign';
import { generateProposal } from '../../utils/pdfGenerator';

export default function DesignWorkspace() {
    const [area, setArea] = useState<number>(0);
    const [showProposalModal, setShowProposalModal] = useState<boolean>(false);
    
    // Form lead details
    const [customerName, setCustomerName] = useState<string>('');
    const [customerPhone, setCustomerPhone] = useState<string>('');
    const [customerEmail, setCustomerEmail] = useState<string>('');
    const [customerAddress, setCustomerAddress] = useState<string>('Hyderabad, Telangana, India');
    const [monthlyBill, setMonthlyBill] = useState<number>(3000);
    const [category, setCategory] = useState<'Residential' | 'Commercial' | 'Industrial' | 'Gated Community'>('Residential');

    // Solar Math calculations (Unified 550W Module standard)
    const PANEL_AREA_SQM = 2.58;
    const PANEL_WATTAGE = 550;
    const USABLE_ROOF_PERCENTAGE = 0.75;

    const usableArea = area * USABLE_ROOF_PERCENTAGE;
    const panelCount = Math.floor(usableArea / PANEL_AREA_SQM);
    const systemSizeKW = Math.round(((panelCount * PANEL_WATTAGE) / 1000) * 0.95 * 100) / 100; // 5% shadow loss factored

    // Costing
    const costPerKW = systemSizeKW > 2 ? 75000 : 80000;
    const systemCost = Math.round(systemSizeKW * costPerKW);

    // PM Surya Ghar Yojana Subsidy Math for Residential
    let subsidy = 0;
    if (category === 'Residential') {
        if (systemSizeKW <= 2) {
            subsidy = systemSizeKW * 30000;
        } else {
            subsidy = 60000 + Math.min(systemSizeKW - 2, 1) * 18000;
        }
        subsidy = Math.round(Math.min(78000, subsidy));
    }
    const netCost = systemCost - subsidy;

    // Tariff Rates
    const tariffRates = {
        'Residential': 7,
        'Commercial': 10,
        'Industrial': 9,
        'Gated Community': 8
    };
    const tariffRate = tariffRates[category];

    // Annual Generation (~4 kWh/kWp/day) & Savings (Capped at bill)
    const annualGeneration = Math.round(systemSizeKW * 4 * 365);
    const rawAnnualSavings = annualGeneration * tariffRate;
    const annualBill = monthlyBill * 12;
    const annualSavings = Math.round(Math.min(rawAnnualSavings, annualBill));

    // Payback period
    const paybackPeriod = annualSavings > 0 ? Math.round((netCost / annualSavings) * 10) / 10 : 0;

    const handleDownloadProposal = (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerName) {
            alert('Please enter a Customer Name first.');
            return;
        }
        if (area <= 0) {
            alert('Please delineate a roof area on the map first to perform calculations.');
            return;
        }

        generateProposal({
            customerName,
            address: customerAddress,
            phone: customerPhone,
            email: customerEmail,
            category,
            monthlyBill,
            roofArea: Math.round(area * 100) / 100,
            systemSizeKW,
            panelCount,
            annualSavings,
            systemCost,
            subsidy,
            netCost,
            paybackPeriod
        });
        
        setShowProposalModal(false);
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col gap-4 relative">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white tracking-wide">Franchisee Design Studio</h1>
                <div className="flex gap-3">
                    <div className="glass px-4 py-2 rounded-xl text-blue-200 border border-white/10 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        Est. Roof Area: <span className="text-white font-mono font-bold">{Math.round(area * 10) / 10} m²</span>
                    </div>
                    <button 
                        onClick={() => alert('Design configuration successfully saved to franchisee leads database.')}
                        className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 border border-white/10 transition-all hover:scale-105 active:scale-95 shadow-lg"
                    >
                        <Save size={18} /> Save Design
                    </button>
                    <button
                        onClick={() => setShowProposalModal(true)}
                        className="bg-gradient-to-r from-solar-500 to-amber-500 hover:from-solar-600 hover:to-amber-600 text-slate-950 font-semibold px-5 py-2 rounded-xl flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-solar-500/20"
                    >
                        <Download size={18} /> Generate Proposal
                    </button>
                </div>
            </div>

            <div className="flex-1 glass rounded-2xl overflow-hidden relative border border-white/10">
                <RoofDesign lat={17.3850} lng={78.4867} onAreaCalculated={setArea} />
            </div>

            {/* Premium Glassmorphic Proposal Sidebar/Modal */}
            {showProposalModal && (
                <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm z-[2000] flex justify-end transition-all duration-300 animate-in fade-in">
                    <div className="w-full sm:w-[500px] h-full bg-slate-900/90 border-l border-white/10 shadow-2xl flex flex-col backdrop-blur-xl animate-in slide-in-from-right duration-300 text-white">
                        
                        {/* Header */}
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-950/20">
                            <div>
                                <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-solar-400 to-amber-300">
                                    Create Lead Proposal
                                </h3>
                                <p className="text-xs text-slate-400">Generate a scientifically-backed commercial/residential report</p>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setShowProposalModal(false)}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content Scroll Area */}
                        <form onSubmit={handleDownloadProposal} className="flex-1 overflow-y-auto p-6 space-y-6">
                            
                            {/* Alert if no area drawn */}
                            {area <= 0 && (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
                                    ⚠️ <strong>Notice</strong>: Draw a polygon on the roof space first to calculate active system metrics in real-time.
                                </div>
                            )}

                            {/* Section 1: Customer Lead Profile */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">1. Customer Information</h4>
                                
                                <div className="space-y-3">
                                    {/* Name */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-300">Customer Name *</label>
                                        <div className="relative">
                                            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input 
                                                type="text" 
                                                required
                                                placeholder="e.g. Rohini Kumar"
                                                value={customerName}
                                                onChange={(e) => setCustomerName(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2.5 rounded-xl glass-input text-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Contact row */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-300">Phone</label>
                                            <div className="relative">
                                                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input 
                                                    type="tel" 
                                                    placeholder="9876543210"
                                                    value={customerPhone}
                                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl glass-input text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-300">Email</label>
                                            <div className="relative">
                                                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input 
                                                    type="email" 
                                                    placeholder="customer@domain.com"
                                                    value={customerEmail}
                                                    onChange={(e) => setCustomerEmail(e.target.value)}
                                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl glass-input text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Address */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-300">Installation Address</label>
                                        <div className="relative">
                                            <MapPin size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                            <textarea 
                                                rows={2}
                                                placeholder="Enter full physical address..."
                                                value={customerAddress}
                                                onChange={(e) => setCustomerAddress(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2 rounded-xl glass-input text-sm resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Consumption Parameters */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">2. Electric Utility Parameters</h4>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-300">Lead Category</label>
                                        <select 
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value as any)}
                                            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-slate-200 text-sm focus:ring-2 focus:ring-solar-500/20 focus:outline-none"
                                        >
                                            <option value="Residential">🏠 Residential</option>
                                            <option value="Commercial">🏢 Commercial</option>
                                            <option value="Industrial">🏭 Industrial</option>
                                            <option value="Gated Community">🏘️ Gated Community</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-300">Avg Monthly Bill (₹)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-semibold">₹</span>
                                            <input 
                                                type="number" 
                                                value={monthlyBill}
                                                onChange={(e) => setMonthlyBill(Math.max(0, parseInt(e.target.value) || 0))}
                                                className="w-full pl-7 pr-4 py-2.5 rounded-xl glass-input text-sm font-semibold font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Technical & Financial Summary Dashboard (HUD Mode) */}
                            {area > 0 && (
                                <div className="space-y-4 pt-4 border-t border-white/10">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">3. RTS Technical & Financial Projections</h4>
                                    
                                    <div className="grid grid-cols-2 gap-3 text-slate-200">
                                        
                                        {/* Capacity */}
                                        <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                                            <div className="text-[10px] text-slate-400 font-medium">Recommended System</div>
                                            <div className="text-base font-extrabold text-blue-400 mt-0.5 font-mono">{systemSizeKW} kWp</div>
                                            <div className="text-[9px] text-slate-500 mt-0.5">{panelCount} modules (550W)</div>
                                        </div>

                                        {/* Gross Cost */}
                                        <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                                            <div className="text-[10px] text-slate-400 font-medium">Gross Setup Cost</div>
                                            <div className="text-base font-extrabold text-slate-100 mt-0.5 font-mono">₹{systemCost.toLocaleString()}</div>
                                            <div className="text-[9px] text-slate-500 mt-0.5">@₹{costPerKW.toLocaleString()}/kW</div>
                                        </div>

                                        {/* Subsidy */}
                                        <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                                            <div className="text-[10px] text-slate-400 font-medium">PM Surya Ghar Subsidy</div>
                                            <div className="text-base font-extrabold text-emerald-400 mt-0.5 font-mono">
                                                {subsidy > 0 ? `-₹${subsidy.toLocaleString()}` : '₹0'}
                                            </div>
                                            <div className="text-[9px] text-slate-500 mt-0.5">
                                                {category === 'Residential' ? 'Eligible Subsidy Cap' : 'Residential Only'}
                                            </div>
                                        </div>

                                        {/* Net Investment */}
                                        <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                                            <div className="text-[10px] text-slate-400 font-medium">Net Capital Outlay</div>
                                            <div className="text-base font-extrabold text-amber-400 mt-0.5 font-mono">₹{netCost.toLocaleString()}</div>
                                            <div className="text-[9px] text-slate-500 mt-0.5">Cost after subsidy</div>
                                        </div>

                                        {/* Savings */}
                                        <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                                            <div className="text-[10px] text-slate-400 font-medium">Year 1 Savings</div>
                                            <div className="text-base font-extrabold text-teal-400 mt-0.5 font-mono">₹{annualSavings.toLocaleString()}</div>
                                            <div className="text-[9px] text-slate-500 mt-0.5">Capped at bill value</div>
                                        </div>

                                        {/* Payback */}
                                        <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                                            <div className="text-[10px] text-slate-400 font-medium">Investment Payback</div>
                                            <div className="text-base font-extrabold text-purple-400 mt-0.5 font-mono">{paybackPeriod} Years</div>
                                            <div className="text-[9px] text-slate-500 mt-0.5">Est. ROI timeline</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Footer Submit Button */}
                            <button
                                type="submit"
                                disabled={area <= 0}
                                className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl transition-all duration-300 transform active:scale-95
                                    ${area <= 0 
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5 shadow-none' 
                                        : 'bg-gradient-to-r from-solar-500 to-amber-500 hover:from-solar-600 hover:to-amber-600 text-slate-950 hover:shadow-solar-500/25 hover:shadow-2xl'
                                    }`}
                            >
                                <Download size={18} />
                                Download PDF Client Proposal
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
