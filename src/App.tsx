// src/App.tsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import HomePage from './screens/HomePage';
import FEPage from './screens/FEPage';
import ProfilePage from './screens/ProfilePage';
import LoginPage from './screens/LoginPage';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { initializeSocket, subscribe, unsubscribe } from './services/socketService';


/**
 * RequireAuth - a small wrapper component that protects its children.
 * If there's no token in localStorage, redirect to /login.
 */
const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const location = useLocation();
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};


function App() {
  useEffect(() => {
    // ✅ Only initialize socket if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('⏸️ Skipping socket initialization - user not authenticated');
      return;
    }

    let isMounted = true;

    const startSocket = async () => {
      try {
        console.log('⚙️ Initializing SignalR connection...');
        await initializeSocket();
      } catch (err) {
        console.error('⚠️ Socket initialization failed:', err);
        toast.error('Failed to connect to server.', { autoClose: 3000 });
      }
    };

    startSocket();

    const handleConnected = () => {
      if (!isMounted) return;
      console.log('🟢 Socket connected');
      toast.success('Connected to server ✅', { autoClose: 2000 });
    };

    const handleDisconnected = () => {
      if (!isMounted) return;
      console.log('🔴 Socket disconnected');
      toast.warning('Lost connection. Reconnecting...', { autoClose: 3000 });
    };

    const handleError = (err: any) => {
      if (!isMounted) return;
      console.error('⚠️ Socket error:', err);
      toast.error('Socket error occurred.', { autoClose: 3000 });
    };

    subscribe('connected', handleConnected);
    subscribe('disconnected', handleDisconnected);
    subscribe('error', handleError);

    return () => {
      isMounted = false;
      unsubscribe('connected', handleConnected);
      unsubscribe('disconnected', handleDisconnected);
      unsubscribe('error', handleError);
    };
  }, []); // ✅ Run once on mount

  return (
    <Router>
      <ToastContainer position="top-right" autoClose={5000} />

      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected: wrap pages you want only for authenticated users */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <HomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/field-engineers"
          element={
            <RequireAuth>
              <FEPage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/:id"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />

        {/* Fallback: redirect to home if route not found AND authenticated, else to login */}
        <Route
          path="*"
          element={
            localStorage.getItem('token') ? <Navigate to="/" /> : <Navigate to="/login" />
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
