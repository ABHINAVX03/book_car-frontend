import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDriverProfile, uploadDriverDoc, submitVerification } from '../services/api';
import { FiUploadCloud, FiCheckCircle, FiXCircle, FiInfo, FiRefreshCw } from 'react-icons/fi';

const MAX_UPLOAD_ATTEMPTS = 3;
const REQUIRED_DOCS = ['rc', 'license', 'insurance'];

const DriverVerificationPage = ({ toast }) => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState({});
    const [uploadErrors, setUploadErrors] = useState({});
    const [pendingRetry, setPendingRetry] = useState({});
    const [submitting, setSubmitting] = useState(false);

    const loadProfile = useCallback(async () => {
        try {
            const data = await getDriverProfile();
            setProfile(data);
            if (data?.vehicleVerified) {
                navigate('/driver', { replace: true });
            }
        } catch (err) {
            toast.error('Failed to load driver profile');
        } finally {
            setLoading(false);
        }
    }, [navigate, toast]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const validateFile = (file) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            return 'Only JPG, PNG, WebP and PDF are allowed';
        }
        if (file.size > 5 * 1024 * 1024) {
            return 'File size must be less than 5MB';
        }
        return null;
    };

    const handleFileUpload = async (docType, file, isRetry = false) => {
        if (!file) return;

        const validationError = validateFile(file);
        if (validationError) {
            toast.error(validationError);
            setUploadErrors((prev) => ({ ...prev, [docType]: validationError }));
            return;
        }

        setUploading((prev) => ({ ...prev, [docType]: true }));
        setUploadErrors((prev) => ({ ...prev, [docType]: null }));
        setPendingRetry((prev) => ({ ...prev, [docType]: null }));

        try {
            await uploadDriverDoc(docType, file, { maxAttempts: MAX_UPLOAD_ATTEMPTS });
            toast.success(`${docType.toUpperCase()} uploaded successfully`);
            await loadProfile();
        } catch (err) {
            const message = err.message || 'Upload failed. Please try again.';
            setUploadErrors((prev) => ({ ...prev, [docType]: message }));
            setPendingRetry((prev) => ({ ...prev, [docType]: file }));
            toast.error(`Upload failed: ${message}`);
        } finally {
            setUploading((prev) => ({ ...prev, [docType]: false }));
        }
    };

    const handleRetryUpload = (docType) => {
        const file = pendingRetry[docType];
        if (file) {
            handleFileUpload(docType, file, true);
        }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await submitVerification();
            toast.success('Documents submitted for review! We will notify you by email once approved.');
            await loadProfile();
        } catch (err) {
            toast.error(err.message || 'Submission failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-center" style={{ height: '80vh' }}>
                <span className="spinner" />
            </div>
        );
    }

    const status = profile?.verificationStatus || 'PENDING';
    const isApproved = Boolean(profile?.vehicleVerified) || status === 'APPROVED';
    const isRejected = status === 'REJECTED';
    const hasRequiredDocs =
        profile?.rcUrl && profile?.licenseUrl && profile?.insuranceUrl;
    const missingDocs = REQUIRED_DOCS.filter((doc) => {
        if (doc === 'rc') return !profile?.rcUrl;
        if (doc === 'license') return !profile?.licenseUrl;
        return !profile?.insuranceUrl;
    });
    const awaitingReview =
        Boolean(profile?.verificationSubmitted) &&
        status === 'PENDING' &&
        !isApproved;
    const canSubmit = hasRequiredDocs && !isApproved && !awaitingReview;

    const docCards = [
        { id: 'rc', label: 'Registration Certificate (RC)', url: profile?.rcUrl },
        { id: 'license', label: 'Driving License', url: profile?.licenseUrl },
        { id: 'insurance', label: 'Vehicle Insurance', url: profile?.insuranceUrl },
        { id: 'profile-photo', label: 'Driver Profile Photo', url: profile?.profilePhotoUrl, optional: true },
    ];

    return (
        <div className="animate-page-enter max-w-4xl mx-auto p-6">
            <header className="mb-10 text-center">
                <h1 className="text-3xl font-bold mb-2">Vehicle Verification</h1>
                <p className="text-muted">Upload your documents, submit for review, then go online from the driver panel</p>

                <div
                    className={`mt-6 inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${
                        isApproved
                            ? 'bg-green-100 text-green-700'
                            : isRejected
                              ? 'bg-red-100 text-red-700'
                              : awaitingReview
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-yellow-100 text-yellow-700'
                    }`}
                >
                    {isApproved ? (
                        <FiCheckCircle className="mr-2" />
                    ) : isRejected ? (
                        <FiXCircle className="mr-2" />
                    ) : (
                        <FiInfo className="mr-2" />
                    )}
                    Status: {isApproved ? 'APPROVED' : status}
                </div>

                {isRejected && profile?.rejectionReason && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm max-w-lg mx-auto">
                        <strong>Reason for rejection:</strong> {profile.rejectionReason}
                        <p className="mt-2 text-red-500">Please upload corrected documents and submit again.</p>
                    </div>
                )}
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {docCards.map((doc) => (
                    <div key={doc.id} className="premium-card p-6 flex flex-col items-center text-center">
                        <div className="mb-4 w-full">
                            {doc.url ? (
                                <div className="relative group mx-auto" style={{ width: 128 }}>
                                    {doc.url.toLowerCase().includes('.pdf') ? (
                                        <div className="w-32 h-32 bg-red-50 rounded-xl flex flex-col items-center justify-center border-2 border-red-200">
                                            <span className="text-3xl mb-1">📄</span>
                                            <span className="text-[10px] font-bold text-red-600">PDF DOC</span>
                                            <a
                                                href={doc.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="mt-2 text-[9px] underline text-red-500"
                                            >
                                                View PDF
                                            </a>
                                        </div>
                                    ) : (
                                        <img
                                            src={doc.url}
                                            alt={doc.label}
                                            className="w-32 h-32 object-cover rounded-xl border-2 border-primary"
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex-center transition-all rounded-xl">
                                        <label className="cursor-pointer text-white text-xs font-bold">
                                            Replace
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                                onChange={(e) =>
                                                    handleFileUpload(doc.id, e.target.files?.[0])
                                                }
                                            />
                                        </label>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-32 h-32 bg-surface-2 rounded-xl flex-center border-2 border-dashed border-muted mx-auto">
                                    <FiUploadCloud className="text-3xl text-muted" />
                                </div>
                            )}
                        </div>
                        <h3 className="font-bold mb-1 text-sm">{doc.label}</h3>
                        {doc.optional && (
                            <p className="text-[10px] text-muted mb-1">Optional</p>
                        )}
                        <p className="text-xs text-muted mb-4">
                            {doc.url ? 'Successfully uploaded' : 'Not uploaded'}
                        </p>

                        {uploadErrors[doc.id] && (
                            <div className="w-full mb-3 p-3 rounded-lg bg-red-50 border border-red-100 text-left">
                                <p className="text-xs text-red-600 font-semibold">{uploadErrors[doc.id]}</p>
                                {pendingRetry[doc.id] && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-ghost mt-2 text-red-700"
                                        onClick={() => handleRetryUpload(doc.id)}
                                        disabled={uploading[doc.id]}
                                    >
                                        <FiRefreshCw className="inline mr-1" />
                                        {uploading[doc.id] ? 'Retrying...' : 'Retry upload'}
                                    </button>
                                )}
                            </div>
                        )}

                        {!doc.url && (
                            <label
                                className={`btn btn-sm ${uploading[doc.id] ? 'btn-ghost' : 'btn-primary'} cursor-pointer`}
                            >
                                {uploading[doc.id] ? 'Uploading...' : 'Upload file'}
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/jpeg,image/png,image/webp,application/pdf"
                                    onChange={(e) => handleFileUpload(doc.id, e.target.files?.[0])}
                                    disabled={uploading[doc.id]}
                                />
                            </label>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-12">
                {!hasRequiredDocs && !isApproved && (
                    <div className="premium-card p-8 mb-8 bg-primary/5 border-2 border-primary/20 text-center">
                        <h3 className="text-xl font-bold mb-2">Complete your profile</h3>
                        <p className="text-muted mb-6 max-w-lg mx-auto">
                            Upload your Registration Certificate, Driving License, and Insurance Policy to
                            enable submission.
                        </p>
                        <button
                            type="button"
                            className="btn btn-primary px-12 py-4 text-lg font-bold opacity-50 cursor-not-allowed"
                            disabled
                        >
                            Submit for verification
                        </button>
                        {missingDocs.length > 0 && (
                            <p className="text-xs text-orange-500 mt-4 font-bold flex items-center justify-center gap-1">
                                <FiInfo /> Missing: {missingDocs.join(', ')}
                            </p>
                        )}
                    </div>
                )}

                {canSubmit && (
                    <div className="premium-card p-10 mb-8 bg-green-50 border-2 border-green-200 text-center">
                        <div className="emoji-large mb-4">🚀</div>
                        <h3 className="text-2xl font-bold mb-2 text-green-800">Ready for submission</h3>
                        <p className="text-green-600 mb-8">
                            All required documents are uploaded. Submit them for admin review.
                        </p>
                        <button
                            type="button"
                            className="btn btn-primary px-12 py-4 text-xl font-black shadow-2xl hover:scale-105 transition-all"
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <>
                                    <span className="spinner mr-2" /> Submitting...
                                </>
                            ) : (
                                'Submit documents for verification'
                            )}
                        </button>
                    </div>
                )}

                {awaitingReview && (
                    <div className="premium-card p-10 mb-8 bg-blue-50 border-2 border-blue-200 text-center">
                        <div className="emoji-large mb-4">⏳</div>
                        <h3 className="text-2xl font-bold mb-2 text-blue-800">Verification in progress</h3>
                        <p className="text-blue-600 mb-0">
                            Our team is reviewing your documents. You will receive an email when a decision is
                            made (usually within 24–48 hours).
                        </p>
                    </div>
                )}

                {isApproved && (
                    <div className="premium-card p-10 mb-8 bg-blue-600 text-white text-center">
                        <div className="emoji-large mb-4">✅</div>
                        <h3 className="text-2xl font-bold mb-2">You are verified</h3>
                        <p className="opacity-90 mb-6">
                            Your profile is approved. Go to the driver panel, switch online, and start accepting
                            rides.
                        </p>
                        <button type="button" className="btn btn-dark" onClick={() => navigate('/driver')}>
                            Go to driver panel
                        </button>
                    </div>
                )}

                <p className="text-xs text-center text-muted">
                    Need help? Contact support if you have trouble uploading documents.
                </p>
            </div>
        </div>
    );
};

export default DriverVerificationPage;
