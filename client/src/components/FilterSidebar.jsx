import { useBooking } from '../context/BookingContext';
import { css } from '../utils/css';

const PRICES = [
  ['0-2000', 'Under ₹2,000'],
  ['2000-5000', '₹2,000 - ₹5,000'],
  ['5000-10000', '₹5,000 - ₹10,000'],
  ['10000+', 'Over ₹10,000'],
  ['', 'Any Price'],
];

/** Desktop filter sidebar + the (permanently hidden, as in the original) mobile filter panel. */
export function FilterSidebar({ visible }) {
  const { filters, results, applyFilters, clearAllFilters } = useBooking();

  return (
    <div className="hidden lg:block lg:w-1/4" style={{ display: visible ? 'block' : 'none' }}>
      <div className="filter-section sticky top-4" style={css('width: 250px;')}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-800">Filters</h3>
          <button onClick={clearAllFilters} className="text-sm text-blue-600 hover:text-blue-800">Clear all</button>
        </div>

        <div className="mb-6">
          <h4 className="font-medium text-gray-700 mb-3">Location</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            <label className="flex items-center">
              <input type="radio" name="location-filter" value="" className="mr-3"
                checked={filters.location === ''} onChange={() => applyFilters({ ...filters, location: '' })} />
              <span>All Locations</span>
            </label>
            <div id="location-filters">
              {results.locations.map((l) => (
                <label key={l} className="flex items-center">
                  <input type="radio" name="location-filter" value={l} className="mr-3"
                    checked={filters.location === l} onChange={() => applyFilters({ ...filters, location: l })} />
                  <span>{l}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="font-medium text-gray-700 mb-3">Price Range (per night)</h4>
          <div className="space-y-2">
            {PRICES.map(([value, label]) => (
              <label key={value || 'any'} className="flex items-center">
                <input type="radio" name="price-filter" value={value} className="mr-3"
                  checked={filters.price === value} onChange={() => applyFilters({ ...filters, price: value })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobileFilters() {
  const { filters, results, applyFilters, clearAllFilters } = useBooking();
  return (
    <div className="lg:hidden mb-4">
      <div id="mobile-filters-panel" className="hidden mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
        <div className="mb-6">
          <h4 className="font-medium text-gray-700 mb-3">Location</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            <label className="flex items-center">
              <input type="radio" name="mobile-location-filter" value="" className="mr-3"
                checked={filters.location === ''} onChange={() => applyFilters({ ...filters, location: '' })} />
              <span>All Locations</span>
            </label>
            <div id="mobile-location-filters">
              {results.locations.map((l) => (
                <label key={l} className="flex items-center">
                  <input type="radio" name="mobile-location-filter" value={l} className="mr-3"
                    checked={filters.location === l} onChange={() => applyFilters({ ...filters, location: l })} />
                  <span>{l}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="font-medium text-gray-700 mb-3">Price Range (per night)</h4>
          <div className="space-y-2">
            {PRICES.map(([value, label]) => (
              <label key={value || 'any'} className="flex items-center">
                <input type="radio" name="mobile-price-filter" value={value} className="mr-3"
                  checked={filters.price === value} onChange={() => applyFilters({ ...filters, price: value })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <button onClick={() => applyFilters(filters)} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium">
            Apply Filters
          </button>
          <button onClick={clearAllFilters} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium">
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
}
