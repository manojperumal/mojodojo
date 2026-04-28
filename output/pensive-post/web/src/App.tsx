import { Routes, Route, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import BrandPicker from './pages/BrandPicker'
import AmountCard from './pages/AmountCard'
import Personalise from './pages/Personalise'
import Delivery from './pages/Delivery'
import Preview from './pages/Preview'
import Review from './pages/Review'
import Confirmation from './pages/Confirmation'
import GiftDetail from './pages/GiftDetail'
import RecipientView from './pages/RecipientView'
import Login from './pages/Login'
import Register from './pages/Register'

const SENDER_FLOW_PATHS = ['/', '/brand', '/amount', '/personalise', '/delivery', '/preview', '/review', '/sent']

function AppRoutes() {
  const location = useLocation()
  const showLayout = SENDER_FLOW_PATHS.includes(location.pathname) || location.pathname.startsWith('/gift/')

  return (
    <Layout showTopBar={showLayout}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/brand" element={<BrandPicker />} />
        <Route path="/amount" element={<AmountCard />} />
        <Route path="/personalise" element={<Personalise />} />
        <Route path="/delivery" element={<Delivery />} />
        <Route path="/preview" element={<Preview />} />
        <Route path="/review" element={<Review />} />
        <Route path="/sent" element={<Confirmation />} />
        <Route path="/gift/:id" element={<GiftDetail />} />
        <Route path="/r/:token" element={<RecipientView />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return <AppRoutes />
}
