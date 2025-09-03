
import React, { useState, useCallback, useEffect } from 'react';
import { generateVideo, enhancePrompt } from './services/geminiService';
import { AspectRatio, Model, ReferenceImage } from './types';
import { CameraIcon, ChevronDownIcon, ClearIcon, EnhanceIcon, LandscapeIcon, PortraitIcon, UploadIcon, VideoIcon, SpinnerIcon, DownloadIcon, KeyIcon } from './components/icons';
import { translations } from './localization';

type Language = 'en' | 'id';

// Component for API Key Input
const ApiKeyInput = ({ value, onChange, t }: { value: string; onChange: (val: string) => void; t: (key: string) => string; }) => (
    <div className="mb-6">
        <label htmlFor="apiKey" className="text-sm font-medium text-white flex items-center mb-2">
            <KeyIcon className="w-5 h-5 mr-2" />
            {t('apiKeyLabel')}
        </label>
        <input
            id="apiKey"
            type="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-[#3c3e45] text-gray-200 p-2.5 rounded-lg border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            placeholder={t('apiKeyPlaceholder')}
            autoComplete="off"
        />
    </div>
);


// Component for the prompt input section
const PromptInput = ({ value, onChange, onClear, onEnhance, isEnhancing, isDisabled, t }: { value:string; onChange: (val: string) => void; onClear: () => void; onEnhance: () => void; isEnhancing: boolean; isDisabled: boolean; t: (key: string) => string; }) => (
    <div>
        <div className="flex justify-between items-center mb-2">
            <label htmlFor="prompt" className="font-medium text-white">{t('promptLabel')}</label>
            <div className="flex items-center space-x-2">
                <button onClick={onClear} className="flex items-center space-x-1.5 text-sm text-gray-300 hover:text-white bg-[#3c3e45] px-3 py-1.5 rounded-md transition-colors">
                    <ClearIcon />
                    <span>{t('clearButton')}</span>
                </button>
                <button 
                    onClick={onEnhance} 
                    disabled={isEnhancing || isDisabled}
                    className="flex items-center justify-center space-x-1.5 text-sm text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 px-3 py-1.5 rounded-md transition-all w-28 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isEnhancing ? (
                        <>
                            <SpinnerIcon />
                            <span>{t('enhancingButton')}</span>
                        </>
                    ) : (
                        <>
                            <EnhanceIcon />
                            <span>{t('enhanceButton')}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
        <textarea
            id="prompt"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-28 bg-[#3c3e45] text-gray-200 p-3 rounded-lg border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none"
            placeholder={t('promptPlaceholder')}
        />
        <p className="text-xs text-cyan-400 mt-2">{t('promptTip')}</p>
    </div>
);

// Component for the image uploader
const ImageUploader = ({ image, onImageUpload, onImageRemove, t }: { image: ReferenceImage | null; onImageUpload: (file: File) => void; onImageRemove: () => void; t: (key: string) => string; }) => {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onImageUpload(e.target.files[0]);
        }
    };

    return (
        <div>
            <h3 className="font-medium text-cyan-400 mb-2">{t('referenceImageLabel')}</h3>
            <div className="relative w-full h-48 bg-[#3c3e45] border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center">
                <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileChange} accept="image/*" />
                {!image && (
                    <div className="text-center text-gray-400">
                        <UploadIcon />
                        <p>{t('uploadImage')}</p>
                    </div>
                )}
                {image && (
                     <div className="relative w-full h-full p-2">
                        <img src={`data:${image.mimeType};base64,${image.base64}`} alt="Preview" className="w-full h-full object-contain rounded-md" />
                        <button onClick={onImageRemove} className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full p-1.5 hover:bg-opacity-75">
                           <ClearIcon />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};


// Component for model selection dropdown
const ModelSelector = ({ selected, onSelect, t }: { selected: Model; onSelect: (model: Model) => void; t: (key: string) => string; }) => {
    const [isOpen, setIsOpen] = useState(false);
    const models: { id: Model, name: string }[] = [
        { id: 'veo-2.0-generate-001', name: 'VEO 2' },
        { id: 'veo-3.0-generate-preview', name: 'VEO 3' },
    ];
    const selectedModelName = models.find(m => m.id === selected)?.name;

    return (
        <div className="relative">
            <h3 className="font-medium text-cyan-400 mb-2">{t('selectModelLabel')}</h3>
            <button onClick={() => setIsOpen(!isOpen)} className="w-full bg-[#3c3e45] text-white px-4 py-2.5 rounded-lg border border-gray-600 flex items-center justify-between">
                <span className="flex items-center"><CameraIcon /> <span className="ml-2">{selectedModelName}</span></span>
                <ChevronDownIcon className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute z-10 top-full mt-1 w-full bg-[#3c3e45] border border-gray-600 rounded-lg shadow-lg">
                    {models.map(model => (
                        <div key={model.id} onClick={() => { onSelect(model.id); setIsOpen(false); }} className="px-4 py-2 hover:bg-gray-700 cursor-pointer first:rounded-t-lg last:rounded-b-lg">
                            {model.name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Component for aspect ratio selection
const AspectRatioSelector = ({ selected, onSelect, t }: { selected: AspectRatio; onSelect: (ratio: AspectRatio) => void; t: (key: string) => string; }) => {
    const options: { id: AspectRatio; name: string; icon: JSX.Element }[] = [
        { id: '16:9', name: t('landscape'), icon: <LandscapeIcon /> },
        { id: '9:16', name: t('portrait'), icon: <PortraitIcon /> },
    ];
    return (
        <div>
            <h3 className="font-medium text-cyan-400 mb-2">{t('aspectRatioLabel')}</h3>
            <div className="grid grid-cols-2 gap-4">
                {options.map(opt => {
                    const isSelected = selected === opt.id;
                    return (
                        <button key={opt.id} onClick={() => onSelect(opt.id)}
                            className={`p-4 bg-[#3c3e45] rounded-lg border flex flex-col items-center justify-center transition-all
                                ${isSelected ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-600'}
                                hover:border-gray-400
                            `}
                        >
                            {opt.icon}
                            <span className="mt-2 text-sm text-white">{opt.name}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    );
};


// Loading overlay component
const LoadingOverlay = ({ message, t }: { message: string, t: (key: string) => string; }) => (
    <div className="absolute inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50 rounded-lg">
        <VideoIcon className="h-16 w-16 text-blue-500 animate-pulse" />
        <h2 className="text-2xl font-bold text-white mt-4">{t('generatingVideoTitle')}</h2>
        <p className="text-gray-300 mt-2 text-center px-4">{message}</p>
    </div>
);

// Warning toast component
const WarningToast = ({ message, onDismiss }: { message: string, onDismiss: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 5000); 
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div className="fixed top-5 right-5 bg-yellow-500 text-black px-4 py-2 rounded-lg shadow-lg animate-fade-in-down z-50 max-w-sm">
           {message}
        </div>
    );
};

// Language switcher component
const LanguageSwitcher = ({ lang, setLang }: { lang: Language, setLang: (lang: Language) => void }) => (
    <div className="absolute top-4 right-4 flex space-x-2">
        <button 
            onClick={() => setLang('en')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${lang === 'en' ? 'text-white bg-gradient-to-r from-blue-600 to-red-500 shadow-lg' : 'text-gray-300 bg-[#3c3e45] hover:bg-gray-600'}`}
        >
            English
        </button>
        <button 
            onClick={() => setLang('id')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${lang === 'id' ? 'text-white bg-red-600 shadow-lg' : 'text-gray-300 bg-[#3c3e45] hover:bg-gray-600'}`}
        >
            Indonesia
        </button>
    </div>
);

export default function App() {
    const [apiKey, setApiKey] = useState<string>("");
    const [prompt, setPrompt] = useState<string>("");
    const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(null);
    const [selectedModel, setSelectedModel] = useState<Model>('veo-2.0-generate-001');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
    const [language, setLanguage] = useState<Language>('en');
    
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);

    const t = useCallback((key: string): string => {
        return translations[language][key] || translations.en[key];
    }, [language]);

    useEffect(() => {
        if (selectedModel === 'veo-3.0-generate-preview' && aspectRatio === '9:16' && !referenceImage) {
            setWarning(t('veo3Warning'));
        }
    }, [selectedModel, aspectRatio, referenceImage, t]);

    const handleImageUpload = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            setReferenceImage({
                base64: base64String,
                mimeType: file.type,
                name: file.name
            });
        };
        reader.readAsDataURL(file);
    }, []);
    
    const handleEnhancePrompt = useCallback(async () => {
        if (!prompt.trim()) {
            setWarning(t('enhanceEmptyWarning'));
            return;
        }
        setIsEnhancing(true);
        setError(null);
        try {
            const enhanced = await enhancePrompt(prompt, language, apiKey);
            const newPrompt = JSON.stringify({
                prompt: enhanced.videoPrompt,
                sound_effects: enhanced.soundPrompt
            }, null, 2);
            setPrompt(newPrompt);
        } catch (e: any) {
            const errorMessageKey = e.message === 'apiKeyMissingError' ? 'apiKeyMissingError' : 'enhanceError';
            setError(t(errorMessageKey) || e.message);
        } finally {
            setIsEnhancing(false);
        }
    }, [prompt, t, language, apiKey]);

    const handleGeneration = async () => {
        if (!prompt.trim()) {
            setError(t('promptEmptyError'));
            return;
        }
        setIsLoading(true);
        setError(null);
        setGeneratedVideoUrl(null);
        
        let requestData: { prompt: string; [key: string]: any } = { prompt };

        try {
            const parsed = JSON.parse(prompt);
            if (typeof parsed === 'object' && parsed !== null) {
                requestData = { ...parsed, prompt: parsed.prompt || '' };
            }
        } catch (e) {
            // Not a valid JSON, treat as a simple string prompt.
        }

        if (!requestData.prompt.trim()) {
            setError(t('promptJsonEmptyError'));
            setIsLoading(false);
            return;
        }
        
        try {
            const videoUrl = await generateVideo({
                apiKey,
                model: selectedModel,
                aspectRatio,
                image: referenceImage,
                onProgress: (key) => setLoadingMessage(t(key)),
                ...requestData
            });
            setGeneratedVideoUrl(videoUrl);
        } catch (e: any) {
            const errorMessageKey = e.message === 'apiKeyMissingError' ? 'apiKeyMissingError' : 'generationError';
            setError(t(errorMessageKey) || e.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="bg-[#1e1f22] min-h-screen text-gray-200 flex items-center justify-center p-4">
            {warning && <WarningToast message={warning} onDismiss={() => setWarning(null)} />}
            <div className="w-full max-w-4xl mx-auto">
                {generatedVideoUrl ? (
                     <div className="bg-[#2b2d31] p-4 rounded-lg shadow-2xl">
                         <h2 className="text-2xl font-bold mb-4 text-white text-center">{t('videoReadyTitle')}</h2>
                         <video src={generatedVideoUrl} controls autoPlay className="w-full rounded-lg" />
                         <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button 
                                onClick={() => setGeneratedVideoUrl(null)} 
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                            >
                                {t('createAnotherButton')}
                            </button>
                             <a
                                 href={generatedVideoUrl}
                                 download="generated-video.mp4"
                                 className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                             >
                                 <DownloadIcon className="w-5 h-5 mr-2" />
                                 <span>{t('downloadButton')}</span>
                             </a>
                         </div>
                     </div>
                ) : (
                    <div className={`relative p-1 bg-gradient-to-r from-red-500 via-purple-500 to-blue-500 rounded-xl shadow-2xl ${isLoading ? 'animate-border-chase' : ''}`}>
                        <div className="relative bg-[#2b2d31] p-8 rounded-lg">
                           <LanguageSwitcher lang={language} setLang={setLanguage} />
                           {isLoading && <LoadingOverlay message={loadingMessage} t={t} />}
                            
                            <ApiKeyInput value={apiKey} onChange={setApiKey} t={t} />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <PromptInput 
                                        value={prompt} 
                                        onChange={setPrompt} 
                                        onClear={() => setPrompt('')}
                                        onEnhance={handleEnhancePrompt}
                                        isEnhancing={isEnhancing}
                                        isDisabled={isLoading}
                                        t={t}
                                    />
                                    <ImageUploader image={referenceImage} onImageUpload={handleImageUpload} onImageRemove={() => setReferenceImage(null)} t={t} />
                                 </div>
                                <div className="space-y-6">
                                    <ModelSelector selected={selectedModel} onSelect={setSelectedModel} t={t} />
                                    <AspectRatioSelector selected={aspectRatio} onSelect={setAspectRatio} t={t} />
                                    <div className="pt-6">
                                         <button 
                                            onClick={handleGeneration} 
                                            className="w-full bg-gradient-to-r from-red-600 via-red-500 to-orange-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed animate-gradient-x hover:shadow-xl hover:shadow-red-500/30" 
                                            disabled={isLoading || isEnhancing}
                                        >
                                           <VideoIcon className="w-6 h-6 mr-2"/>
                                           <span>{t('generateButton')}</span>
                                        </button>
                                         {error && <p className="text-red-400 mt-2 text-sm text-center">{error}</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
