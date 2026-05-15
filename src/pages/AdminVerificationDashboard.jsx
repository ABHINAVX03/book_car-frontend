import React, { useState, useEffect, useCallback } from 'react';
import { getAllDriversByStatus, approveDriver, rejectDriver, blockDriver, unblockDriver } from '../services/api';
import { FiCheck, FiX, FiEye, FiClock, FiCheckCircle, FiXCircle, FiFileText, FiSlash, FiUnlock, FiActivity } from 'react-icons/fi';

const AdminVerificationDashboard = ({ toast }) => {
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [activeTab, setActiveTab] = useState('PENDING'); // PENDING, APPROVED, REJECTED
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [page, setPage] = useState(0);

    const loadDrivers = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await getAllDriversByStatus(activeTab, page);
            setDrivers(data.content || []);
        } catch (err) {
            if (!silent) toast.error("Failed to load drivers");
        } finally {
            if (!silent) setLoading(false);
        }
    }, [activeTab, page, toast]);

    useEffect(() => {
        loadDrivers();
    }, [loadDrivers]);

    // Polling for real-time updates (every 15 seconds)
    useEffect(() => {
        const interval = setInterval(() => {
            loadDrivers(true);
        }, 15000);
        return () => clearInterval(interval);
    }, [loadDrivers]);

    const handleApprove = async (id) => {
        if (!window.confirm("Approve this driver? They will be notified and can go online.")) return;
        try {
            await approveDriver(id);
            toast.success("Driver approved!");
            loadDrivers();
            setSelectedDriver(null);
        } catch (err) {
            toast.error("Approval failed");
        }
    };

    const handleReject = async () => {
        if (!rejectionReason) return toast.error("Please provide a reason");
        try {
            await rejectDriver(selectedDriver.id, rejectionReason);
            toast.success("Driver rejected");
            setShowRejectModal(false);
            setRejectionReason('');
            loadDrivers();
            setSelectedDriver(null);
        } catch (err) {
            toast.error("Rejection failed");
        }
    };

    const handleBlock = async (id) => {
        if (!window.confirm("CRITICAL: Block this driver? They will be force-disconnected and cannot take rides.")) return;
        try {
            await blockDriver(id);
            toast.success("Driver BLOCKED successfully");
            loadDrivers();
            setSelectedDriver(prev => ({ ...prev, blocked: true, available: false }));
        } catch (err) {
            toast.error("Block action failed");
        }
    };

    const handleUnblock = async (id) => {
        try {
            await unblockDriver(id);
            toast.success("Driver unblocked");
            loadDrivers();
            setSelectedDriver(prev => ({ ...prev, blocked: false }));
        } catch (err) {
            toast.error("Unblock action failed");
        }
    };

    const StatusTab = ({ id, label, icon: Icon, count }) => (
        <button
            onClick={() => { setActiveTab(id); setPage(0); setSelectedDriver(null); }}
            className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-all ${
                activeTab === id ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted hover:bg-surface-2'
            }`}
        >
            <Icon size={16} />
            <span className="font-bold">{label}</span>
            {count !== undefined && <span className="ml-2 px-2 py-0.5 bg-surface-3 rounded-full text-[10px]">{count}</span>}
        </button>
    );

    const DocumentPreview = ({ label, url }) => {
        if (!url) return <div className="w-full h-48 bg-surface-2 rounded-xl flex-center text-muted italic text-xs">Not Uploaded</div>;

        const isPdf = url.toLowerCase().endsWith('.pdf');

        return (
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] uppercase font-black text-muted tracking-widest">{label}</label>
                    <a href={url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-primary hover:underline">Open Original</a>
                </div>
                <div className="relative group">
                    {isPdf ? (
                        <div className="w-full h-80 bg-surface-3 rounded-xl border border-surface-2 overflow-hidden relative">
                            {/* Using object tag as it often handles cross-domain better than iframe */}
                            <object
                                data={url}
                                type="application/pdf"
                                className="w-full h-full border-none"
                            >
                                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                                    <span className="text-4xl mb-2">📄</span>
                                    <p className="text-xs font-bold text-red-500 mb-4">Native Preview Blocked</p>
                                    <a href={url} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">Download to View PDF</a>
                                </div>
                            </object>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <a href={url} target="_blank" rel="noreferrer" className="btn btn-dark btn-xs bg-black/80 backdrop-blur-md border-none">
                                    Popout Preview
                                </a>
                            </div>
                        </div>
                    ) : (
                        <a href={url} target="_blank" rel="noreferrer" className="block relative">
                            <img src={url} alt={label} className="w-full h-56 object-cover rounded-xl border border-surface-2 hover:brightness-90 transition-all" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex-center transition-all rounded-xl text-white text-xs font-bold">
                                View Full Image
                            </div>
                        </a>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto p-6 animate-page-enter">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Verification Control</h1>
                    <p className="text-muted">Manage driver onboarding and document approvals</p>
                </div>
                <div className="text-right">
                    <div className="text-xs text-muted mb-1 flex items-center justify-end gap-1 font-bold">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        LIVE MONITORING ACTIVE
                    </div>
                </div>
            </div>

            {/* Quick Summary Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="card p-5 bg-orange-50 border-orange-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white flex-center shadow-lg shadow-orange-500/20">
                        <FiClock size={24} />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Pending Review</div>
                        <div className="text-2xl font-bold text-orange-900">{activeTab === 'PENDING' ? drivers.length : '...'}</div>
                    </div>
                </div>
                <div className="card p-5 bg-blue-50 border-blue-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500 text-white flex-center shadow-lg shadow-blue-500/20">
                        <FiCheckCircle size={24} />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Approved Drivers</div>
                        <div className="text-2xl font-bold text-blue-900">{activeTab === 'APPROVED' ? drivers.length : '...'}</div>
                    </div>
                </div>
                <div className="card p-5 bg-red-50 border-red-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-500 text-white flex-center shadow-lg shadow-red-500/20">
                        <FiXCircle size={24} />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-red-600 uppercase tracking-widest">Rejected / Blocked</div>
                        <div className="text-2xl font-bold text-red-900">{activeTab === 'REJECTED' ? drivers.length : '...'}</div>
                    </div>
                </div>
            </div>

            {/* Status Tabs */}
            <div className="flex border-b border-surface-2 mb-8 overflow-x-auto">
                <StatusTab id="PENDING" label="Pending Verification" icon={FiClock} />
                <StatusTab id="APPROVED" label="Verified Drivers" icon={FiCheckCircle} />
                <StatusTab id="REJECTED" label="Rejected Applications" icon={FiXCircle} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                {/* Table View */}
                <div className="xl:col-span-2 premium-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-surface-2 text-xs uppercase text-muted">
                                    <th className="px-6 py-4">Driver</th>
                                    <th className="px-6 py-4">Vehicle Details</th>
                                    <th className="px-6 py-4">Live Status</th>
                                    <th className="px-6 py-4">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-2">
                                {loading ? (
                                    <tr><td colSpan="4" className="px-6 py-10 text-center"><span className="spinner mx-auto" /></td></tr>
                                ) : drivers.length === 0 ? (
                                    <tr><td colSpan="4" className="px-6 py-10 text-center text-muted">No drivers found in this category.</td></tr>
                                ) : (
                                    drivers.map(driver => (
                                        <tr 
                                            key={driver.id} 
                                            className={`hover:bg-primary/5 transition-colors cursor-pointer ${selectedDriver?.id === driver.id ? 'bg-primary/5' : ''}`}
                                            onClick={() => setSelectedDriver(driver)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-bold flex items-center gap-2">
                                                   {driver.user?.name}
                                                   {driver.blocked && <FiSlash className="text-red-500" title="Blocked" />}
                                                </div>
                                                <div className="text-[10px] text-muted uppercase">ID: {driver.id}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm">{driver.vehicleId}</div>
                                                <div className="text-[10px] uppercase text-muted font-bold tracking-tighter">
                                                    {driver.vehicleType}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                   <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase inline-flex items-center gap-1 w-fit ${
                                                      driver.blocked ? 'bg-red-100 text-red-700' :
                                                      driver.available ? 'bg-green-100 text-green-700' : 'bg-surface-3 text-muted'
                                                   }`}>
                                                      {driver.blocked ? <><FiSlash size={8}/> Blocked</> : 
                                                       driver.available ? <><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"/> Online</> : 'Offline'}
                                                   </span>
                                                   <span className={`text-[9px] font-bold uppercase ${
                                                      driver.verificationStatus === 'APPROVED' ? 'text-blue-500' : 'text-orange-400'
                                                   }`}>
                                                      {driver.verificationStatus}
                                                   </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button className="btn btn-ghost btn-sm">Review</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Preview Panel */}
                <div className="xl:col-span-1">
                    {selectedDriver ? (
                        <div className="premium-card p-6 sticky top-24 animate-fade-in shadow-2xl border-primary/20">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-xl font-bold">{selectedDriver.user?.name}</h2>
                                    <p className="text-xs text-muted">Driver ID: {selectedDriver.id}</p>
                                </div>
                                <div className="flex gap-2">
                                    {selectedDriver.blocked ? (
                                        <button onClick={() => handleUnblock(selectedDriver.id)} className="btn btn-dark btn-sm flex items-center gap-1">
                                            <FiUnlock /> Unblock
                                        </button>
                                    ) : (
                                        <button onClick={() => handleBlock(selectedDriver.id)} className="btn btn-red btn-sm flex items-center gap-1">
                                            <FiSlash /> Block
                                        </button>
                                    )}
                                    {activeTab === 'PENDING' && (
                                        <>
                                            <button onClick={() => handleApprove(selectedDriver.id)} className="w-8 h-8 rounded-full bg-green-500 text-white flex-center hover:bg-green-600 transition-colors" title="Approve">
                                                <FiCheck />
                                            </button>
                                            <button onClick={() => setShowRejectModal(true)} className="w-8 h-8 rounded-full bg-red-500 text-white flex-center hover:bg-red-600 transition-colors" title="Reject Documents">
                                                <FiX />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center gap-4 p-3 bg-surface-2 rounded-xl mb-4">
                                   <div className={`w-3 h-3 rounded-full ${selectedDriver.blocked ? 'bg-red-500' : (selectedDriver.available ? 'bg-green-500 animate-pulse' : 'bg-gray-400')}`} />
                                   <div className="text-sm font-bold">
                                      {selectedDriver.blocked ? 'ACCOUNT BLOCKED' : (selectedDriver.available ? 'CURRENTLY ONLINE' : 'CURRENTLY OFFLINE')}
                                   </div>
                                </div>
                                <DocumentPreview label="Profile Photo" url={selectedDriver.profilePhotoUrl} />
                                <DocumentPreview label="Registration (RC)" url={selectedDriver.rcUrl} />
                                <DocumentPreview label="Driving License" url={selectedDriver.licenseUrl} />
                                <DocumentPreview label="Insurance Policy" url={selectedDriver.insuranceUrl} />
                            </div>

                            {selectedDriver.rejectionReason && (
                                <div className="mt-6 p-4 bg-red-50 rounded-xl border border-red-100">
                                    <label className="text-[10px] uppercase font-black text-red-600 mb-1 block">Rejection Reason</label>
                                    <p className="text-sm text-red-700 italic">"{selectedDriver.rejectionReason}"</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="premium-card p-12 text-center text-muted border-dashed border-2 border-surface-3 flex flex-col items-center">
                            <FiFileText size={48} className="mb-4 opacity-20" />
                            <p className="text-sm">Select a driver from the table to review documents</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Rejection Modal */}
            {showRejectModal && (
                <div className="modal-overlay flex-center">
                    <div className="modal-content max-w-md p-8 animate-zoom-in">
                        <h3 className="text-xl font-bold mb-4 text-red-600">Reject Application</h3>
                        <p className="text-sm text-muted mb-6">Provide clear feedback to the driver about what's wrong with their documents.</p>
                        <textarea 
                            className="input-field min-h-[120px] mb-6"
                            placeholder="e.g. License photo is blurry, Insurance expired on 12/2025..."
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            autoFocus
                        />
                        <div className="flex gap-4">
                            <button className="btn btn-ghost flex-1" onClick={() => setShowRejectModal(false)}>Cancel Review</button>
                            <button className="btn btn-red flex-1 font-bold" onClick={handleReject}>Confirm Rejection</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminVerificationDashboard;
