import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import MiniHeader from './MiniHeader';
import ProgressBar from './ProgressBar';
import { FilterSidebar, MobileFilters } from './FilterSidebar';
import Footer from './Footer';
import SeoContent from './SeoContent';
import AmenitiesModal from './AmenitiesModal';
import BackToHotelsModal from './BackToHotelsModal';
import UpgradeModal from './UpgradeModal';
import OccupancyModal from './OccupancyModal';
import MultiRoomModal from './MultiRoomModal';
import { useBooking } from '../context/BookingContext';

const STEP_PERCENT = { '/rooms': 40, '/guest-details': 60, '/payment': 80, '/confirmation': 100 };

/** Shared chrome: header, progress bar, filter column, modals, footer. */
export default function Layout() {
  const { pathname } = useLocation();
  const { results } = useBooking();
  const onHotels = !STEP_PERCENT[pathname];

  const percent = onHotels ? (results.status === 'ready' || results.status === 'empty' ? 20 : 0) : STEP_PERCENT[pathname];

  return (
    <>
      {onHotels ? <Header /> : <MiniHeader />}

      <div className="container mx-auto px-4 py-8">
        <ProgressBar percent={percent} />

        <div className="flex flex-col lg:flex-row gap-8">
          <FilterSidebar visible={onHotels} />
          <MobileFilters />

          <div className="w-full lg:w-3/4 lg:mx-auto" style={{ width: onHotels ? '66.666667%' : '100%' }}>
            <Outlet />
          </div>
        </div>
      </div>

      <AmenitiesModal />
      <UpgradeModal />
      <MultiRoomModal />
      <OccupancyModal />
      <BackToHotelsModal />
      <SeoContent />
      <Footer />
    </>
  );
}
