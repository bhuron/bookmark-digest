import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Articles from './pages/Articles';
import ArticleViewer from './components/Articles/ArticleViewer';
import Tags from './pages/Tags';
import Settings from './pages/Settings';
import EPUB from './pages/EPUB';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Articles />} />
        <Route path="articles/:id" element={<ArticleViewer />} />
        <Route path="tags" element={<Tags />} />
        <Route path="settings" element={<Settings />} />
        <Route path="epub" element={<EPUB />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
