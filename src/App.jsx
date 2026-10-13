import { Navigate, Route, Routes } from 'react-router-dom';
import PrivateRoute from './routes/PrivateRoute.jsx';
import CameraPage from './pages/CameraPage.jsx';
import CaptureDetailPage from './pages/CaptureDetailPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LibraryPage from './pages/LibraryPage.jsx';
import LoginPage from './pages/LoginPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<PrivateRoute />}>
        <Route path="/camera" element={<CameraPage />} />
        <Route path="/galeria" element={<LibraryPage />} />
        <Route path="/galeria/:id" element={<CaptureDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
