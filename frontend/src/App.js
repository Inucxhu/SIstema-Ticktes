import React, { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, {
        username,
        password
      });
      
      const { access_token, user: userData } = response.data;
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Error al iniciar sesión' 
      };
    }
  };

  const register = async (userData) => {
    try {
      await axios.post(`${API}/auth/register`, userData);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Error al registrar usuario' 
      };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      register,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Notification Context
const NotificationContext = createContext();

const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now() + Math.random(),
      timestamp: new Date(),
      read: false,
      ...notification
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 49)]);
    setUnreadCount(prev => prev + 1);

    if (notification.type !== 'persistent' && notification.duration) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
      }, notification.duration);
    }
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAsRead = (id) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      removeNotification,
      markAsRead,
      markAllAsRead
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

// Login Component
const LoginForm = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(formData.username, formData.password);
    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🎯</div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Soporte360
          </h1>
          <p className="text-gray-600">Sistema inteligente de tickets</p>
          <p className="text-sm text-gray-500 mt-2">
            Ingresa con tu usuario y contraseña
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Usuario
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ingresa tu usuario"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ingresa tu contraseña"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl'
            }`}
          >
            {loading ? '⏳ Iniciando sesión...' : '🚀 Iniciar Sesión'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>¿No tienes acceso? Contacta a tu administrador para obtener credenciales.</p>
        </div>
      </div>
    </div>
  );
};

// Toast Component
const Toast = ({ notification, onClose, onMarkRead }) => {
  const getToastStyle = (type, priority) => {
    if (priority === 'Alta') {
      return 'bg-gradient-to-r from-red-500 to-red-600 text-white border-red-300';
    }
    
    switch (type) {
      case 'success':
        return 'bg-gradient-to-r from-green-500 to-green-600 text-white border-green-300';
      case 'warning':
        return 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white border-yellow-300';
      case 'error':
        return 'bg-gradient-to-r from-red-500 to-red-600 text-white border-red-300';
      case 'info':
        return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-300';
      default:
        return 'bg-white text-gray-800 border-gray-300 shadow-lg';
    }
  };

  const getIcon = (type, priority) => {
    if (priority === 'Alta') return '🚨';
    
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
      case 'ticket_created': return '🎫';
      case 'ticket_updated': return '🔄';
      default: return '🔔';
    }
  };

  return (
    <div className={`toast-notification flex items-start p-4 rounded-lg border shadow-lg max-w-sm ${getToastStyle(notification.type, notification.priority)}`}>
      <div className="flex-shrink-0 text-2xl mr-3">
        {getIcon(notification.type, notification.priority)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm mb-1">
          {notification.title}
        </div>
        <div className="text-sm opacity-90 line-clamp-2">
          {notification.message}
        </div>
        <div className="text-xs opacity-75 mt-2">
          {notification.timestamp.toLocaleTimeString('es-ES')}
        </div>
      </div>
      <div className="flex-shrink-0 ml-2 flex flex-col gap-1">
        {!notification.read && (
          <button
            onClick={() => onMarkRead(notification.id)}
            className="text-xs opacity-75 hover:opacity-100 underline"
          >
            Marcar leído
          </button>
        )}
        <button
          onClick={() => onClose(notification.id)}
          className="text-lg opacity-75 hover:opacity-100 leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
};

// Notification Container
const NotificationContainer = () => {
  const { notifications, removeNotification, markAsRead } = useNotifications();
  
  const visibleNotifications = notifications
    .filter(n => !n.read || n.type === 'persistent')
    .slice(0, 5);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3">
      {visibleNotifications.map((notification) => (
        <Toast
          key={notification.id}
          notification={notification}
          onClose={removeNotification}
          onMarkRead={markAsRead}
        />
      ))}
    </div>
  );
};

// Gestión de Usuarios Component (Solo para Master Admin y Admin)
const GestionUsuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [campanias, setCampanias] = useState([]);
  const [gruposSoporte, setGruposSoporte] = useState([]);
  const { addNotification } = useNotifications();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: 'Usuario final',
    campana: '',
    grupo_soporte: ''
  });

  const [editData, setEditData] = useState({
    email: '',
    password: '',
    role: '',
    campana: '',
    grupo_soporte: ''
  });

  useEffect(() => {
    cargarUsuarios();
    cargarCampanias();
    cargarGruposSoporte();
  }, []);

  const cargarUsuarios = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsuarios(response.data);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    }
  };

  const cargarCampanias = async () => {
    try {
      const response = await axios.get(`${API}/auth/campanias`);
      setCampanias(response.data);
      if (response.data.length > 0) {
        setFormData(prev => ({ ...prev, campana: response.data[0] }));
      }
    } catch (error) {
      console.error('Error cargando campañas:', error);
    }
  };

  const cargarGruposSoporte = async () => {
    try {
      const response = await axios.get(`${API}/auth/grupos-soporte`);
      setGruposSoporte(response.data);
      if (response.data.length > 0) {
        setFormData(prev => ({ ...prev, grupo_soporte: response.data[0] }));
      }
    } catch (error) {
      console.error('Error cargando grupos de soporte:', error);
    }
  };

  const crearUsuario = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userData = { ...formData };
      
      // Remove unnecessary fields based on role
      if (userData.role !== 'Usuario final') {
        delete userData.campana;
      }
      if (userData.role !== 'Soporte') {
        delete userData.grupo_soporte;
      }

      const response = await axios.post(`${API}/auth/register`, userData);
      
      addNotification({
        type: 'success',
        title: '✅ Usuario Creado',
        message: `Usuario ${userData.full_name} creado exitosamente`,
        duration: 5000
      });

      setFormData({
        username: '',
        email: '',
        password: '',
        full_name: '',
        role: 'Usuario final',
        campana: campanias[0] || '',
        grupo_soporte: gruposSoporte[0] || ''
      });

      setShowCreateForm(false);
      cargarUsuarios();
    } catch (error) {
      addNotification({
        type: 'error',
        title: '❌ Error al Crear Usuario',
        message: error.response?.data?.detail || 'No se pudo crear el usuario',
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  const abrirEditarUsuario = (usuario) => {
    setEditingUser(usuario);
    setEditData({
      email: usuario.email,
      password: '',
      role: usuario.role,
      campana: usuario.campana || (campanias.length > 0 ? campanias[0] : ''),
      grupo_soporte: usuario.grupo_soporte || (gruposSoporte.length > 0 ? gruposSoporte[0] : '')
    });
    setShowEditModal(true);
  };

  const actualizarUsuario = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updateData = {};
      
      // Only send fields that are different or password if provided
      if (editData.email !== editingUser.email) {
        updateData.email = editData.email;
      }
      
      if (editData.password.trim()) {
        updateData.password = editData.password;
      }

      if (editData.role !== editingUser.role) {
        updateData.role = editData.role;
      }

      // Handle campaign for end users
      if (editData.role === 'Usuario final' && editData.campana !== editingUser.campana) {
        updateData.campana = editData.campana;
      }

      // Handle support group for support users
      if (editData.role === 'Soporte' && editData.grupo_soporte !== editingUser.grupo_soporte) {
        updateData.grupo_soporte = editData.grupo_soporte;
      }

      if (Object.keys(updateData).length === 0) {
        addNotification({
          type: 'warning',
          title: '⚠️ Sin Cambios',
          message: 'No se detectaron cambios para actualizar',
          duration: 5000
        });
        setLoading(false);
        return;
      }

      await axios.put(`${API}/users/${editingUser.id}`, updateData);
      
      addNotification({
        type: 'success',
        title: '✅ Usuario Actualizado',
        message: `Usuario ${editingUser.full_name} actualizado exitosamente`,
        duration: 5000
      });

      setShowEditModal(false);
      setEditingUser(null);
      setEditData({ email: '', password: '', role: '', campana: '', grupo_soporte: '' });
      cargarUsuarios();
    } catch (error) {
      addNotification({
        type: 'error',
        title: '❌ Error al Actualizar',
        message: error.response?.data?.detail || 'No se pudo actualizar el usuario',
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  const eliminarUsuario = async (userId, userName) => {
    if (window.confirm(`¿Estás seguro de eliminar al usuario ${userName}?`)) {
      try {
        await axios.delete(`${API}/users/${userId}`);
        
        addNotification({
          type: 'success',
          title: '✅ Usuario Eliminado',
          message: `Usuario ${userName} eliminado exitosamente`,
          duration: 5000
        });

        cargarUsuarios();
      } catch (error) {
        addNotification({
          type: 'error',
          title: '❌ Error al Eliminar',
          message: error.response?.data?.detail || 'No se pudo eliminar el usuario',
          duration: 5000
        });
      }
    }
  };

  const getRoleColor = (role) => {
    switch(role) {
      case 'Administrador Maestro': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Administrador': return 'bg-red-100 text-red-800 border-red-200';
      case 'Soporte': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Usuario final': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">
          👥 Gestión de Usuarios ({usuarios.length})
        </h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          {showCreateForm ? '❌ Cancelar' : '➕ Crear Usuario'}
        </button>
      </div>

      {/* Modal de Edición */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowEditModal(false)}></div>
          <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              ✏️ Editar Usuario: {editingUser?.full_name}
            </h3>
            
            <form onSubmit={actualizarUsuario} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editData.email}
                    onChange={(e) => setEditData({...editData, email: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nueva Contraseña (dejar vacío para no cambiar)
                  </label>
                  <input
                    type="password"
                    value={editData.password}
                    onChange={(e) => setEditData({...editData, password: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Nueva contraseña..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rol
                  </label>
                  <select
                    value={editData.role}
                    onChange={(e) => setEditData({...editData, role: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="Usuario final">Usuario Final</option>
                    <option value="Soporte">Soporte</option>
                    {user?.role === 'Administrador Maestro' && (
                      <option value="Administrador">Administrador</option>
                    )}
                  </select>
                </div>

                {editData.role === 'Usuario final' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Campaña
                    </label>
                    <select
                      value={editData.campana}
                      onChange={(e) => setEditData({...editData, campana: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {campanias.map(campana => (
                        <option key={campana} value={campana}>{campana}</option>
                      ))}
                    </select>
                  </div>
                )}

                {editData.role === 'Soporte' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Grupo de Soporte
                    </label>
                    <select
                      value={editData.grupo_soporte}
                      onChange={(e) => setEditData({...editData, grupo_soporte: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {gruposSoporte.map(grupo => (
                        <option key={grupo} value={grupo}>{grupo}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2 px-4 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                    loading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {loading ? '⏳ Guardando...' : '💾 Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Crear Nuevo Usuario</h3>
          
          <form onSubmit={crearUsuario} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre Completo
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Usuario
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rol
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="Usuario final">Usuario Final</option>
                <option value="Soporte">Soporte</option>
                {user?.role === 'Administrador Maestro' && (
                  <option value="Administrador">Administrador</option>
                )}
              </select>
            </div>

            {formData.role === 'Usuario final' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Campaña
                </label>
                <select
                  value={formData.campana}
                  onChange={(e) => setFormData({...formData, campana: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {campanias.map(campana => (
                    <option key={campana} value={campana}>{campana}</option>
                  ))}
                </select>
              </div>
            )}

            {formData.role === 'Soporte' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grupo de Soporte
                </label>
                <select
                  value={formData.grupo_soporte}
                  onChange={(e) => setFormData({...formData, grupo_soporte: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {gruposSoporte.map(grupo => (
                    <option key={grupo} value={grupo}>{grupo}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-6 rounded-lg font-medium transition-all ${
                  loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg'
                }`}
              >
                {loading ? '⏳ Creando Usuario...' : '👤 Crear Usuario'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Detalles
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Creado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {usuarios.map((usuario) => (
                <tr key={usuario.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {usuario.full_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {usuario.email}
                        </div>
                        <div className="text-xs text-gray-400">
                          @{usuario.username}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getRoleColor(usuario.role)}`}>
                      {usuario.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {usuario.role === 'Usuario final' && usuario.campana && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 text-xs rounded">
                        📱 {usuario.campana}
                      </span>
                    )}
                    {usuario.role === 'Soporte' && usuario.grupo_soporte && (
                      <span className="bg-green-100 text-green-800 px-2 py-1 text-xs rounded">
                        🛠️ {usuario.grupo_soporte}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(usuario.created_at).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {usuario.id !== user?.id && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => abrirEditarUsuario(usuario)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          ✏️ Editar
                        </button>
                        {usuario.role !== 'Administrador Maestro' && (
                          <button
                            onClick={() => eliminarUsuario(usuario.id, usuario.full_name)}
                            className="text-red-600 hover:text-red-900"
                          >
                            🗑️ Eliminar
                          </button>
                        )}
                      </div>
                    )}
                    {usuario.role === 'Administrador Maestro' && usuario.id === user?.id && (
                      <span className="text-purple-600 font-medium">👑 Tú</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
const CrearTicket = ({ onTicketCreado }) => {
  const [formulario, setFormulario] = useState({
    titulo: '',
    descripcion: ''
  });
  const [cargando, setCargando] = useState(false);
  const { addNotification } = useNotifications();
  const { user } = useAuth();

  const manejarSubmit = async (e) => {
    e.preventDefault();
    
    if (!formulario.titulo.trim() || !formulario.descripcion.trim()) {
      addNotification({
        type: 'error',
        title: '❌ Campos Requeridos',
        message: 'Por favor completa todos los campos antes de enviar.',
        duration: 5000
      });
      return;
    }

    setCargando(true);

    try {
      const response = await axios.post(`${API}/tickets`, formulario);
      const nuevoTicket = response.data;
      
      addNotification({
        type: 'ticket_created',
        title: '🎫 Ticket Creado Exitosamente',
        message: `"${nuevoTicket.titulo}" clasificado como ${nuevoTicket.prioridad} prioridad por IA`,
        priority: nuevoTicket.prioridad,
        duration: 8000
      });

      if (nuevoTicket.prioridad === 'Alta') {
        setTimeout(() => {
          addNotification({
            type: 'warning',
            title: '🚨 Ticket de Alta Prioridad',
            message: `Requiere atención inmediata: ${nuevoTicket.titulo}`,
            priority: 'Alta',
            duration: 10000
          });
        }, 1000);
      }

      setFormulario({ titulo: '', descripcion: '' });
      
      if (onTicketCreado) {
        onTicketCreado(nuevoTicket);
      }
      
    } catch (error) {
      console.error('Error al crear ticket:', error);
      addNotification({
        type: 'error',
        title: '❌ Error al Crear Ticket',
        message: error.response?.data?.detail || 'No se pudo crear el ticket. Intenta nuevamente.',
        duration: 5000
      });
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
        🎫 Crear Nuevo Ticket
        {user && (
          <span className="ml-4 text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
            {user.campana}
          </span>
        )}
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
    </div>
  );
};

// Ticket Card Component
const TicketCard = ({ ticket, currentUser, onTicketUpdated }) => {
  const { addNotification } = useNotifications();
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  
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
      case 'Asignado': return 'bg-purple-100 text-purple-800';
      case 'En Progreso': return 'bg-orange-100 text-orange-800';
      case 'Resuelto': return 'bg-green-100 text-green-800';
      case 'Cerrado': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const asignarTicket = async () => {
    try {
      const response = await axios.post(`${API}/tickets/${ticket.id}/assign`);
      
      addNotification({
        type: 'ticket_updated',
        title: '📋 Ticket Asignado',
        message: `"${ticket.titulo}" ha sido asignado a ti`,
        duration: 5000
      });

      onTicketUpdated(response.data);
    } catch (error) {
      addNotification({
        type: 'error',
        title: '❌ Error al Asignar',
        message: 'No se pudo asignar el ticket.',
        duration: 5000
      });
    }
  };

  const cambiarEstado = async (nuevoEstado) => {
    try {
      const response = await axios.put(`${API}/tickets/${ticket.id}`, {
        estado: nuevoEstado
      });

      addNotification({
        type: 'ticket_updated',
        title: '🔄 Ticket Actualizado',
        message: `"${ticket.titulo}" cambió a estado: ${nuevoEstado}`,
        duration: 5000
      });

      if (nuevoEstado === 'Resuelto') {
        setTimeout(() => {
          addNotification({
            type: 'success',
            title: '🎉 Ticket Resuelto',
            message: `¡Excelente trabajo! El ticket "${ticket.titulo}" ha sido marcado como resuelto.`,
            duration: 8000
          });
        }, 500);
      }

      onTicketUpdated(response.data);
    } catch (error) {
      addNotification({
        type: 'error',
        title: '❌ Error al Actualizar',
        message: 'No se pudo actualizar el estado del ticket.',
        duration: 5000
      });
    }
  };

  const canAssign = (currentUser.role === 'Soporte' || currentUser.role === 'Administrador Maestro') && ticket.estado === 'Nuevo';
  const canUpdate = (currentUser.role === 'Soporte' || currentUser.role === 'Administrador Maestro') && 
                   (ticket.asignado_a === currentUser.id || currentUser.role === 'Administrador Maestro');

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
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
        <div>
          <span className="font-medium text-gray-500">Categoría:</span>
          <p className="text-gray-800">{ticket.categoria}</p>
        </div>
        <div>
          <span className="font-medium text-gray-500">Departamento:</span>
          <p className="text-gray-800">{ticket.departamento}</p>
        </div>
        <div>
          <span className="font-medium text-gray-500">Campaña:</span>
          <p className="text-gray-800">{ticket.campana || 'N/A'}</p>
        </div>
        <div>
          <span className="font-medium text-gray-500">Usuario:</span>
          <p className="text-gray-800 truncate">{ticket.usuario_email}</p>
        </div>
      </div>

      {/* Acciones para usuarios de Soporte y Master Admin */}
      {(currentUser.role === 'Soporte' || currentUser.role === 'Administrador Maestro') && (
        <div className="flex gap-2 mb-4">
          {canAssign && (
            <button
              onClick={asignarTicket}
              className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
            >
              📋 Tomar Ticket
            </button>
          )}
          {canUpdate && ticket.estado === 'Asignado' && (
            <button
              onClick={() => cambiarEstado('En Progreso')}
              className="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition-colors"
            >
              ⚡ Iniciar Trabajo
            </button>
          )}
          {canUpdate && ticket.estado === 'En Progreso' && (
            <button
              onClick={() => cambiarEstado('Resuelto')}
              className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
            >
              ✅ Marcar Resuelto
            </button>
          )}
          {canUpdate && ticket.estado === 'Resuelto' && (
            <button
              onClick={() => cambiarEstado('Cerrado')}
              className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
            >
              📁 Cerrar Ticket
            </button>
          )}
          {/* Master Admin puede resolver cualquier ticket directamente */}
          {currentUser.role === 'Administrador Maestro' && ticket.estado !== 'Resuelto' && ticket.estado !== 'Cerrado' && (
            <button
              onClick={() => cambiarEstado('Resuelto')}
              className="px-3 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600 transition-colors"
            >
              👑 Resolver Directo
            </button>
          )}
        </div>
      )}
      
      <div className="pt-4 border-t border-gray-100">
        <span className="text-xs text-gray-500">
          Creado: {new Date(ticket.fecha_creacion).toLocaleString('es-ES')}
        </span>
        {ticket.asignado_a && (
          <span className="text-xs text-gray-500 ml-4">
            {ticket.asignado_a === currentUser.id 
              ? (currentUser.role === 'Administrador Maestro' ? 'Asignado a ti (Master Admin)' : 'Asignado a ti')
              : 'Asignado a equipo'
            }
          </span>
        )}
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = ({ metricas, initialLoad, currentUser }) => {
  const { addNotification } = useNotifications();

  useEffect(() => {
    if (metricas && initialLoad && currentUser.role !== 'Usuario final') {
      const ticketsAltaPrioridad = metricas.tickets_por_prioridad.Alta || 0;
      if (ticketsAltaPrioridad >= 3) {
        addNotification({
          type: 'warning',
          title: '⚠️ Múltiples Tickets Críticos',
          message: `Hay ${ticketsAltaPrioridad} tickets de alta prioridad pendientes`,
          duration: 10000
        });
      }

      const ticketsNuevos = metricas.tickets_por_estado.Nuevo || 0;
      if (ticketsNuevos >= 5) {
        addNotification({
          type: 'info',
          title: '📥 Muchos Tickets Nuevos',
          message: `${ticketsNuevos} tickets nuevos esperando asignación`,
          duration: 8000
        });
      }
    }
  }, [metricas, addNotification, initialLoad, currentUser.role]);

  if (!metricas || currentUser.role === 'Usuario final') return null;

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

// Notification Bell
const NotificationBell = ({ onClick }) => {
  const { unreadCount } = useNotifications();

  return (
    <button
      onClick={onClick}
      className="relative p-2 text-gray-600 hover:text-gray-800 transition-colors"
    >
      <div className="relative">
        <div className="text-2xl">🔔</div>
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </div>
    </button>
  );
};

// Main App Component
function MainApp() {
  const [tickets, setTickets] = useState([]);
  const [metricas, setMetricas] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState('tickets');
  const [showNotifications, setShowNotifications] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const { user, logout } = useAuth();

  const cargarTickets = async () => {
    try {
      const response = await axios.get(`${API}/tickets`);
      setTickets(response.data);
    } catch (error) {
      console.error('Error cargando tickets:', error);
    }
  };

  const cargarMetricas = async () => {
    if (user.role === 'Usuario final') return;
    
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
    if (initialLoad) {
      setInitialLoad(false);
    }
  };

  useEffect(() => {
    if (user) {
      cargarDatos();
      
      const interval = setInterval(() => {
        cargarTickets();
        if (user.role !== 'Usuario final') {
          cargarMetricas();
        }
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [user]);

  const manejarTicketCreado = (nuevoTicket) => {
    setTickets([nuevoTicket, ...tickets]);
    if (user.role !== 'Usuario final') {
      cargarMetricas();
    }
  };

  const manejarTicketActualizado = (ticketActualizado) => {
    setTickets(tickets.map(t => t.id === ticketActualizado.id ? ticketActualizado : t));
    if (user.role !== 'Usuario final') {
      cargarMetricas();
    }
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

  const getRoleColor = (role) => {
    switch(role) {
      case 'Administrador Maestro': return 'bg-purple-100 text-purple-800';
      case 'Administrador': return 'bg-red-100 text-red-800';
      case 'Soporte': return 'bg-blue-100 text-blue-800';
      case 'Usuario final': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <NotificationContainer />
      
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
                <p className="text-gray-600 text-sm">Sistema inteligente con autenticación</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                  {user.role}
                </span>
                <span className="text-sm text-gray-600">
                  {user.username}
                </span>
              </div>
              
              <NotificationBell onClick={() => setShowNotifications(!showNotifications)} />
              
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
                {user.role === 'Usuario final' && (
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
                )}
                {(user.role === 'Administrador Maestro' || user.role === 'Administrador') && (
                  <button
                    onClick={() => setVista('usuarios')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      vista === 'usuarios' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    👥 Usuarios
                  </button>
                )}
              </nav>
              
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
              >
                🚪 Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard */}
        <Dashboard metricas={metricas} initialLoad={initialLoad} currentUser={user} />
        
        {/* Content based on selected view */}
        {vista === 'crear' && user.role === 'Usuario final' && (
          <CrearTicket onTicketCreado={manejarTicketCreado} />
        )}
        
        {vista === 'usuarios' && (user.role === 'Administrador Maestro' || user.role === 'Administrador') && (
          <GestionUsuarios />
        )}
        
        {vista === 'tickets' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {user.role === 'Usuario final' ? 'Mis Tickets' : 'Tickets del Sistema'} ({tickets.length})
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
                  {user.role === 'Usuario final' ? 'No tienes tickets aún' : 'No hay tickets en el sistema'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {user.role === 'Usuario final' ? 'Crea tu primer ticket para comenzar' : 'Los usuarios finales pueden crear tickets'}
                </p>
                {user.role === 'Usuario final' && (
                  <button
                    onClick={() => setVista('crear')}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
                  >
                    ➕ Crear Primer Ticket
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-6">
                {tickets.map((ticket) => (
                  <TicketCard 
                    key={ticket.id} 
                    ticket={ticket} 
                    currentUser={user}
                    onTicketUpdated={manejarTicketActualizado}
                  />
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
            <p>🔐 Autenticación JWT • 👥 Gestión de roles • 🤖 IA inteligente</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Main App Router
function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-6xl mb-4">⏳</div>
          <p className="text-xl text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return user ? <MainApp /> : <LoginForm />;
}

export default App;