import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Componente para crear tickets
const CrearTicket = ({ onTicketCreado }) => {
  const [formulario, setFormulario] = useState({
    titulo: '',
    descripcion: '',
    usuario_email: ''
  });
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const manejarSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    setMensaje('');

    try {
      const response = await axios.post(`${API}/tickets`, formulario);
      setMensaje('🤖 Ticket creado y clasificado automáticamente por IA!');
      setFormulario({ titulo: '', descripcion: '', usuario_email: '' });
      onTicketCreado(response.data);
    } catch (error) {
      setMensaje('❌ Error al crear el ticket');
      console.error('Error:', error);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
        🎫 Crear Nuevo Ticket
      </h2>
      
      <form onSubmit={manejarSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Título del Problema
          </label>
          <input
            type="text"
            value={formulario.titulo}
            onChange={(e) => setFormulario({...formulario, titulo: e.target.value})}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ej: No puedo acceder al sistema"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descripción Detallada
          </label>
          <textarea
            value={formulario.descripcion}
            onChange={(e) => setFormulario({...formulario, descripcion: e.target.value})}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe el problema con el mayor detalle posible..."
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tu Email
          </label>
          <input
            type="email"
            value={formulario.usuario_email}
            onChange={(e) => setFormulario({...formulario, usuario_email: e.target.value})}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="tu@empresa.com"
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={cargando}
          className={`w-full py-3 px-6 rounded-lg font-medium transition-all ${
            cargando 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl'
          }`}
        >
          {cargando ? '🤖 Clasificando con IA...' : '🚀 Crear Ticket'}
        </button>
      </form>
      
      {mensaje && (
        <div className={`mt-4 p-4 rounded-lg ${
          mensaje.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {mensaje}
        </div>
      )}
    </div>
  );
};

// Componente para mostrar ticket individual
const TicketCard = ({ ticket }) => {
  const getPrioridadColor = (prioridad) => {
    switch(prioridad) {
      case 'Alta': return 'bg-red-100 text-red-800 border-red-200';
      case 'Media': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Baja': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEstadoColor = (estado) => {
    switch(estado) {
      case 'Nuevo': return 'bg-blue-100 text-blue-800';
      case 'En Progreso': return 'bg-orange-100 text-orange-800';
      case 'Resuelto': return 'bg-green-100 text-green-800';
      case 'Cerrado': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-100">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex-1">
          {ticket.titulo}
        </h3>
        <div className="flex gap-2 ml-4">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEstadoColor(ticket.estado)}`}>
            {ticket.estado}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPrioridadColor(ticket.prioridad)}`}>
            {ticket.prioridad}
          </span>
        </div>
      </div>
      
      <p className="text-gray-600 mb-4 line-clamp-3">
        {ticket.descripcion}
      </p>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="font-medium text-gray-500">Categoría:</span>
          <p className="text-gray-800">{ticket.categoria}</p>
        </div>
        <div>
          <span className="font-medium text-gray-500">Departamento:</span>
          <p className="text-gray-800">{ticket.departamento}</p>
        </div>
        <div>
          <span className="font-medium text-gray-500">Tiempo Est.:</span>
          <p className="text-gray-800">{ticket.tiempo_estimado}</p>
        </div>
        <div>
          <span className="font-medium text-gray-500">Usuario:</span>
          <p className="text-gray-800 truncate">{ticket.usuario_email}</p>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-100">
        <span className="text-xs text-gray-500">
          Creado: {new Date(ticket.fecha_creacion).toLocaleString('es-ES')}
        </span>
      </div>
    </div>
  );
};

// Componente de métricas/dashboard
const Dashboard = ({ metricas }) => {
  if (!metricas) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm">Total Tickets</p>
            <p className="text-3xl font-bold">{metricas.total_tickets}</p>
          </div>
          <div className="text-4xl opacity-80">🎫</div>
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-100 text-sm">Resueltos</p>
            <p className="text-3xl font-bold">{metricas.tickets_por_estado.Resuelto || 0}</p>
          </div>
          <div className="text-4xl opacity-80">✅</div>
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-100 text-sm">En Progreso</p>
            <p className="text-3xl font-bold">{metricas.tickets_por_estado['En Progreso'] || 0}</p>
          </div>
          <div className="text-4xl opacity-80">⚡</div>
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-red-100 text-sm">Alta Prioridad</p>
            <p className="text-3xl font-bold">{metricas.tickets_por_prioridad.Alta || 0}</p>
          </div>
          <div className="text-4xl opacity-80">🔥</div>
        </div>
      </div>
    </div>
  );
};

// Componente principal
function App() {
  const [tickets, setTickets] = useState([]);
  const [metricas, setMetricas] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState('tickets');

  const cargarTickets = async () => {
    try {
      const response = await axios.get(`${API}/tickets`);
      setTickets(response.data);
    } catch (error) {
      console.error('Error cargando tickets:', error);
    }
  };

  const cargarMetricas = async () => {
    try {
      const response = await axios.get(`${API}/metricas`);
      setMetricas(response.data);
    } catch (error) {
      console.error('Error cargando métricas:', error);
    }
  };

  const cargarDatos = async () => {
    setCargando(true);
    await Promise.all([cargarTickets(), cargarMetricas()]);
    setCargando(false);
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const manejarTicketCreado = (nuevoTicket) => {
    setTickets([nuevoTicket, ...tickets]);
    cargarMetricas();
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-6xl mb-4">🤖</div>
          <p className="text-xl text-gray-600">Cargando Soporte360...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="text-3xl">🎯</div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Soporte360
                </h1>
                <p className="text-gray-600 text-sm">Sistema inteligente de gestión de tickets</p>
              </div>
            </div>
            
            <nav className="flex space-x-4">
              <button
                onClick={() => setVista('tickets')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  vista === 'tickets' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                📋 Tickets
              </button>
              <button
                onClick={() => setVista('crear')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  vista === 'crear' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                ➕ Crear
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard */}
        <Dashboard metricas={metricas} />
        
        {/* Content based on selected view */}
        {vista === 'crear' && (
          <CrearTicket onTicketCreado={manejarTicketCreado} />
        )}
        
        {vista === 'tickets' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Tickets Recientes ({tickets.length})
              </h2>
              <button
                onClick={cargarDatos}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                🔄 Actualizar
              </button>
            </div>
            
            {tickets.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-semibold text-gray-600 mb-2">
                  No hay tickets aún
                </h3>
                <p className="text-gray-500 mb-4">
                  Crea tu primer ticket para comenzar
                </p>
                <button
                  onClick={() => setVista('crear')}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
                >
                  ➕ Crear Primer Ticket
                </button>
              </div>
            ) : (
              <div className="grid gap-6">
                {tickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-gray-500">
            <p>🤖 Potenciado por IA • Clasificación automática • Gestión inteligente</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;