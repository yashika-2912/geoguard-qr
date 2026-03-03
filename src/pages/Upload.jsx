import React, { useState } from 'react';
import api from '../utils/api.js';
import { 
  Upload as UploadIcon, 
  MapPin, 
  Maximize, 
  Calendar, 
  Lock, 
  Loader2, 
  QrCode, 
  Copy, 
  Check,
  Download
} from 'lucide-react';

export default function Upload({ user }) {
  const [formData, setFormData] = useState({
    filename: '',
    latitude: '',
    longitude: '',
    radius: '100',
    expiry: '',
    password: '',
    usePassword: false
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert('Please select a file to upload');
      return;
    }
    setLoading(true);
    
    const data = new FormData();
    data.append('file', file);
    data.append('filename', formData.filename || file.name);
    data.append('latitude', formData.latitude);
    data.append('longitude', formData.longitude);
    data.append('radius', formData.radius);
    data.append('expiry', formData.expiry);
    if (formData.usePassword) {
      data.append('password', formData.password);
    }

    try {
      const response = await api.post('/documents/upload', data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setResult(response.data);
    } catch (err) {
      console.error('Upload failed', err);
      alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result.accessUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setFormData(prev => ({
        ...prev,
        latitude: pos.coords.latitude.toString(),
        longitude: pos.coords.longitude.toString()
      }));
    });
  };

  if (result) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <QrCode className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Document Secured!</h1>
          <p className="text-neutral-500 mb-8">Your document is now protected with geo-fencing.</p>

          <div className="bg-neutral-50 p-6 rounded-2xl mb-8 flex flex-col items-center">
            <img src={result.qrCode} alt="QR Code" className="w-48 h-48 mb-4 border-4 border-white rounded-xl shadow-sm" />
            <p className="text-sm font-medium text-neutral-600 mb-4">Scan to access document</p>
            
            <div className="w-full flex items-center gap-2 bg-white border border-neutral-200 p-3 rounded-xl">
              <input 
                readOnly 
                value={result.accessUrl} 
                className="flex-1 bg-transparent text-sm text-neutral-600 outline-none"
              />
              <button 
                onClick={handleCopy}
                className="p-2 hover:bg-neutral-50 rounded-lg transition-colors text-indigo-600"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => setResult(null)}
              className="flex-1 py-3 border border-neutral-200 rounded-xl font-semibold hover:bg-neutral-50 transition-all"
            >
              Upload Another
            </button>
            <a 
              href={result.qrCode} 
              download="document-qr.png"
              className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download QR
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
            <UploadIcon className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Secure New Document</h1>
            <p className="text-neutral-500 text-sm">Set location and expiry constraints for your file.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Select File</label>
            <div className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${file ? 'border-indigo-600 bg-indigo-50' : 'border-neutral-200 hover:border-indigo-400'}`}>
              <input
                type="file"
                required
                onChange={(e) => setFile(e.target.files[0])}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-2">
                <UploadIcon className={`w-8 h-8 ${file ? 'text-indigo-600' : 'text-neutral-400'}`} />
                <p className="text-sm font-medium text-neutral-600">
                  {file ? file.name : 'Click or drag file to upload'}
                </p>
                {file && <p className="text-xs text-neutral-400">{(file.size / 1024).toFixed(2)} KB</p>}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Document Name (Optional)</label>
            <input
              type="text"
              required
              value={formData.filename}
              onChange={(e) => setFormData({ ...formData, filename: e.target.value })}
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="e.g. Confidential Project Specs"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Latitude</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="number"
                  step="any"
                  required
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="0.0000"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Longitude</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="number"
                  step="any"
                  required
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="0.0000"
                />
              </div>
            </div>
          </div>

          <button 
            type="button"
            onClick={getCurrentLocation}
            className="text-indigo-600 text-sm font-semibold flex items-center gap-1 hover:underline"
          >
            <MapPin className="w-4 h-4" />
            Use my current location
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Radius (meters)</label>
              <div className="relative">
                <Maximize className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="number"
                  required
                  value={formData.radius}
                  onChange={(e) => setFormData({ ...formData, radius: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="100"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Expiry Date & Time</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="datetime-local"
                  required
                  value={formData.expiry}
                  onChange={(e) => setFormData({ ...formData, expiry: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="checkbox"
                checked={formData.usePassword}
                onChange={(e) => setFormData({ ...formData, usePassword: e.target.checked })}
                className="w-5 h-5 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-neutral-700 group-hover:text-neutral-900 transition-colors">Require password for access</span>
            </label>

            {formData.usePassword && (
              <div className="relative animate-in slide-in-from-top-2 duration-200">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Set access password"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Generate Secure QR Code'}
          </button>
        </form>
      </div>
    </div>
  );
}
