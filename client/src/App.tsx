import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HeroEstimator from './components/HeroEstimator';
import FranchiseeDashboard from './layouts/FranchiseeDashboard';
import LeadManagement from './pages/franchisee/LeadManagement';
import AdminDashboard from './layouts/AdminDashboard';
import DesignWorkspace from './pages/franchisee/DesignWorkspace';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HeroEstimator />} />

        {/* Franchisee Routes */}
        <Route path="/franchisee" element={<FranchiseeDashboard />}>
          <Route index element={<Navigate to="leads" replace />} />
          <Route path="leads" element={<LeadManagement />} />
          <Route path="design" element={<DesignWorkspace />} />
          <Route path="territory" element={<div className="p-8 text-blue-200">Territory Management Coming Soon</div>} />
          <Route path="proposals" element={<div className="p-8 text-blue-200">Proposals Coming Soon</div>} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
