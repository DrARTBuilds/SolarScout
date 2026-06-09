import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ProposalData {
    customerName: string;
    address: string;
    phone?: string;
    email?: string;
    category: string;
    monthlyBill: number;
    roofArea: number;
    systemSizeKW: number;
    panelCount: number;
    annualSavings: number;
    systemCost: number;
    subsidy: number;
    netCost: number;
    paybackPeriod: number;
}

export const generateProposal = (data: ProposalData) => {
    const doc = new jsPDF();

    // 1. Sleek Brand Header Banner
    doc.setFillColor(30, 41, 59); // Slate Blue/Dark Gray background
    doc.rect(0, 0, 210, 42, 'F');
    
    doc.setFillColor(249, 155, 0); // Solar Orange accent stripe
    doc.rect(0, 40, 210, 2, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('SolarScout RTS Proposal', 20, 26);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(226, 232, 240);
    doc.text('Advanced Geometrical Solar Rooftop Feasibility Study', 20, 34);

    // 2. Customer Metadata Card
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('1. CLIENT & PROPERTY DETAILS', 20, 56);

    // Draw thin gray separator line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(20, 59, 190, 59);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    
    // Left Column
    doc.text(`Customer Name:   ${data.customerName}`, 20, 68);
    doc.text(`Installation Address: ${data.address}`, 20, 75);
    doc.text(`Lead Category:   ${data.category}`, 20, 82);

    // Right Column
    doc.text(`Phone Number:    ${data.phone || 'N/A'}`, 110, 68);
    doc.text(`Email Address:   ${data.email || 'N/A'}`, 110, 75);
    doc.text(`Proposal Date:   ${new Date().toLocaleDateString()}`, 110, 82);

    // 3. Technical Solar Array Design
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('2. TECHNICAL DESIGN SPECIFICATIONS', 20, 98);
    doc.line(20, 101, 190, 101);

    autoTable(doc, {
        startY: 104,
        margin: { left: 20, right: 20 },
        head: [['Technical Parameter', 'Design Specification']],
        body: [
            ['Total Delineated Roof Area', `${data.roofArea.toLocaleString()} m² (${Math.round(data.roofArea * 10.764).toLocaleString()} sq.ft)`],
            ['Usable Installation Space (75%)', `${(data.roofArea * 0.75).toFixed(1)} m²`],
            ['Recommended Solar Modules', `${data.panelCount} x 550Wp Monocrystalline Bifacial`],
            ['Total System Size', `${data.systemSizeKW} kWp`],
            ['Optimized Array Tilt Angle', '17° (Latitude adaptive)'],
            ['Primary Orientation Direction', 'South (180° for Northern Hemisphere)'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3.5 },
        columnStyles: { 0: { cellWidth: 90 }, 1: { fontStyle: 'bold' } }
    });

    // 4. Financial Analysis Table
    const nextY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('3. FINANCIAL FEASIBILITY STUDY', 20, nextY);
    doc.line(20, nextY + 3, 190, nextY + 3);

    autoTable(doc, {
        startY: nextY + 6,
        margin: { left: 20, right: 20 },
        head: [['Financial Metric', 'Estimated Output (INR)']],
        body: [
            ['Average Monthly Utility Bill', `INR ${data.monthlyBill.toLocaleString()}`],
            ['Gross Project Setup Cost', `INR ${data.systemCost.toLocaleString()}`],
            ['PM Surya Ghar Yojana Subsidy', data.subsidy > 0 ? `- INR ${data.subsidy.toLocaleString()}` : 'INR 0 (Residential Only)'],
            ['Net Capital Investment', `INR ${data.netCost.toLocaleString()}`],
            ['Estimated Year 1 Annual Utility Savings', `INR ${data.annualSavings.toLocaleString()}`],
            ['Investment Payback Period', `${data.paybackPeriod} Years`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [249, 155, 0], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3.5 },
        columnStyles: { 0: { cellWidth: 90 }, 1: { fontStyle: 'bold', textColor: [15, 23, 42] } }
    });

    // 5. Environmental Benefits & Footprint
    const nextY2 = (doc as any).lastAutoTable.finalY + 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129); // Beautiful emerald green
    doc.text('4. ENVIRONMENTAL IMPACT ASSESSMENT', 20, nextY2);
    doc.line(20, nextY2 + 3, 190, nextY2 + 3);

    // Dynamic environmental math
    const co2Saved = (data.systemSizeKW * 1.2).toFixed(1);
    const treesEquivalent = Math.round(data.systemSizeKW * 20);

    doc.setFillColor(240, 253, 244); // Very light emerald background card
    doc.rect(20, nextY2 + 6, 170, 24, 'F');
    doc.setDrawColor(187, 247, 208);
    doc.rect(20, nextY2 + 6, 170, 24, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(21, 128, 61);
    doc.text('☘️ Your Green Energy Footprint Contribution:', 25, nextY2 + 13);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(22, 101, 52);
    doc.text(`• Mitigate approximately ${co2Saved} tons of CO2 greenhouse gases per year.`, 25, nextY2 + 19);
    doc.text(`• Environmental offset equivalent to planting ${treesEquivalent} mature trees annually.`, 25, nextY2 + 24);

    // 6. Professional Disclaimer Footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('* Disclaimer: Technical estimations are derived from satellite coordinate math. Actual parameters may vary subject to local shade factors and structural tests.', 20, 280);
    doc.text('Powered by SolarScout AI Engine', 145, 280);

    doc.save(`SolarScout_Proposal_${data.customerName.replace(/\s+/g, '_')}.pdf`);
};
