import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AAStarProvider } from './lib/AAStarProvider';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';

export const App: React.FC = () => (
  <AAStarProvider>
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  </AAStarProvider>
);
