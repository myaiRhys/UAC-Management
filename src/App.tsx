import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/context'
import Login from './auth/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import ClientEdit from './pages/ClientEdit'
import Orders from './pages/Orders'
import OrderEdit from './pages/OrderEdit'
import OrderPrint from './pages/OrderPrint'
import Production from './pages/Production'
import Products from './pages/Products'

function Gate() {
  const { session, loading } = useAuth()
  if (loading) return <p className="muted pad">Loading…</p>
  if (!session) return <Login />

  return (
    <Routes>
      {/* Print view sits outside the chrome so it prints clean. */}
      <Route path="/orders/:id/print" element={<OrderPrint />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/new" element={<OrderEdit />} />
        <Route path="/orders/:id" element={<OrderEdit />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/new" element={<ClientEdit />} />
        <Route path="/clients/:id" element={<ClientEdit />} />
        <Route path="/production" element={<Production />} />
        <Route path="/products" element={<Products />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  )
}
