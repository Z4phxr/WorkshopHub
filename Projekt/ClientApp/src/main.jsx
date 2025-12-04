import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import axios from 'axios'

// Initialize axios default Authorization header if jwt exists
const jwt = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
if (jwt) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
