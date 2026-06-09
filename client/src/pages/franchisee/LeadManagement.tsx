import { useState } from 'react';
import { Search, Filter, Plus, MoreVertical, Phone, Mail } from 'lucide-react';

const mockLeads = [
    { id: 1, name: 'Rajesh Kumar', address: 'Plot 45, Jubilee Hills', status: 'New', date: '2023-10-25' },
    { id: 2, name: 'Sneha Reddy', address: 'Apt 302, Gachibowli', status: 'Feasibility Done', date: '2023-10-24' },
    { id: 3, name: 'Vikram Singh', address: 'Villa 12, Hitech City', status: 'Proposal Sent', date: '2023-10-23' },
];

export default function LeadManagement() {
    const [leads] = useState(mockLeads);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">Lead Management</h1>
                <button className="bg-solar-500 hover:bg-solar-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                    <Plus size={18} /> Add Lead
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={18} />
                    <input
                        type="text"
                        placeholder="Search leads..."
                        className="glass-input w-full pl-10 pr-4 py-2 rounded-lg"
                    />
                </div>
                <button className="glass px-4 py-2 rounded-lg flex items-center gap-2 text-blue-200 hover:text-white">
                    <Filter size={18} /> Filter
                </button>
            </div>

            {/* Leads Table */}
            <div className="glass rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-blue-200 text-sm uppercase">
                        <tr>
                            <th className="px-6 py-4 font-medium">Name</th>
                            <th className="px-6 py-4 font-medium">Address</th>
                            <th className="px-6 py-4 font-medium">Status</th>
                            <th className="px-6 py-4 font-medium">Date</th>
                            <th className="px-6 py-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {leads.map((lead) => (
                            <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-white">{lead.name}</div>
                                    <div className="text-xs text-blue-300 flex gap-2 mt-1">
                                        <span className="flex items-center gap-1"><Phone size={10} /> +91 98765...</span>
                                        <span className="flex items-center gap-1"><Mail size={10} /> email@...</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-blue-100">{lead.address}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium 
                    ${lead.status === 'New' ? 'bg-blue-500/20 text-blue-300' :
                                            lead.status === 'Feasibility Done' ? 'bg-yellow-500/20 text-yellow-300' :
                                                'bg-green-500/20 text-green-300'}`}>
                                        {lead.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-blue-300 text-sm">{lead.date}</td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-blue-300 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors">
                                        <MoreVertical size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
