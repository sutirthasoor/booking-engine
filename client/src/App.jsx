import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import HotelsPage from './pages/HotelsPage';
import RoomsPage from './pages/RoomsPage';
import GuestDetailsPage from './pages/GuestDetailsPage';
import PaymentPage from './pages/PaymentPage';
import ConfirmationPage from './pages/ConfirmationPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HotelsPage />} />
        <Route path="/kakkson_booking" element={<HotelsPage />} />
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/guest-details" element={<GuestDetailsPage />} />
        <Route path="/payment" element={<PaymentPage />} />
        <Route path="/confirmation" element={<ConfirmationPage />} />
        <Route path="*" element={<HotelsPage />} />
      </Route>
    </Routes>
  );
}
