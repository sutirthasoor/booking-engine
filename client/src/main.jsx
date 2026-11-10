import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './context/ToastContext';
import { BookingProvider } from './context/BookingContext';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <BookingProvider>
          <App />
        </BookingProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
