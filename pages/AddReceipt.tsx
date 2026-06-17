
import React, { useState, useRef, useEffect } from 'react';
import { Key, AlertCircle } from 'lucide-react';
import jsQR from 'jsqr';
import { extractReceiptData, extractReceiptDataFromQr } from '../services/geminiService';
import { predictCategory, findDuplicateReceipt } from '../services/mlService';
import { getExchangeRate } from '../services/currencyService';
import { generatePHash, enhanceReceiptImage } from '../utils/imageUtils';
import { LoaderIcon, UploadIcon, PencilIcon, BoltIcon, XMarkIcon, QrCodeIcon, PlusIcon, SendIcon } from '../components/Icons';
import type { ExtractedReceiptData, ReceiptData, Category, UserSettings, LineItem } from '../types';
import { fileToBase64 } from '../utils/fileUtils';
import { formatCurrency } from '../utils/currency';
import { normalizeMerchantName } from '../utils/merchantNormalization';

interface AddReceiptProps {
    receipts: ReceiptData[];
    onReceiptAdded: (receipt: Omit<ReceiptData, 'id'>) => void;
    categories: Category[];
    userSettings: UserSettings;
}

type ItemStatus = 'queued' | 'enhancing' | 'processing' | 'duplicate' | 'completed' | 'failed';

interface BatchItem {
    id: string;
    file?: File;
    preview: string;
    status: ItemStatus;
    data?: ExtractedReceiptData;
    error?: string;
    progress: number;
    isVerified?: boolean;
    qrText?: string;
}

type EntryPhase = 'choice' | 'batch_processing' | 'manual_entry' | 'qr_process' | 'qr_scanner' | 'qr_text_entry';

