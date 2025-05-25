import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Filter, TrendingUp, Database, Loader2, AlertCircle, Maximize, Minimize } from 'lucide-react';

const API_BASE_URL = 'http://47.84.49.111:3000';
const AVAILABLE_SYMBOLS = ["1HZ10V", "1HZ75V", "R_50", "R_75", "R_10", "R_25", "R_100", "1HZ50V", "1HZ100V", "1HZ25V"];
const RISK_LEVELS = [1, 2, 3, 4, 5];

// API service
const dataService = {
  async fetchData(symbol, risk, page = 1, limit = 200, sortBy = 'id', sortOrder = 1) {
    const response = await fetch(
      `${API_BASE_URL}/api/data/${risk}/${symbol}?page=${page}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}`
    );
    if (!response.ok) throw new Error('Failed to fetch data');
    return response.json();
  },

  async searchData(symbol, risk, searchTerm, page = 1, limit = 20) {
    const response = await fetch(
      `${API_BASE_URL}/api/data/${risk}/${symbol}/search?searchTerm=${encodeURIComponent(searchTerm)}&page=${page}&limit=${limit}`
    );
    if (!response.ok) throw new Error('Failed to search data');
    return response.json();
  },

  async getStats(symbol, risk) {
    const response = await fetch(`${API_BASE_URL}/api/data/${risk}/${symbol}/stats`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
  },

  async getCollections() {
    const response = await fetch(`${API_BASE_URL}/api/data/collections`);
    if (!response.ok) throw new Error('Failed to fetch collections');
    return response.json();
  }
};

// Data card component for grid - modified to color only when count is 1 and matches previous
const DataCard = React.memo(({ item, previousCount }) => {
  const getCardStyle = (count, prevCount) => {
    // Only color when current count is 1 AND it matches the previous count
    if (count === 1 && prevCount === 1) {
      return 'border-green-200 bg-green-50 text-green-700';
    }
    if (count ===prevCount) {
      return 'border-yellow-200 bg-yellow-50 text-yellow-700';
    }
    if (count ==1) {
      return 'border-blue-200 bg-blue-50 text-blue-700';
    }
    // Default styling for all other cases
    return 'border-gray-200 bg-gray-50 text-gray-600';
  };

  return (
    <div className={`aspect-square flex items-center justify-center p-2 rounded-md border text-center hover:shadow-md hover:scale-105 cursor-pointer transition-all duration-200 ${getCardStyle(item.count, previousCount)}`}>
      <div className="text-l font-bold">
        {item.count}
      </div>
    </div>
  );
});

// Stats component
const StatsPanel = ({ stats, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  if (!stats?.summary) return null;

  const { summary, countDistribution } = stats;

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <TrendingUp className="w-5 h-5 mr-2 text-blue-500" />
        Statistics
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{summary.totalRecords || 0}</div>
          <div className="text-sm text-gray-500">Total Records</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{Math.round(summary.avgCount || 0)}</div>
          <div className="text-sm text-gray-500">Avg Count</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">{summary.maxCount || 0}</div>
          <div className="text-sm text-gray-500">Max Count</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">{summary.maxId || 0}</div>
          <div className="text-sm text-gray-500">Max ID</div>
        </div>
      </div>

      {countDistribution && countDistribution.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-700 mb-3">Count Distribution</h4>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {countDistribution.map((dist) => (
              <div key={dist._id} className="text-center bg-gray-50 rounded p-2">
                <div className="text-sm font-medium text-gray-900">{dist._id}</div>
                <div className="text-xs text-gray-500">{dist.count} items</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Main component
const DataViewer = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('1HZ10V');
  const [selectedRisk, setSelectedRisk] = useState(1);
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState(1);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const observer = useRef();
  const containerRef = useRef();
  const dataGridRef = useRef();
  
  const lastDataElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !isSearching) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore, isSearching]);

  // Fullscreen functionality for data grid only
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (dataGridRef.current.requestFullscreen) {
        dataGridRef.current.requestFullscreen();
      } else if (dataGridRef.current.webkitRequestFullscreen) {
        dataGridRef.current.webkitRequestFullscreen();
      } else if (dataGridRef.current.msRequestFullscreen) {
        dataGridRef.current.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement || !!document.webkitFullscreenElement || !!document.msFullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Load stats when symbol/risk changes
  useEffect(() => {
    const loadStats = async () => {
      setStatsLoading(true);
      try {
        const statsData = await dataService.getStats(selectedSymbol, selectedRisk);
        setStats(statsData);
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setStatsLoading(false);
      }
    };
    
    if (selectedSymbol && selectedRisk) {
      loadStats();
    }
  }, [selectedSymbol, selectedRisk]);

  // Reset and load data when filters change
  useEffect(() => {
    setData([]);
    setPage(1);
    setHasMore(true);
    setError(null);
  }, [selectedSymbol, selectedRisk, sortBy, sortOrder, searchTerm]);

  // Load data when page changes or initial load
  useEffect(() => {
    if (!selectedSymbol || !selectedRisk) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        let response;
        if (searchTerm.trim()) {
          response = await dataService.searchData(selectedSymbol, selectedRisk, searchTerm, page);
        } else {
          response = await dataService.fetchData(selectedSymbol, selectedRisk, page, 1000, sortBy, sortOrder);
        }

        if (page === 1) {
          setData(response.data || []);
        } else {
          setData(prev => [...prev, ...(response.data || [])]);
        }

        setHasMore(response.pagination?.hasMore || false);
      } catch (err) {
        setError(err.message);
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedSymbol, selectedRisk, page, sortBy, sortOrder, searchTerm]);

  const handleSearch = (e) => {
    e.preventDefault();
    setIsSearching(!!searchTerm.trim());
    setPage(1);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setIsSearching(false);
  };

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-gray-50 p-4"
    >
      <div className="max-w-6xl mx-auto flex flex-col">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center mb-2">
              <Database className="w-8 h-8 mr-3 text-blue-500" />
              Data Viewer
            </h1>
            <p className="text-gray-600">Browse and search your tick data with conditional coloring</p>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Symbol</label>
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {AVAILABLE_SYMBOLS.map(symbol => (
                  <option key={symbol} value={symbol}>{symbol}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Risk Level</label>
              <select
                value={selectedRisk}
                onChange={(e) => setSelectedRisk(Number(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {RISK_LEVELS.map(risk => (
                  <option key={risk} value={risk}>{risk}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="id">ID</option>
                <option value="count">Count</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={1}>Ascending</option>
                <option value={-1}>Descending</option>
              </select>
            </div>
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by ID or count..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch(e)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Search
            </button>
            {isSearching && (
              <button
                onClick={clearSearch}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <StatsPanel stats={stats} isLoading={statsLoading} />

        {/* Info Panel */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-blue-500 mr-2" />
            <span className="text-blue-700 text-sm">
              Cards are highlighted in green only when the count is 1 and matches the previous count.
            </span>
          </div>
        </div>

        {/* Data Grid */}
        <div 
          ref={dataGridRef}
          className={`bg-white rounded-lg shadow-sm border flex-1 flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
        >
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">
              Data ({data.length} items)
              {isSearching && <span className="text-sm text-gray-500 ml-2">- Searching for "{searchTerm}"</span>}
            </h2>
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5 text-gray-600" />
              ) : (
                <Maximize className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-400 flex items-center">
              <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          <div className={`flex-1 overflow-y-auto p-4 ${isFullscreen ? 'h-full' : 'max-h-96'}`}>
            {data.length === 0 && !loading && (
              <div className="p-8 text-center text-gray-500">
                {isSearching ? 'No results found for your search' : 'No data available'}
              </div>
            )}

            {/* Responsive Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-40 gap-4">
              {data.map((item, index) => {
                // Get previous item's count for comparison
                const previousCount = index > 0 ? data[index - 1].count : null;
                
                if (data.length === index + 1) {
                  return (
                    <div ref={lastDataElementRef} key={`${item._id}-${index}`}>
                      <DataCard item={item} previousCount={previousCount} />
                    </div>
                  );
                } else {
                  return <DataCard key={`${item._id}-${index}`} item={item} previousCount={previousCount} />;
                }
              })}
            </div>

            {loading && (
              <div className="p-4 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-2" />
                <span className="text-gray-600">Loading more data...</span>
              </div>
            )}

            {!hasMore && data.length > 0 && (
              <div className="p-4 text-center text-gray-500 border-t mt-4">
                No more data to load
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataViewer;