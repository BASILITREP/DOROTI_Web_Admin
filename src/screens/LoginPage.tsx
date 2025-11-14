import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/api";
import { initializeSocket } from "../services/socketService"; // ✅ Import socket service
import logo from '../assets/equicomLogo.png';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!email || !email.includes("@")) {
        throw new Error("Please enter a valid email");
      }

      if (!password) {
        throw new Error("Please enter your password");
      }

      // ✅ Real API call to backend
      const response = await loginUser(email, password);

      // ✅ Store token and user info
      localStorage.setItem("token", response.token);
      localStorage.setItem("username", response.user.username || response.user.email.split("@")[0]);
      localStorage.setItem("role", response.user.isAdmin ? "admin" : "user");
      localStorage.setItem("userId", response.user.id);

      // ✅ Initialize socket connection AFTER successful login
      console.log('🔌 Initializing socket after login...');
      await initializeSocket();

      // Redirect to home / admin dashboard
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#6b6f1d]/95">
      <div className="w-full max-w-md p-8 space-y-4 bg-white shadow-lg rounded-lg">

        {/* ✅ Logo and Title Side by Side */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <img src={logo} alt="Equicom Logo" className="h-12 w-auto" />
          <h2 className="text-2xl font-bold">DOROTI Web Admin</h2>
        </div>

        {error && (
          <div className="p-2 text-sm text-red-700 bg-red-100 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Email</span>
            </label>
            <input
              type="email"
              placeholder="Enter your email"
              className="input input-bordered w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Password</span>
            </label>
            <input
              type="password"
              placeholder="Enter your password"
              className="input input-bordered w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className={`btn btn-primary w-full ${loading ? "loading" : ""}`}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