const AddReceipt: React.FC<AddReceiptProps> = ({ receipts, onReceiptAdded, categories, userSettings }) => {
    const [phase, setPhase] = useState<EntryPhase>('choice');
    const [batch, setBatch] = useState<BatchItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [reviewingId, setReviewingId] = useState<string | null>(null);
    const [manualData, setManualData] = useState<ExtractedReceiptData>({
        merchantName: '',
        totalAmount: 0,
        transactionDate: new Date().toISOString().split('T')[0],
        category: 'Others',
        items: []
    });
    const [isKeyConfigured, setIsKeyConfigured] = useState(true);
    const [status, setStatus] = useState<{ type: 'error' | 'info' | 'success', message: string } | null>(null);
    const [pastedQrText, setPastedQrText] = useState('');

    const qrInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanRequestRef = useRef<number | null>(null);

    // Check for API Key
    useEffect(() => {
        const checkKey = async () => {
            const hasEnvKey = !!(process.env.GEMINI_API_KEY || process.env.API_KEY);
            if (!hasEnvKey && window.aistudio?.hasSelectedApiKey) {
                try {
                    const selected = await window.aistudio.hasSelectedApiKey();
                    setIsKeyConfigured(selected);
                } catch (e) {
                    setIsKeyConfigured(false);
                }
            } else {
                setIsKeyConfigured(hasEnvKey);
            }
        };
        checkKey();
    }, []);

    const handleOpenKeySelector = async () => {
        if (window.aistudio?.openSelectKey) {
            await window.aistudio.openSelectKey();
            // Assume success and proceed as per guidelines
            setIsKeyConfigured(true);
        } else {
            setStatus({ type: 'error', message: "Please set the GEMINI_API_KEY in your environment variables in the sidebar." });
        }
    };

    const resetFlow = () => {
        stopScanner();
        setPhase('choice');
        setBatch([]);
        setIsProcessing(false);
        setReviewingId(null);
        setStatus(null);
        setManualData({
            merchantName: '',
            totalAmount: 0,
            transactionDate: new Date().toISOString().split('T')[0],
            category: 'Others',
            items: []
        });
    };

    const processItem = async (item: BatchItem, qrText?: string) => {
        let rawOcrData: any = null;
        let currentHash = item.id;
        let effectiveQrText = qrText || item.qrText;

        try {
            // If no QR text provided, try to detect it from the image first
            if (!effectiveQrText && item.file) {
                setBatch(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing', progress: 5 } : i));
                try {
                    const img = new Image();
                    const objectUrl = URL.createObjectURL(item.file);
                    img.src = objectUrl;
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                    });
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                if (imageData) {
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    if (code) {
                        effectiveQrText = code.data;
                        console.log("Auto-detected QR in processItem:", effectiveQrText);
                    }
                }
            }
                } catch (qrErr) {
                    console.warn("Auto QR detection failed, continuing with OCR", qrErr);
                }
            }

            if (effectiveQrText) {
                setBatch(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing', progress: 20 } : i));
                rawOcrData = await extractReceiptDataFromQr(effectiveQrText, receipts, categories.map(c => c.name));
                setBatch(prev => prev.map(i => i.id === item.id ? { ...i, progress: 40 } : i));

                // If QR data is weak (0 amount or unknown merchant), try image OCR as fallback
                if ((!rawOcrData.totalAmount || rawOcrData.totalAmount === 0 || rawOcrData.merchantName === 'Unknown') && item.file) {
                    setBatch(prev => prev.map(i => i.id === item.id ? { ...i, status: 'enhancing', progress: 45 } : i));
                    const enhanced = await enhanceReceiptImage(item.file);
                    setBatch(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing', progress: 50 } : i));
                    const fallbackData = await extractReceiptData(enhanced.base64, enhanced.mimeType, receipts, categories.map(c => c.name));
                    
                    // Merge data, preferring QR data if it was partially successful but using OCR for the rest
                    rawOcrData = {
                        ...fallbackData,
                        qrText: effectiveQrText, // Keep the QR text for reference
                        confidence: Math.max(rawOcrData.confidence || 0, fallbackData.confidence || 0.8)
                    };
                }
            } else {
                if (!item.file) return;
                // Stage 0: Enhancement
                setBatch(prev => prev.map(i => i.id === item.id ? { ...i, status: 'enhancing', progress: 5 } : i));
                const enhanced = await enhanceReceiptImage(item.file);
                
                setBatch(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing', progress: 15 } : i));

                // Stage 1: Perceptual Hashing
                currentHash = await generatePHash(item.file);
                
                // Check for early visual duplicate
                const earlyDuplicate = findDuplicateReceipt({ imageHash: currentHash }, receipts);
                if (earlyDuplicate) {
                    setBatch(prev => prev.map(i => i.id === item.id ? { 
                        ...i, 
                        status: 'duplicate', 
                        data: earlyDuplicate, 
                        progress: 100 
                    } : i));
                    return;
                }

                setBatch(prev => prev.map(i => i.id === item.id ? { ...i, progress: 30 } : i));
                
                // Stage 2: OCR with Neural Engine
                try {
                    rawOcrData = await extractReceiptData(enhanced.base64, enhanced.mimeType, receipts, categories.map(c => c.name));
                } catch (neuralErr: any) {
                    console.error("Neural OCR failed", neuralErr);
                    const msg = neuralErr.message || "Unknown OCR error";
                    if (msg.includes("API Key") || msg.includes("quota") || msg.includes("permission")) {
                        throw neuralErr;
                    }
                    throw new Error(`Extraction failed: ${msg}. Please try a clearer photo.`);
                }
            }

            setBatch(prev => prev.map(i => i.id === item.id ? { ...i, progress: 60 } : i));
            
            // Stage 3: Deep Duplicate Check
            const deepDuplicate = findDuplicateReceipt({ ...rawOcrData, imageHash: currentHash }, receipts);
            if (deepDuplicate) {
                setBatch(prev => prev.map(i => i.id === item.id ? { 
                    ...i, 
                    status: 'duplicate', 
                    data: deepDuplicate, 
                    progress: 100 
                } : i));
                return;
            }

            // Stage 4: Semantic Inference (Fallback/Refinement)
            const inference = await predictCategory(rawOcrData);
            
            // Use AI-extracted category if available, otherwise use inference
            const finalCategory = rawOcrData.category || inference.category;

            // Stage 5: Currency Conversion
            let conversionData: Partial<ExtractedReceiptData> = {};
            if (rawOcrData.currency && rawOcrData.currency.toUpperCase() !== userSettings.currency.toUpperCase()) {
                setBatch(prev => prev.map(i => i.id === item.id ? { ...i, progress: 80 } : i));
                const { rate, timestamp } = await getExchangeRate(rawOcrData.currency, userSettings.currency);
                
                conversionData = {
                    baseCurrency: userSettings.currency,
                    exchangeRate: rate,
                    convertedAmount: rawOcrData.totalAmount * rate,
                    conversionTimestamp: timestamp
                };
            }

            const finalData: ExtractedReceiptData = {
                ...rawOcrData,
                ...conversionData,
                category: finalCategory,
                confidence: (qrText || item.qrText) ? 1.0 : (rawOcrData.category ? 0.95 : inference.confidence),
                imageHash: currentHash,
                isVerified: false,
                inferenceDetails: inference.decisionPath
            };

            setBatch(prev => prev.map(i => i.id === item.id ? { 
                ...i, 
                status: 'completed', 
                data: finalData, 
                progress: 100
            } : i));
        } catch (err: any) {
            console.error("Critical Process failed", err);
            setBatch(prev => prev.map(i => i.id === item.id ? { 
                ...i, 
                status: 'failed', 
                error: err.message, 
                progress: 100 
            } : i));
        }
    };

    const handleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        // Explicitly cast to File[] to avoid unknown type errors in map and URL.createObjectURL
        const files = Array.from(e.target.files || []) as File[];
        if (files.length === 0) return;

        const newItems: BatchItem[] = files.map((file: File) => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            preview: URL.createObjectURL(file),
            status: 'queued',
            progress: 0
        }));

        setBatch(newItems);
        setPhase('batch_processing');
        setIsProcessing(true);

        for (let i = 0; i < newItems.length; i++) {
            await processItem(newItems[i]);
            if (i < newItems.length - 1) await new Promise(r => setTimeout(r, 800));
        }
        setIsProcessing(false);
    };

    const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsProcessing(true);
        setStatus({ type: 'info', message: "Analyzing uploaded image..." });
        try {
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            img.src = objectUrl;
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });
            
            const canvas = document.createElement('canvas');
            canvas.width = img.width; 
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) throw new Error("Could not create canvas context");
            ctx.drawImage(img, 0, 0);
            
            // Try decoding at original resolution
            let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let code = null;
            
            if (imageData) {
                code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                });
                
                // If failed, try with inversion (for dark mode QRs)
                if (!code) {
                    code = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: "onlyInvert",
                    });
                }
            }
            
            // If still failed, try resizing to a smaller resolution (jsQR works better on some smaller images)
            if (!code && (canvas.width > 1000 || canvas.height > 1000)) {
                const scale = 800 / Math.max(canvas.width, canvas.height);
                canvas.width *= scale;
                canvas.height *= scale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                if (imageData) {
                    code = jsQR(imageData.data, imageData.width, imageData.height);
                }
            }
            
            if (code) {
                console.log("QR Code detected in upload:", code.data);
                const newItem: BatchItem = {
                    id: Math.random().toString(36).substr(2, 9),
                    file: file,
                    preview: objectUrl,
                    status: 'queued',
                    progress: 0,
                    qrText: code.data
                };
                setBatch([newItem]);
                setPhase('batch_processing');
                await processItem(newItem, code.data);
            } else { 
                console.log("No QR Code detected in upload, falling back to OCR");
                // Fallback: Try regular OCR if QR fails
                setStatus({ type: 'info', message: "No QR code detected. Attempting to extract data from the image directly..." });
                const newItem: BatchItem = {
                    id: Math.random().toString(36).substr(2, 9),
                    file: file,
                    preview: objectUrl,
                    status: 'queued',
                    progress: 0
                };
                setBatch([newItem]);
                setPhase('batch_processing');
                await processItem(newItem);
                setStatus(null);
            }
        } catch (err: any) { 
            console.error("QR Upload Error:", err);
            setStatus({ type: 'error', message: `QR Extraction failed: ${err.message}` });
        } finally { 
            setIsProcessing(false); 
        }
    };

    const startScanner = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.setAttribute('playsinline', 'true');
                videoRef.current.play();
                setPhase('qr_scanner');
                scanRequestRef.current = requestAnimationFrame(scanFrame);
            }
        } catch (err) {
            console.error("Camera access denied", err);
            setStatus({ type: 'error', message: "Camera access is required for scanning. Falling back to file upload." });
            setTimeout(() => qrInputRef.current?.click(), 2000);
        }
    };

    const stopScanner = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (scanRequestRef.current) {
            cancelAnimationFrame(scanRequestRef.current);
            scanRequestRef.current = null;
        }
    };

    const handlePastedQrProcess = async () => {
        if (!pastedQrText.trim()) return;
        
        setIsProcessing(true);
        try {
            const newItem: BatchItem = {
                id: Math.random().toString(36).substr(2, 9),
                preview: 'https://cdn-icons-png.flaticon.com/512/714/714390.png', // Placeholder for text-only
                status: 'queued',
                progress: 0,
                qrText: pastedQrText
            };
            setBatch([newItem]);
            setPhase('batch_processing');
            await processItem(newItem, pastedQrText);
            setPastedQrText('');
        } catch (err: any) {
            console.error("QR Text Process Error:", err);
            setStatus({ type: 'error', message: `Extraction failed: ${err.message}` });
        } finally {
            setIsProcessing(false);
        }
    };

    const scanFrame = () => {
        if (videoRef.current && canvasRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                if (imageData) {
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    if (code) {
                        stopScanner();
                    const preview = canvas.toDataURL('image/jpeg');
                    const newItem: BatchItem = {
                        id: Math.random().toString(36).substr(2, 9),
                        preview: preview,
                        status: 'queued',
                        progress: 0,
                        qrText: code.data
                    };
                    setBatch([newItem]);
                    setPhase('batch_processing');
                    setIsProcessing(true);
                    processItem(newItem, code.data).finally(() => setIsProcessing(false));
                    return;
                }
            }
        }
    }
    scanRequestRef.current = requestAnimationFrame(scanFrame);
};

    const commitBatch = () => {
        batch.filter(i => i.status === 'completed' && i.data).forEach(item => {
            onReceiptAdded({ ...item.data!, isVerified: item.isVerified });
        });
        resetFlow();
    };

    const handleUpdateReviewData = (data: ExtractedReceiptData) => {
        if (!reviewingId) return;
        const normalizedData = {
            ...data,
            merchantName: normalizeMerchantName(data.merchantName, receipts)
        };
        setBatch(prev => prev.map(i => i.id === reviewingId ? { ...i, data: normalizedData, isVerified: true } : i));
        setReviewingId(null);
    };

    const handleManualSave = (data: ExtractedReceiptData) => {
        const normalizedData = {
            ...data,
            merchantName: normalizeMerchantName(data.merchantName, receipts)
        };
        onReceiptAdded({ ...normalizedData, isVerified: true });
        resetFlow();
    };

    const reviewingItem = batch.find(i => i.id === reviewingId);
    const duplicateCount = batch.filter(i => i.status === 'duplicate').length;
    const completedCount = batch.filter(i => i.status === 'completed').length;

    return (
        <div className="w-full min-h-screen p-4 sm:p-6 lg:p-12 animate-in fade-in duration-500 relative text-gray-100">
            <header className="max-w-6xl mx-auto mb-12 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic flex items-center gap-3">
                        <BoltIcon className="w-8 h-8 text-primary" />
                        Add Receipt
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    {!isKeyConfigured && (
                        <button 
                            onClick={handleOpenKeySelector}
                            className="px-6 py-3 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition-all flex items-center gap-2"
                        >
                            <Key size={14} />
                            Setup API Key
                        </button>
                    )}
                    {phase !== 'choice' && (
                        <button onClick={resetFlow} className="text-gray-500 hover:text-white text-xs font-black uppercase tracking-widest bg-gray-900/50 px-6 py-3 rounded-full border border-gray-800 transition-all">Cancel</button>
                    )}
                </div>
            </header>

            <div className="max-w-6xl mx-auto">
                {status && (
                    <div className={`mb-8 p-6 rounded-[32px] border animate-in slide-in-from-top-4 duration-500 flex items-center gap-4 ${
                        status.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-500' :
                        status.type === 'info' ? 'bg-primary/10 border-primary/30 text-primary' :
                        'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                    }`}>
                        {status.type === 'error' ? <XMarkIcon className="w-6 h-6 shrink-0" /> : <BoltIcon className="w-6 h-6 shrink-0" />}
                        <p className="text-sm font-bold italic">{status.message}</p>
                        <button onClick={() => setStatus(null)} className="ml-auto p-2 hover:bg-white/10 rounded-full transition-colors">
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}
                {!isKeyConfigured && (
                    <div className="mb-12 p-8 bg-amber-500/5 border border-amber-500/20 rounded-[40px] animate-in slide-in-from-top-4 duration-500">
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
                            <div className="p-4 bg-amber-500/10 rounded-3xl text-amber-500">
                                <AlertCircle size={32} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-black text-amber-500 uppercase tracking-tight">AI Scanning Unavailable</h3>
                                <p className="text-gray-400 mt-2 leading-relaxed max-w-2xl">
                                    To use the Neural OCR engine, you must provide a Gemini API Key. You can set it in the sidebar environment variables or click the button below to select a key from your Google Cloud project.
                                </p>
                                <button 
                                    onClick={handleOpenKeySelector}
                                    className="mt-6 px-8 py-3 bg-amber-500 text-black rounded-full text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-amber-500/20"
                                >
                                    Configure API Key
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {phase === 'choice' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-8 duration-700">
                        <div className="relative group overflow-hidden bg-dark-card border border-gray-800 rounded-[48px] p-12 text-center hover:border-primary/50 transition-all cursor-pointer">
                            <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer z-10" accept="image/*" onChange={handleFilesUpload} />
                            <div className="w-24 h-24 bg-primary/10 rounded-[32px] flex items-center justify-center text-primary mx-auto mb-8 group-hover:bg-primary group-hover:scale-110 transition-all duration-500">
                                <PlusIcon className="w-12 h-12 text-primary group-hover:text-white" />
                            </div>
                            <h3 className="text-2xl font-black text-white tracking-tighter uppercase">Upload Images</h3>
                            <p className="text-gray-500 mt-2 font-medium">Automatic extraction</p>
                        </div>
                        <div onClick={() => setPhase('manual_entry')} className="relative group overflow-hidden bg-dark-card border border-gray-800 rounded-[48px] p-12 text-center hover:border-accent/50 transition-all cursor-pointer">
                            <div className="w-24 h-24 bg-accent/10 rounded-[32px] flex items-center justify-center text-accent mx-auto mb-8 group-hover:bg-accent group-hover:scale-110 transition-all duration-500">
                                <PencilIcon className="w-12 h-12 text-accent group-hover:text-white" />
                            </div>
                            <h3 className="text-2xl font-black text-white tracking-tighter uppercase">Manual Entry</h3>
                            <p className="text-gray-500 mt-2 font-medium">Add details yourself</p>
                        </div>
                        <div className="relative group overflow-hidden bg-dark-card border border-gray-800 rounded-[48px] p-12 text-center hover:border-white/50 transition-all">
                            <input type="file" ref={qrInputRef} className="hidden" accept="image/*" onChange={handleQrUpload} />
                            <div className="w-24 h-24 bg-white/10 rounded-[32px] flex items-center justify-center text-white mx-auto mb-8 group-hover:bg-white group-hover:scale-110 transition-all duration-500">
                                <QrCodeIcon className="w-12 h-12 text-white group-hover:text-black" />
                            </div>
                            <h3 className="text-2xl font-black text-white tracking-tighter uppercase mb-6">Scan QR Code</h3>
                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={startScanner}
                                    className="w-full py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                                >
                                    <BoltIcon className="w-4 h-4" />
                                    Live Camera Scan
                                </button>
                                <button 
                                    onClick={() => qrInputRef.current?.click()}
                                    className="w-full py-4 bg-gray-900 border border-gray-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-white/30 transition-all flex items-center justify-center gap-2"
                                >
                                    <UploadIcon className="w-4 h-4" />
                                    Upload QR Image
                                </button>
                                <button 
                                    onClick={() => setPhase('qr_text_entry')}
                                    className="w-full py-4 bg-gray-900/50 border border-gray-800/50 text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-white hover:border-white/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <PencilIcon className="w-4 h-4" />
                                    Paste QR Content
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {phase === 'qr_text_entry' && (
                    <div className="max-w-2xl mx-auto animate-in fade-in zoom-in duration-500">
                        <div className="bg-dark-card border border-gray-800 rounded-[48px] p-12 shadow-2xl">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-2xl font-black text-white tracking-tighter uppercase">Paste QR Content</h3>
                                <button onClick={() => setPhase('choice')} className="text-gray-500 hover:text-white transition-colors">
                                    <XMarkIcon className="w-6 h-6" />
                                </button>
                            </div>
                            <p className="text-gray-500 mb-6 text-sm font-medium">
                                If you have the raw text or URL from a QR code, paste it here. Our AI will extract the receipt details automatically.
                            </p>
                            <textarea 
                                value={pastedQrText}
                                onChange={(e) => setPastedQrText(e.target.value)}
                                placeholder="Paste QR text or URL here..."
                                className="w-full h-48 bg-gray-900 border border-gray-700 text-white rounded-3xl p-6 focus:border-primary outline-none transition-all font-mono text-sm mb-8 resize-none"
                            />
                            <button 
                                onClick={handlePastedQrProcess}
                                disabled={!pastedQrText.trim() || isProcessing}
                                className="w-full py-6 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-3xl shadow-neon-primary hover:shadow-primary/40 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:shadow-none"
                            >
                                {isProcessing ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <BoltIcon className="w-5 h-5" />}
                                Extract Receipt Data
                            </button>
                        </div>
                    </div>
                )}

                {phase === 'batch_processing' && (
                    <div className="space-y-12">
                        {duplicateCount > 0 && (
                            <div className="bg-orange-500/10 border border-orange-500/30 p-6 rounded-[32px] flex items-center gap-4 animate-in slide-in-from-top-4">
                                <BoltIcon className="w-6 h-6 text-orange-500 animate-pulse" />
                                <div>
                                    <h4 className="text-orange-500 font-black uppercase text-xs tracking-widest">Duplicate Detected</h4>
                                    <p className="text-gray-500 text-[10px] font-medium mt-1 uppercase tracking-tight">
                                        {duplicateCount} items match existing records and will be skipped.
                                    </p>
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {batch.map((item) => (
                                <div key={item.id} className="bg-dark-card border border-gray-800 rounded-[32px] overflow-hidden relative group shadow-2xl transition-all hover:scale-[1.02]">
                                    <div className="h-40 relative">
                                        <img src={item.preview} className="w-full h-full object-cover opacity-40 grayscale group-hover:grayscale-0 transition-all duration-700" alt="Preview" />
                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-t from-dark-card to-transparent">
                                            {(item.status === 'processing' || item.status === 'enhancing') && <LoaderIcon className="w-10 h-10 text-primary animate-spin" />}
                                            {item.status === 'completed' && <div className="bg-primary text-white p-3 rounded-full shadow-neon-primary scale-up-center"><BoltIcon className="w-6 h-6" /></div>}
                                            {item.status === 'duplicate' && <div className="bg-orange-500 text-white p-3 rounded-full shadow-lg"><XMarkIcon className="w-6 h-6" /></div>}
                                            {item.status === 'failed' && <div className="bg-red-500 text-white p-3 rounded-full shadow-lg"><BoltIcon className="w-6 h-6" /></div>}
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="overflow-hidden flex-1 mr-4">
                                                <h4 className="text-white font-bold text-sm truncate">{item.file?.name || 'File'}</h4>
                                                <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${item.status === 'duplicate' ? 'text-orange-500' : 'text-gray-500'}`}>
                                                    {item.status === 'enhancing' ? 'ENHANCING LEGIBILITY...' : item.status === 'duplicate' ? 'DUPLICATE' : item.status.toUpperCase()}
                                                </p>
                                            </div>
                                            {item.data && <span className="text-accent font-mono font-bold text-xs shrink-0">{item.data.totalAmount.toFixed(2)}</span>}
                                        </div>
                                        <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden mb-2">
                                            <div className={`h-full transition-all duration-700 ${item.status === 'failed' ? 'bg-red-500' : item.status === 'duplicate' ? 'bg-orange-500' : 'bg-primary'}`} style={{ width: `${item.progress}%` }} />
                                        </div>
                                        {item.status === 'completed' && item.data && (
                                            <div className="mt-4 flex flex-col gap-3">
                                                <div className="flex justify-between items-center bg-primary/5 p-2 rounded-xl border border-primary/10">
                                                    <span className="text-[8px] font-black uppercase text-primary tracking-widest ml-1">{item.data.category}</span>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[7px] font-black uppercase px-1 rounded bg-primary/20 text-primary">
                                                            Neural OCR
                                                        </span>
                                                        <span className="text-[7px] font-mono text-gray-600">Conf: {((item.data.confidence || 0) * 100).toFixed(0)}%</span>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => setReviewingId(item.id)}
                                                    className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${item.isVerified ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-gray-800 text-white border border-gray-700 hover:border-primary'}`}
                                                >
                                                    {item.isVerified ? 'Verified ✓' : 'Review & Edit'}
                                                </button>
                                            </div>
                                        )}
                                        {item.status === 'failed' && item.error && (
                                            <div className="mt-2">
                                                <p className="text-[8px] text-red-500 font-medium italic mb-2">{item.error}</p>
                                                <button 
                                                    onClick={() => {
                                                        setManualData({
                                                            merchantName: '',
                                                            totalAmount: 0,
                                                            transactionDate: new Date().toISOString().split('T')[0],
                                                            category: 'Others',
                                                            items: []
                                                        });
                                                        setPhase('manual_entry');
                                                    }}
                                                    className="w-full py-2 bg-gray-800 border border-red-500/30 text-red-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all"
                                                >
                                                    Manual Entry Fallback
                                                </button>
                                            </div>
                                        )}
                                        {item.status === 'duplicate' && (
                                            <div className="mt-4 p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                                                <p className="text-[8px] text-orange-500 font-black uppercase tracking-widest text-center">Receipt already in vault</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="sticky bottom-8 left-0 right-0 flex justify-center pt-8 bg-gradient-to-t from-dark-bg via-dark-bg to-transparent">
                            <button 
                                onClick={commitBatch} 
                                disabled={isProcessing || completedCount === 0} 
                                className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-16 py-6 rounded-[28px] font-black uppercase tracking-widest text-xs shadow-2xl shadow-primary/30 transition-all active:scale-95"
                            >
                                {isProcessing ? 'Processing...' : completedCount > 0 ? `Add ${completedCount} Receipts` : 'No New Receipts'}
                            </button>
                        </div>
                    </div>
                )}

                {phase === 'manual_entry' && (
                    <div className="max-w-2xl mx-auto bg-dark-card border border-gray-800 rounded-[48px] p-8 sm:p-12 shadow-2xl animate-in zoom-in-95 duration-500">
                        <header className="mb-8">
                            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Manual Entry</h2>
                            <p className="text-gray-500 text-sm">Add your receipt details below.</p>
                        </header>
                        <ReviewForm 
                            key={JSON.stringify(manualData)}
                            initialData={manualData} 
                            onSave={handleManualSave} 
                            onCancel={resetFlow} 
                            categories={categories}
                            currency={userSettings.currency}
                        />
                    </div>
                )}

                {phase === 'qr_scanner' && (
                    <div className="max-w-2xl mx-auto bg-dark-card border border-gray-800 rounded-[48px] p-8 sm:p-12 shadow-2xl animate-in zoom-in-95 duration-500 relative overflow-hidden">
                        <header className="mb-8 text-center">
                            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Live Scanner</h2>
                            <p className="text-gray-500 text-sm">Point your camera at a receipt QR code.</p>
                        </header>
                        <div className="relative aspect-square rounded-[32px] overflow-hidden border-4 border-primary/30 shadow-neon-primary/20">
                            <video ref={videoRef} className="w-full h-full object-cover" />
                            <canvas ref={canvasRef} className="hidden" />
                            <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                                <div className="w-full h-full border-2 border-primary animate-pulse rounded-2xl" />
                            </div>
                            <div className="absolute top-4 left-4 right-4 flex justify-center">
                                <span className="bg-primary/80 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-bounce">Scanning...</span>
                            </div>
                        </div>
                        <div className="mt-8 flex flex-col items-center gap-4">
                            <button 
                                onClick={() => qrInputRef.current?.click()}
                                className="px-8 py-3 bg-white text-black rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center gap-2"
                            >
                                <UploadIcon className="w-4 h-4" />
                                Upload QR Image Instead
                            </button>
                            <button onClick={resetFlow} className="text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all">
                                Cancel Scanner
                            </button>
                        </div>
                    </div>
                )}

                {phase === 'qr_process' && isProcessing && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <LoaderIcon className="w-16 h-16 text-primary animate-spin mb-6" />
                        <p className="text-white font-black uppercase tracking-widest text-sm">Scanning QR Code...</p>
                    </div>
                )}
            </div>

            {/* AI Review Modal */}
            {reviewingId && reviewingItem && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
                    <div className="w-full max-w-5xl bg-dark-card border border-gray-800 rounded-[48px] overflow-hidden flex flex-col md:flex-row shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh]">
                        <div className="w-full md:w-1/2 bg-gray-900/50 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-800">
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6 self-start">Receipt Preview</h3>
                            <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-[32px] border border-gray-800 bg-black shadow-inner">
                                <img src={reviewingItem.preview} alt="Receipt Preview" className="max-w-full max-h-full object-contain" />
                            </div>
                        </div>

                        <div className="w-full md:w-1/2 p-8 flex flex-col overflow-y-auto custom-scrollbar">
                            <header className="flex justify-between items-start mb-8">
                                <div>
                                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Review Details</h2>
                                    <p className="text-gray-500 text-sm">Check the extracted information.</p>
                                    {reviewingItem.qrText && (
                                        <div className="mt-2 p-2 bg-white/5 rounded-lg border border-white/10">
                                            <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-1">Decoded QR Content</p>
                                            <p className="text-[10px] text-gray-400 font-mono break-all line-clamp-2">{reviewingItem.qrText}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest block mb-1">Confidence</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary" style={{ width: `${(reviewingItem.data?.confidence || 0) * 100}%` }} />
                                        </div>
                                        <span className="text-sm font-mono font-black text-primary">{((reviewingItem.data?.confidence || 0) * 100).toFixed(0)}%</span>
                                    </div>
                                </div>
                            </header>

                            {reviewingItem.data && (
                                <ReviewForm 
                                    initialData={reviewingItem.data} 
                                    onSave={handleUpdateReviewData} 
                                    onCancel={() => setReviewingId(null)}
                                    categories={categories}
                                    currency={userSettings.currency}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                .scale-up-center { animation: scale-up-center 0.4s cubic-bezier(0.390, 0.575, 0.565, 1.000) both; } 
                @keyframes scale-up-center { 0% { transform: scale(0.5); } 100% { transform: scale(1); } }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
            ` }} />
        </div>
    );
};

interface ReviewFormProps {
    initialData: ExtractedReceiptData;
    onSave: (data: ExtractedReceiptData) => void;
    onCancel: () => void;
    categories: Category[];
    currency: string;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ initialData, onSave, onCancel, categories, currency }) => {
    const [formData, setFormData] = useState<ExtractedReceiptData>({ ...initialData });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const target = e.target as HTMLInputElement;
        const inputMode = target.inputMode;

        let val: any = value;
        if (name === 'totalAmount' || inputMode === 'decimal' || inputMode === 'numeric') {
            const sanitized = value.replace(/[^0-9.]/g, '').replace(/^0+(?!\.|$)/, '');
            val = sanitized === '' ? 0 : Number(sanitized);
        }

        setFormData(prev => {
            const next = { ...prev, [name]: val };
            if (name === 'totalAmount' && next.exchangeRate) {
                next.convertedAmount = Number(val) * next.exchangeRate;
            }
            return next;
        });
    };

    const handleItemChange = (index: number, field: keyof LineItem, value: any) => {
        const newItems = [...formData.items];
        let val = value;
        if (field === 'price' || field === 'quantity') {
            const sanitized = value.replace(/[^0-9.]/g, '').replace(/^0+(?!\.|$)/, '');
            val = sanitized === '' ? 0 : Number(sanitized);
        }
        newItems[index] = { ...newItems[index], [field]: val };
        const newTotal = newItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        setFormData(prev => {
            const next = { ...prev, items: newItems, totalAmount: newTotal > 0 ? newTotal : prev.totalAmount };
            if (next.exchangeRate) {
                next.convertedAmount = next.totalAmount * next.exchangeRate;
            }
            return next;
        });
    };

    const addItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, { name: '', quantity: 1, price: 0 }]
        }));
    };

    const removeItem = (index: number) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    return (
        <div className="space-y-8 pb-10">
            {formData.exchangeRate && formData.exchangeRate !== 1 && (
                <div className="bg-primary/10 border border-primary/30 p-4 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-4">
                    <BoltIcon className="w-6 h-6 text-primary animate-pulse" />
                    <div className="flex-1">
                        <h4 className="text-primary font-black uppercase text-[10px] tracking-widest">Currency Conversion Active</h4>
                        <div className="flex justify-between items-center mt-1">
                            <p className="text-gray-400 text-[10px] font-medium uppercase tracking-tight">
                                {formData.currency} → {formData.baseCurrency} @ {formData.exchangeRate.toFixed(4)}
                            </p>
                            <p className="text-white font-mono font-bold text-xs">
                                {formatCurrency(formData.convertedAmount || 0, formData.baseCurrency || currency)}
                            </p>
                        </div>
                        {formData.conversionTimestamp && (
                            <p className="text-[8px] text-gray-600 mt-1 uppercase">Rate as of: {new Date(formData.conversionTimestamp).toLocaleString()}</p>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 text-gray-400">Merchant Name</label>
                    <input 
                        name="merchantName"
                        value={formData.merchantName}
                        onChange={handleChange}
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-2xl p-4 focus:border-primary outline-none transition-all font-bold text-sm"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 text-gray-400">Date</label>
                    <input 
                        name="transactionDate"
                        type="date"
                        value={formData.transactionDate}
                        onChange={handleChange}
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-2xl p-4 focus:border-primary outline-none transition-all font-bold text-sm"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 text-gray-400">Total Amount ({formData.currency || currency})</label>
                    <input 
                        name="totalAmount"
                        type="text"
                        inputMode="decimal"
                        value={formData.totalAmount === 0 ? '' : formData.totalAmount}
                        onChange={handleChange}
                        className="w-full bg-gray-900 border border-gray-700 text-accent rounded-2xl p-4 focus:border-accent outline-none transition-all font-mono font-bold text-lg"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 text-gray-400">Detected Currency</label>
                    <input 
                        name="currency"
                        value={formData.currency || ''}
                        onChange={handleChange}
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-2xl p-4 focus:border-primary outline-none transition-all font-bold text-sm uppercase"
                        placeholder="e.g. USD"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 text-gray-400">Category</label>
                    <select 
                        name="category"
                        value={formData.category}
                        onChange={(e) => {
                            if (e.target.value === 'ADD_NEW') {
                                const name = prompt("Enter new category name:");
                                if (name) {
                                    setFormData(prev => ({ ...prev, category: name }));
                                }
                            } else {
                                handleChange(e);
                            }
                        }}
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-2xl p-4 focus:border-primary outline-none transition-all font-bold text-sm"
                    >
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                        {!categories.some(c => c.name === formData.category) && (
                            <option value={formData.category}>{formData.category}</option>
                        )}
                        <option value="ADD_NEW">+ Add New Category...</option>
                    </select>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-gray-400">Item Breakdown</h4>
                    <button onClick={addItem} className="text-primary hover:text-white transition-colors text-[10px] font-black uppercase flex items-center gap-1">
                        <PlusIcon className="w-3 h-3" /> Add Item
                    </button>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {formData.items.map((item, idx) => (
                        <div key={idx} className="flex gap-3 items-center group">
                            <input 
                                placeholder="Item name"
                                value={item.name}
                                onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                                className="flex-grow bg-gray-900/50 border border-gray-800 text-white rounded-xl p-3 text-xs focus:border-primary outline-none"
                            />
                            <input 
                                type="text"
                                inputMode="numeric"
                                placeholder="Qty"
                                value={item.quantity === 0 ? '' : item.quantity}
                                onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                className="w-16 bg-gray-900/50 border border-gray-800 text-white rounded-xl p-3 text-xs text-center focus:border-primary outline-none"
                            />
                            <input 
                                type="text"
                                inputMode="decimal"
                                placeholder="Price"
                                value={item.price === 0 ? '' : item.price}
                                onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                                className="w-24 bg-gray-900/50 border border-gray-800 text-accent rounded-xl p-3 text-xs font-mono font-bold focus:border-accent outline-none"
                            />
                            <button onClick={() => removeItem(idx)} className="text-gray-600 hover:text-red-500 transition-colors p-2 opacity-0 group-hover:opacity-100">
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    {formData.items.length === 0 && (
                        <p className="text-center py-4 text-xs text-gray-700 italic">No items found.</p>
                    )}
                </div>
            </div>

            <div className="flex gap-4 pt-6">
                <button onClick={onCancel} className="flex-1 py-4 text-gray-500 font-black uppercase tracking-widest text-[10px] border border-gray-800 rounded-2xl hover:bg-gray-800 transition-all">Discard</button>
                <button 
                    onClick={() => onSave(formData)} 
                    className="flex-[2] py-4 bg-accent text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-neon-accent hover:shadow-accent/40 transition-all flex items-center justify-center gap-2"
                >
                    <BoltIcon className="w-4 h-4" />
                    Confirm Details
                </button>
            </div>
        </div>
    );
};

export default AddReceipt;
