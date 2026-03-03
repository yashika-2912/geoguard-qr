import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api.js';
import { 
  ShieldAlert, 
  ShieldCheck, 
  MapPin, 
  Lock, 
  Loader2, 
  ArrowRight,
  FileCheck,
  AlertCircle
} from 'lucide-react';

export default function Access({ user }) {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [location, setLocation] = useState(null);
  const [password, setPassword] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      (err) => {
        setError('Location access is required to verify your proximity.');
        setLoading(false);
      }
    );
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!location) return;

    setVerifying(true);
    setError('');
    try {
      const { data } = await api.post(`/documents/access/${id}`, {
        latitude: location.lat,
        longitude: location.lng,
        password,
        userId: user?.id
      });
      setResult(data);
    } catch (err) {
      setResult(err.response?.data || { status: 'denied', reason: 'Unknown error' });
    } finally {
      setVerifying(false);
    }
  };

  const handleDownload = () => {
    if (!result || result.status !== 'granted') return;
    
    const params = new URLSearchParams({
      latitude: location.lat.toString(),
      longitude: location.lng.toString(),
      password: password
    });
    
    window.location.href = `/api/documents/download/${id}?${params.toString()}`;
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      <p className="text-neutral-500 animate-pulse">Requesting location access...</p>
    </div>
  );

  if (result) {
    const isGranted = result.status === 'granted';
    return (
      <div className="max-w-md mx-auto mt-12">
        <div className={`p-8 rounded-2xl border shadow-sm text-center ${
          isGranted ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'
        }`}>
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
            isGranted ? 'bg-emerald-100' : 'bg-rose-100'
          }`}>
            {isGranted ? (
              <ShieldCheck className="w-12 h-12 text-emerald-600" />
            ) : (
              <ShieldAlert className="w-12 h-12 text-rose-600" />
            )}
          </div>
          
          <h1 className={`text-2xl font-bold mb-2 ${
            isGranted ? 'text-emerald-900' : 'text-rose-900'
          }`}>
            {isGranted ? 'Access Granted' : 'Access Denied'}
          </h1>
          
          <p className={`mb-8 ${isGranted ? 'text-emerald-700' : 'text-rose-700'}`}>
            {isGranted 
              ? `You have successfully verified your identity and location for "${result.filename}".`
              : `Verification failed: ${result.reason}`
            }
          </p>

          {isGranted ? (
            <button 
              onClick={handleDownload}
              className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
            >
              <FileCheck className="w-5 h-5" />
              Download Document
            </button>
          ) : (
            <button 
              onClick={() => setResult(null)}
              className="w-full py-4 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
            <Lock className="w-10 h-10 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Secure Access</h1>
          <p className="text-neutral-500 text-sm text-center">
            This document is protected by GeoGuard. Please verify your location and password.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-100 text-amber-700 text-sm rounded-xl flex gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-xl border border-neutral-100">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <MapPin className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Your Location</p>
              <p className="text-sm font-semibold text-neutral-900">
                {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Detecting...'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Access Password (if required)</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={verifying || !location}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                Verify & Access
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
