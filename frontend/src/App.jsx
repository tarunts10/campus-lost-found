/**
 * App.jsx — the route table.
 *
 * Everything renders inside MainLayout via <Outlet />, so the navbar and
 * footer persist across navigation and never re-mount.
 *
 * Pages requiring a login are wrapped in <ProtectedRoute>. That is a UX
 * convenience — the backend independently rejects unauthenticated
 * requests, and remains the only real authority.
 */

import { Route, Routes } from 'react-router-dom';

import MainLayout from './layouts/MainLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import CustomCursor from './components/CustomCursor.jsx';

import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ItemsPage from './pages/ItemsPage.jsx';
import ItemDetailPage from './pages/ItemDetailPage.jsx';
import ReportItemPage from './pages/ReportItemPage.jsx';
import MyItemsPage from './pages/MyItemsPage.jsx';
import MyClaimsPage from './pages/MyClaimsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <>
      {/* Desktop-only pointer effect; renders nothing on touch devices. */}
      <CustomCursor />

      <Routes>
        <Route element={<MainLayout />}>
          {/* Public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/*
            Browsing requires a login because the backend protects
            GET /api/items — the product brief says only verified college
            members may use the application.
          */}
          <Route
            path="/items"
            element={
              <ProtectedRoute>
                <ItemsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/items/:id"
            element={
              <ProtectedRoute>
                <ItemDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/report"
            element={
              <ProtectedRoute>
                <ReportItemPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-items"
            element={
              <ProtectedRoute>
                <MyItemsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-claims"
            element={
              <ProtectedRoute>
                <MyClaimsPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}
