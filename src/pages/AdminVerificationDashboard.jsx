import React, { useState, useEffect } from 'react';
import { getPendingDrivers, approveDriver, rejectDriver } from '../services/api';
import { FiCheck, FiX, FiEye } from 'react-icons/fi';

const AdminVerificationDashboard = ({ toast }) => {
    const [pendingDrivers, setPendingDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    useEffect(() => {
        loadPending();
    }, []);

    const loadPending = async () => {
        try {
            const data = await getPendingDrivers();
            setPendingDrivers(data.content || []);
        } catch (err) {
            toast.error("Failed to load pending drivers");
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        if (!window.confirm("Approve this driver? They will be able to go online immediately.")) return;
        try {
            await approveDriver(id);
            toast.success("Driver approved!");
            loadPending();
            setSelectedDriver(null);
        } catch (err) {
            toast.error("Action failed");
        }
    };

    const handleReject = async () => {
        if (!rejectionReason) return toast.error("Please provide a reason");
        try {
            await rejectDriver(selectedDriver.id, rejectionReason);
            toast.success("Driver rejected");
            setShowRejectModal(false);
            setRejectionReason('');
            loadPending();
            setSelectedDriver(null);
        } catch (err) {
            toast.error("Action failed");
        }
    };

    if (loading) return <div className="flex-center p-20"><span className="spinner" /></div>;

    return (
        <div className="max-w-7xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-8">Driver Verification Queue</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* List of Pending Drivers */}
                <div className="lg:col-span-1 space-y-4">
                    {pendingDrivers.length === 0 ? (
                        <div className="text-center p-10 bg-surface-1 rounded-xl">No pending drivers found.</div>
                    ) : (
                        pendingDrivers.map(driver => (
                            <div 
                                key={driver.id} 
                                className={`premium-card p-4 cursor-pointer transition-all ${selectedDriver?.id === driver.id ? 'border-primary bg-primary/5' : ''}`}
                                onClick={() => setSelectedDriver(driver)}
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="font-bold">{driver.user?.name || 'Unknown'}</div>
                                        <div className="text-xs text-muted">ID: {driver.id} | Vehicle: {driver.vehicleId}</div>
                                    </div>
                                    <FiEye className="text-muted" />
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Details Section */}
                <div className="lg:col-span-2">
                    {selectedDriver ? (
                        <div className="premium-card p-8 animate-fade-in">
                            <div className="flex justify-between mb-8">
                                <div>
                                    <h2 className="text-xl font-bold">{selectedDriver.user?.name}</h2>
                                    <p className="text-sm text-muted">Reviewing documents for vehicle: {selectedDriver.vehicleId}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button className="btn btn-primary btn-sm" onClick={() => handleApprove(selectedDriver.id)}>
                                        <FiCheck className="mr-1" /> Approve
                                    </button>
                                    <button className="btn btn-red btn-sm" onClick={() => setShowRejectModal(true)}>
                                        <FiX className="mr-1" /> Reject
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    { label: 'Profile Photo', url: selectedDriver.profilePhotoUrl },
                                    { label: 'Registration (RC)', url: selectedDriver.rcUrl },
                                    { label: 'License', url: selectedDriver.licenseUrl },
                                    { label: 'Insurance', url: selectedDriver.insuranceUrl }
                                ].map(doc => (
                                    <div key={doc.label}>
                                        <label className="label text-xs uppercase mb-2">{doc.label}</label>
                                        {doc.url ? (
                                            <a href={doc.url} target="_blank" rel="noreferrer" className="block">
                                                {doc.url.toLowerCase().endsWith('.pdf') ? (
                                                    <div className="w-full h-48 bg-red-50 rounded-xl flex flex-col items-center justify-center border-2 border-red-100 hover:bg-red-100 transition-colors">
                                                        <span className="text-4xl mb-2">📄</span>
                                                        <span className="text-sm font-bold text-red-600">VIEW PDF DOCUMENT</span>
                                                        <span className="text-[10px] text-red-400 mt-1">(Opens in new tab)</span>
                                                    </div>
                                                ) : (
                                                    <img src={doc.url} className="w-full h-48 object-cover rounded-xl border border-surface-2 hover:opacity-90 transition-opacity" />
                                                )}
                                            </a>
                                        ) : (
                                            <div className="w-full h-48 bg-surface-2 rounded-xl flex-center text-muted text-xs italic">Not Uploaded</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-center flex-col h-64 bg-surface-1 rounded-2xl text-muted">
                            <FiEye size={40} className="mb-4 opacity-20" />
                            <p>Select a driver from the queue to view documents</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Rejection Modal */}
            {showRejectModal && (
                <div className="modal-overlay flex-center">
                    <div className="modal-content max-w-md p-8 animate-zoom-in">
                        <h3 className="text-xl font-bold mb-4">Reject Verification</h3>
                        <p className="text-sm text-muted mb-6">Tell the driver why their documents were rejected.</p>
                        <textarea 
                            className="input-field min-h-[120px] mb-6"
                            placeholder="e.g. License photo is blurry, Insurance expired..."
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                        />
                        <div className="flex gap-4">
                            <button className="btn btn-ghost flex-1" onClick={() => setShowRejectModal(false)}>Cancel</button>
                            <button className="btn btn-red flex-1" onClick={handleReject}>Send Rejection</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminVerificationDashboard;
