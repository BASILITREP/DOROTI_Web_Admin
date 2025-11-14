import { useState, useEffect } from 'react';
import Header from '../header/Header';
import { useNavigate } from 'react-router-dom';
import { subscribe, unsubscribe } from '../services/socketService';
import type { FieldEngineer } from '../types';

function FEPage() {
  const [fieldEngineers, setFieldEngineers] = useState<FieldEngineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1); // ✅ Add pagination state
  const itemsPerPage = 10; // ✅ Items per page
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_DB_URL || 'http://localhost:5242/api';

  // Fetch all field engineers
  const fetchFieldEngineers = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/FieldEngineer`
      );
      if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`);
      const data = await response.json();
      setFieldEngineers(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching field engineers:', err);
      setError('Failed to fetch field engineers data.');
      setLoading(false);
    }
  };

  const handleProfileClick = (engineer: FieldEngineer) => {
    navigate(`/profile/${engineer.id}`, { state: { engineerData: engineer } });
  };

  // Initial load
  useEffect(() => {
    fetchFieldEngineers();
  }, []);

  // Real-time updates via socket
  useEffect(() => {
    const handleFEUpdate = (data: FieldEngineer) => {
      setFieldEngineers((prev) =>
        prev.map((fe) => (fe.id === data.id ? { ...fe, ...data } : fe))
      );
    };

    const handleNewFE = (data: FieldEngineer) => {
      setFieldEngineers((prev) =>
        prev.some((fe) => fe.id === data.id) ? prev : [...prev, data]
      );
    };

    subscribe('fieldEngineerUpdate', handleFEUpdate);
    subscribe('ReceiveNewFieldEngineer', handleNewFE);

    return () => {
      unsubscribe('fieldEngineerUpdate', handleFEUpdate);
      unsubscribe('ReceiveNewFieldEngineer', handleNewFE);
    };
  }, []);

  // Filters
  const filteredEngineers = fieldEngineers.filter((engineer) => {
    if (statusFilter && engineer.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return engineer.name.toLowerCase().includes(query);
    }
    return true;
  });

  // ✅ Pagination logic
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEngineers = filteredEngineers.slice(startIndex, endIndex);

  // ✅ Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  const getStatusCount = (status: string) =>
    fieldEngineers.filter(
      (fe) => fe.status.toLowerCase() === status.toLowerCase()
    ).length;

  const formatLastUpdated = (timestamp: string) =>
    new Date(timestamp).toLocaleString();

  // Sidebar color scheme consistency
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-500 text-white';
      case 'Location Off':
        return 'bg-yellow-500 text-white';
      case 'Logged In':
        return 'bg-blue-500 text-white';
      case 'Off-work':
        return 'bg-gray-400 text-white';
      case 'Inactive':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-400 text-white';
    }
  };

  return (
    <div className="min-h-screen bg-[#c8c87e] flex flex-col">
      <main className="flex-1 container mx-auto px-6 py-10">
        <Header activePage="fieldEngineers" />

        {/* Filter Section */}
        <div className="bg-white rounded-xl shadow-md p-5 mb-8 mt-9 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-gray-600 text-sm font-medium">Search</label>
              <input
                type="text"
                placeholder="Search by name..."
                className="input input-bordered w-full mt-1"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div>
              <label className="text-gray-600 text-sm font-medium">Status</label>
              <select
                className="select select-bordered w-full mt-1"
                value={statusFilter || ''}
                onChange={(e) => setStatusFilter(e.target.value || null)}
              >
                <option value="">All</option>
                <option value="Active">Active</option>
                <option value="Logged In">Logged In</option>
                <option value="Location Off">Location Off</option>
                <option value="Off-work">Off-work</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="flex items-center gap-3 mt-6 md:mt-8">
              <span className="badge badge-lg bg-green-500 text-white px-4 py-2 text-xs">
                Active: {getStatusCount('Active')}
              </span>
              <span className="badge badge-lg bg-blue-500 text-white px-4 py-2 text-xs">
                Logged In: {getStatusCount('Logged In')}
              </span>
              <span className="badge badge-lg bg-yellow-500 text-white px-4 py-2 text-xs">
                Location Off: {getStatusCount('Location Off')}
              </span>
              <span className="badge badge-lg bg-red-500 text-white px-4 py-2 text-xs">
                Inactive: {getStatusCount('Inactive')}
              </span>
            </div>
          </div>
        </div>

        {/* Data Section */}
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-lg text-primary"></span>
          </div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : filteredEngineers.length === 0 ? (
          <div className="p-10 bg-white rounded-xl text-center shadow-sm border border-gray-100 mt-8">
            <p className="text-gray-500 mb-3">
              {searchQuery || statusFilter
                ? 'No engineers match your filters.'
                : 'No engineers available.'}
            </p>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter(null);
              }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto bg-white rounded-xl shadow-md border border-gray-100 mt-8">
              <table className="table table-zebra w-full">
                <thead className="bg-[#6b6f1d]/95 text-white text-sm">
                  <tr>
                    <th>Profile</th>
                    <th>First Name</th>
                    <th>Last Name</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                    <th>Contact</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEngineers.map((engineer) => (
                    <tr key={engineer.id} className="hover:bg-gray-50 transition">
                      <td>
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="font-semibold text-gray-600">
                            {engineer.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="font-medium text-gray-800">{engineer.firstName}</td>
                      <td className="font-medium text-gray-800">{engineer.lastName}</td>
                      <td>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            engineer.status
                          )}`}
                        >
                          {engineer.status}
                        </span>
                      </td>
                      <td className="text-gray-500 text-sm">
                        {formatLastUpdated(engineer.updatedAt)}
                      </td>
                      <td className="text-sm">
                        {engineer.phone && (
                          <div className="text-gray-700">{engineer.phone}</div>
                        )}
                        {engineer.email && (
                          <div className="text-gray-500 truncate max-w-[180px]">
                            {engineer.email}
                          </div>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button className="btn btn-xs btn-outline text-blue-50 bg-[#6b6f1d]/95">
                            ✏️ Edit
                          </button>
                          <button
                            className="btn btn-xs btn-outline text-blue-50 bg-[#6b6f1d]/95"
                            onClick={() => handleProfileClick(engineer)}
                          >
                            👤 Profile
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            
          </>
        )}
      </main>
    </div>
  );
}

export default FEPage;
