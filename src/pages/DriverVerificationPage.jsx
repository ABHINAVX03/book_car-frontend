import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDriverProfile, uploadDriverDoc, updateDriverProfile } from '../services/api';
import { FiUploadCloud, FiCheckCircle, FiXCircle, FiInfo } from 'react-icons/fi';

const DriverVerificationPage = ({ toast }) => {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState({});

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const data = await getDriverProfile();
            setProfile(data);
        } catch (err) {
            toast.error("Failed to load driver profile");
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (docType, file) => {
        if (!file) return;
        
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            toast.error("Only JPG, PNG and PDF are allowed");
            return;
        }

        // Validate size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error("File size must be less than 5MB");
            return;
        }

        setUploading(prev => ({ ...prev, [docType]: true }));
        try {
            await uploadDriverDoc(docType, file);
            toast.success(`${docType.toUpperCase()} uploaded successfully`);
            loadProfile();
        } catch (err) {
            toast.error(`Upload failed: ${err.message}`);
        } finally {
            setUploading(prev => ({ ...prev, [docType]: false }));
        }
    };

    if (loading) return <div className="flex-center" style={{ height: '80vh' }}><span className="spinner" /></div>;

    const status = profile?.verificationStatus || 'PENDING';
    const isApproved = status === 'APPROVED';
    const isRejected = status === 'REJECTED';

    return (
        <div className="animate-page-enter max-w-4xl mx-auto p-6">
            <header className="mb-10 text-center">
                <h1 className="text-3xl font-bold mb-2">Vehicle Verification</h1>
                <p className="text-muted">Complete your profile to start accepting rides</p>
                
                <div className={`mt-6 inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${
                    isApproved ? 'bg-green-100 text-green-700' : 
                    isRejected ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                    {isApproved ? <FiCheckCircle className="mr-2" /> : isRejected ? <FiXCircle className="mr-2" /> : <FiInfo className="mr-2" />}
                    Status: {status}
                </div>

                {isRejected && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                        <strong>Reason for rejection:</strong> {profile.rejectionReason}
                    </div>
                )}
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Document Cards */}
                {[
                    { id: 'rc', label: 'Registration Certificate (RC)', url: profile?.rcUrl },
                    { id: 'license', label: 'Driving License', url: profile?.licenseUrl },
                    { id: 'insurance', label: 'Vehicle Insurance', url: profile?.insuranceUrl },
                    { id: 'profile-photo', label: 'Driver Profile Photo', url: profile?.profilePhotoUrl }
                ].map(doc => (
                    <div key={doc.id} className="premium-card p-6 flex flex-col items-center text-center">
                        <div className="mb-4">
                            {doc.url ? (
                                <div className="relative group">
                                    {doc.url.toLowerCase().endsWith('.pdf') ? (
                                        <div className="w-32 h-32 bg-red-50 rounded-xl flex flex-col items-center justify-center border-2 border-red-200">
                                            <span className="text-3xl mb-1">📄</span>
                                            <span className="text-[10px] font-bold text-red-600">PDF DOC</span>
                                            <a href={doc.url} target="_blank" rel="noreferrer" className="mt-2 text-[9px] underline text-red-500">View PDF</a>
                                        </div>
                                    ) : (
                                        <img src={doc.url} alt={doc.label} className="w-32 h-32 object-cover rounded-xl border-2 border-primary" />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex-center transition-all rounded-xl">
                                        <label className="cursor-pointer text-white text-xs font-bold">Replace</label>
                                        <input type="file" className="hidden" onChange={e => handleFileUpload(doc.id, e.target.files[0])} />
                                    </div>
                                </div>
                            ) : (
                                <div className="w-32 h-32 bg-surface-2 rounded-xl flex-center border-2 border-dashed border-muted">
                                    <FiUploadCloud className="text-3xl text-muted" />
                                </div>
                            )}
                        </div>
                        <h3 className="font-bold mb-1 text-sm">{doc.label}</h3>
                        <p className="text-xs text-muted mb-4">{doc.url ? 'Successfully Uploaded' : 'Not Uploaded'}</p>
                        
                        {!doc.url && (
                            <label className={`btn btn-sm ${uploading[doc.id] ? 'btn-ghost' : 'btn-primary'} cursor-pointer`}>
                                {uploading[doc.id] ? 'Uploading...' : 'Upload File'}
                                <input type="file" className="hidden" onChange={e => handleFileUpload(doc.id, e.target.files[0])} />
                            </label>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-12 text-center">
                <p className="text-xs text-muted">
                    Our admin team will review your documents within 24-48 hours.
                </p>
            </div>
        </div>
    );
};

export default DriverVerificationPage;
