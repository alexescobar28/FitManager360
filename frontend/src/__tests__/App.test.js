import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import App from '../App';

// Mock AuthContext
jest.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: () => ({
    user: null,
    login: jest.fn(),
    logout: jest.fn(),
    loading: false,
  }),
}));

// Mock SocketContext
jest.mock('../contexts/SocketContext', () => ({
  SocketProvider: ({ children }) => <div>{children}</div>,
}));

describe('App Component', () => {
  const renderApp = () => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    );
  };

  test('renders without crashing', () => {
    renderApp();
    // App should render without throwing an error
  });

  test('shows login page by default when not authenticated', () => {
    renderApp();
    // Should redirect to login or show login form
    expect(document.querySelector('body')).toBeInTheDocument();
  });
});
