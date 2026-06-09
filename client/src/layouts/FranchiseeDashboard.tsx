import { LayoutDashboard, Users, FileText, Map as MapIcon, LogOut } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router-dom';

const SidebarItem = ({ icon: Icon, label, path, active }: any) => (
    <Link to={path}>
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-solar-500 text-white shadow-lg shadow-solar-500/20' : 'text-blue-200 hover:bg-white/5 hover:text-white'}`}>
            <Icon size={20} />
            <span className="font-medium">{label}</span>
        </div>
    </Link>
);

export default function FranchiseeDashboard() {
    const location = useLocation();

    return (
        <div className="min-h-screen bg-slate-900 text-white flex">
            {/* Sidebar */}
            <div className="w-64 bg-slate-800 border-r border-white/5 p-6 flex flex-col">
                <div className="mb-10 px-2">
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-solar-200">
                        SolarScout
                    </h1>
                    <p className="text-xs text-blue-300 mt-1">Franchisee Portal</p>
                </div>

                <nav className="space-y-2 flex-1">
                    <SidebarItem icon={LayoutDashboard} label="Overview" path="/franchisee" active={location.pathname === '/franchisee'} />
                    <SidebarItem icon={Users} label="Leads" path="/franchisee/leads" active={location.pathname === '/franchisee/leads'} />
                    <SidebarItem icon={MapIcon} label="Design" path="/franchisee/design" active={location.pathname === '/franchisee/design'} />
                    <SidebarItem icon={FileText} label="Proposals" path="/franchisee/proposals" active={location.pathname === '/franchisee/proposals'} />
                </nav>

                <button className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-all mt-auto">
                    <LogOut size={20} />
                    <span className="font-medium">Logout</span>
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
                <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
                    <h2 className="text-lg font-medium text-white">Dashboard</h2>
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-solar-500 flex items-center justify-center font-bold text-sm">
                            FP
                        </div>
                    </div>
                </header>

                <main className="p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
