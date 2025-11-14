import { useEffect, useState, useRef } from "react";
import type { OngoingRoute, FieldEngineer } from "../../types";


// Interface for the component's props
interface SidebarProps {
  ongoingRoutes: OngoingRoute[];
  fieldEngineers: FieldEngineer[];
  loading: boolean;
  error: string | null;
  onCollapseChange?: (collapsed: boolean) => void;
  onFieldEngineerSelect?: (fe: FieldEngineer | null) => void;
  ActivityMapCard: React.ComponentType<{ lat: number; lng: number }>;
  ActivityDriveMapCard: React.ComponentType<{ startLat: number; startLng: number; endLat: number; endLng: number }>;
}

function Sidebar({

  fieldEngineers,
  loading,
  error,
  onCollapseChange,
  onFieldEngineerSelect,
}: SidebarProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedFE, setSelectedFE] = useState<FieldEngineer | null>(null);
  const [activeTab, setActiveTab] = useState<"branches" | "engineers">("engineers");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Lazy loading states
  const [displayedEngineers, setDisplayedEngineers] = useState<FieldEngineer[]>([]);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20; // Load 20 items at a time
  const observerTarget = useRef<HTMLDivElement>(null);


  const handleToggle = async () => {
  const newState = !sidebarCollapsed;
  setSidebarCollapsed(newState);
  if (onCollapseChange) {
    onCollapseChange(newState);
  }


};


  const filteredEngineers = fieldEngineers.filter((engineer) => {
    const matchesSearch =
      searchQuery === "" ||
      engineer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      engineer.status.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || engineer.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Reset displayed engineers when filters change
  useEffect(() => {
    setPage(1);
    setDisplayedEngineers(filteredEngineers.slice(0, ITEMS_PER_PAGE));
  }, [searchQuery, statusFilter, fieldEngineers.length]);

  // Load more engineers when page changes
  useEffect(() => {
    const startIndex = 0;
    const endIndex = page * ITEMS_PER_PAGE;
    setDisplayedEngineers(filteredEngineers.slice(startIndex, endIndex));
  }, [page]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          const hasMore = displayedEngineers.length < filteredEngineers.length;
          if (hasMore) {
            setPage((prev) => prev + 1);
          }
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [displayedEngineers.length, filteredEngineers.length, loading]);


  const handleFEClick = (fe: FieldEngineer) => {
    setSelectedFE(fe);
    if (onFieldEngineerSelect) {
      onFieldEngineerSelect(fe);
    }
  };

  const handleBackToList = async () => {
  setSelectedFE(null);
  if (onFieldEngineerSelect) {
    onFieldEngineerSelect(null);
  }

 
};


  const getStatusColor = (status: string) => {
  switch (status) {
    case "Active":
      return "bg-green-500"; // 🟢
    case "Location Off":
      return "bg-yellow-500"; // 🟠
    case "Logged In":
      return "bg-blue-500"; // 🔵
    case "Off-work":
      return "bg-gray-400"; // ⚪
    case "Inactive":
      return "bg-red-400"; // 🔴
    default:
      return "bg-red-500"; // fallback
  }
};



  const getStatusIcon = (status: string) => {
  switch (status) {
    case "Active":
      return "✅";
    case "Location Off":
      return "⚠️";
    case "Logged In":
      return "🔵";
    case "Off-work":
      return "🕓";
    case "Inactive":
      return "🔴";
    default:
      return "❓";
  }
};


  return (
    <aside
      className={`fixed right-0 top-0 h-full bg-[#6b6f1d]/95 backdrop-blur transition-all duration-300 z-40 flex flex-col shadow-2xl ${
        sidebarCollapsed ? "w-12" : "w-80"
      }`}
    >
      {/* Sidebar Toggle Button */}
      <div className="p-2 border-b border-white/10">
        <button
          onClick={handleToggle}
          className="w-full flex items-center justify-center p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className={`w-5 h-5 text-white transition-transform duration-300 ${
              sidebarCollapsed ? "rotate-180" : ""
            }`}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5"
            />
          </svg>
          {!sidebarCollapsed && (
            <span className="ml-2 text-white text-sm">Collapse</span>
          )}
        </button>
      </div>

      {/* Tab Navigation */}
      <div
        className={`p-2 border-b border-white/10 transition-all duration-300 ${
          sidebarCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <div className="flex gap-2">
          <button
            onClick={() => {
              setActiveTab("engineers");
              handleBackToList(); // Use the new handler
            }}
            className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg transition-colors ${
              activeTab === "engineers"
                ? "bg-white/20 text-white"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
              />
            </svg>
            <span className="text-xs font-medium">Engineers</span>
            <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {fieldEngineers.length}
            </span>
          </button>

          
        </div>
      </div>

      {/* Ongoing Routes Summary */}
      {/* <div
        className={`p-2 border-b border-white/10 transition-all duration-300 ${
          sidebarCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <div className="flex items-center p-2 rounded-lg bg-orange-500/20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5 text-orange-300"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
            />
          </svg>
          <span className="ml-2 text-orange-300 text-sm flex-1">
            Ongoing Routes
          </span>
          <span className="bg-orange-500/30 text-orange-300 text-xs px-2 py-0.5 rounded-full">
            {ongoingRoutes.length}
          </span>
        </div>
      </div> */}

      {/* Expanded Content */}
      <div
        className={`flex-1 overflow-hidden transition-all duration-300 ${
          sidebarCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        {/* Search Bar */}
        <div className="p-3 border-b border-white/10">
          <div className="relative">
            <input
              type="text"
              placeholder={
                activeTab === "engineers"
                  ? "Search engineers..."
                  : "Search branches..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-sm input-bordered w-full bg-white/20 text-white placeholder-white/70 border-white/30 focus:border-white/50 pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
              >
                ×
              </button>
            )}
          </div>
          {/* Search only field engineers */}
          {searchQuery && (
            <div className="mt-2 text-xs text-white/70">
              {activeTab === "engineers"
                ? `Found ${filteredEngineers.length} of ${fieldEngineers.length} engineers`
                : `Found ${filteredEngineers.length} of ${fieldEngineers.length} branches`}
            </div>
          )}
        </div>


        {/* ✅ Status Filter */}
<div className="flex flex-wrap gap-3 mt-3 text-xs text-white">
  {[
    { label: "All", value: "all", color: "radio-success" },
    { label: "Active", value: "Active", color: "radio-success" },
    { label: "Location Off", value: "Location Off", color: "radio-warning" },
    { label: "Logged In", value: "Logged In", color: "radio-info" },
    { label: "Off-work", value: "Off-work", color: "radio-gray-400" },
    { label: "Inactive", value: "Inactive", color: "radio-error" },
  ].map(({ label, value, color }) => (
    <label key={value} className="flex items-center gap-1 cursor-pointer">
      <input
        type="radio"
        name="statusFilter"
        className={`radio radio-sm ${color}`}
        checked={statusFilter === value}
        onChange={() => setStatusFilter(value)}
      />
      {label}
    </label>
  ))}
</div>


<aside
  className={`fixed right-0 top-63 h-full max-h-screen bg-[#6b6f1d]/95 backdrop-blur transition-all duration-300 z-40 flex flex-col shadow-2xl ${
    sidebarCollapsed ? "w-12" : "w-80"
  }`}
>
        {/* Content Area NO BRANCHES */}
        <div className="flex-1 overflow-y-scroll p-3 space-y-3">
          {loading && activeTab === "engineers" && displayedEngineers.length === 0 && (
  <div className="flex justify-center py-8">
    <span className="loading loading-spinner loading-md text-white"></span>
  </div>
)}
{error && activeTab === "engineers" && displayedEngineers.length === 0 && (
  <div className="alert alert-error">
    <span>{error}</span>
  </div>
)}

          {/* Field Engineers List - Use displayedEngineers instead of filteredEngineers */}
          {activeTab === "engineers" && !selectedFE && (
            <>
              {displayedEngineers.length === 0 && !loading ? (
                <div className="text-center text-white/70 py-8">
                  No engineers found
                </div>
              ) : (
                <>
                  {displayedEngineers.map((engineer) => {

                    const addressString = engineer.currentAddress || "Unknown location";

                    return (
                      <div
                        key={engineer.id}
                        onClick={() => handleFEClick(engineer)}
                        className="rounded-xl bg-white/10 hover:bg-white/20 p-3 shadow-lg backdrop-blur-sm cursor-pointer transition-all duration-200 border border-white/20"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 rounded-full ${getStatusColor(
                              engineer.status
                            )} flex items-center justify-center text-white font-bold text-lg relative`}
                          >
                            {engineer.name.charAt(0).toUpperCase()}
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center text-xs">
                              {getStatusIcon(engineer.status)}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-sm text-white truncate">
                              {engineer.name}
                            </h3>
                            <p className="text-xs text-white/80 mt-0.5">
                              {engineer.status}
                            </p>
                            <p className="text-[10px] text-white/60 mt-0.5">
                              {engineer.status === "Active"
                                ? `🕒 Updated: ${new Date(engineer.updatedAt).toLocaleString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true })}`
                                : `Last seen: 📍${addressString}`}
                            </p>
                          </div>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className="w-4 h-4 text-white/60"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8.25 4.5l7.5 7.5-7.5 7.5"
                            />
                          </svg>
                        </div>
                      </div>
                    );
                  })}

                  {/* Intersection Observer Target */}
                  <div ref={observerTarget} className="h-4" />

                  {/* Loading indicator for more items */}
                  {displayedEngineers.length < filteredEngineers.length && (
                    <div className="flex justify-center py-4">
                      <span className="loading loading-spinner loading-sm text-white"></span>
                    </div>
                  )}

                  {/* Count indicator */}
                  {displayedEngineers.length > 0 && (
                    <div className="text-center text-xs text-white/50 py-2">
                      Showing {displayedEngineers.length} of {filteredEngineers.length}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Field Engineer Details View */}
          {activeTab === "engineers" && selectedFE && (
            <div className="space-y-3">
              {/* Back Button */}
              <button
                onClick={handleBackToList} // Use the new handler
                className="flex items-center gap-2 text-white/80 hover:text-white text-sm"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 19.5L8.25 12l7.5-7.5"
                  />
                </svg>
                Back to list
              </button>

              {/* Engineer Profile Card */}
              <div className="rounded-xl bg-white/10 p-4 border border-white/20">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-16 h-16 rounded-full ${getStatusColor(
                      selectedFE.status
                    )} flex items-center justify-center text-white font-bold text-2xl`}
                  >
                    {selectedFE.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h2 className="font-bold text-lg text-white">
                      {selectedFE.name}
                    </h2>
                    <div
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        selectedFE.status
                      )} text-white mt-1`}
                    >
                      {getStatusIcon(selectedFE.status)} {selectedFE.status}
                    </div>
                  </div>
                </div>

                {/* Location Info */}
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-white/90">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5 flex-shrink-0 mt-0.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                      />
                    </svg>
                    <div className="flex-1">
                      <p className="text-xs font-medium mb-1">
                        Current Location
                      </p>
                      <p className="text-xs text-white/70">
                        {selectedFE.currentAddress || 'Unknown'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-white/90">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5 flex-shrink-0 mt-0.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="flex-1">
                      <p className="text-xs font-medium mb-1">Last Timed In:</p>
                      <p className="text-xs text-white/70">
  {selectedFE.timeIn
    ? new Date(selectedFE.timeIn).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "N/A"}
</p>


                    </div>
                  </div>

                  
                </div>
              </div>
            </div>
          )}

    
        </div>
        </aside>
      </div>
    </aside>
  );
}

export default Sidebar;