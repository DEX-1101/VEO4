
import { GoogleGenAI, GenerateVideosRequest, Type } from "@google/genai";
import { AspectRatio, Model, ReferenceImage } from '../types';
import { translations } from "../localization";

const progressMessageKeys = [
    "progressWarmingUp",
    "progressConceptualizing",
    "progressAssembling",
    "progressRendering",
    "progressEnhancing",
    "progressFinalTouches"
];

const IMAGE_PROMPT_SYSTEM_INSTRUCTION = "You are an AI assistant that converts descriptive text-to-video prompts into concise, effective text-to-image prompts. Your goal is to create a prompt for a single, static image that can serve as the starting frame for the video. Extract the core subject, setting, and style. Omit any instructions about camera movement, duration, or temporal changes. Focus on a visually rich description of a single moment in time. The output must be only the image prompt text, without any preamble or explanation.";

const getApiKey = (apiKey?: string): string => {
    const finalApiKey = apiKey || process.env.API_KEY;
    if (!finalApiKey) {
        throw new Error('apiKeyMissingError');
    }
    return finalApiKey;
}

const createImagePromptFromVideoPrompt = async (videoPrompt: string, apiKey?: string): Promise<string> => {
    try {
        const finalApiKey = getApiKey(apiKey);
        const ai = new GoogleGenAI({ apiKey: finalApiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Convert this video prompt to an image prompt: "${videoPrompt}"`,
            config: {
                systemInstruction: IMAGE_PROMPT_SYSTEM_INSTRUCTION,
                temperature: 0.5,
            },
        });
        return response.text.trim();
    } catch (error: any) {
        if(error.message === 'apiKeyMissingError') throw error;
        console.error("Error creating image prompt:", error);
        throw new Error("Failed to create an image prompt for the video.");
    }
};

const generateReferenceImage = async (prompt: string, apiKey?: string): Promise<ReferenceImage> => {
    try {
        const finalApiKey = getApiKey(apiKey);
        const ai = new GoogleGenAI({ apiKey: finalApiKey });
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: '9:16',
            },
        });

        if (!response.generatedImages || response.generatedImages.length === 0) {
            throw new Error("Image generation returned no images.");
        }

        const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
        return {
            base64: base64ImageBytes,
            mimeType: 'image/png',
            name: 'generated-reference.png'
        };
    } catch (error: any) {
        if(error.message === 'apiKeyMissingError') throw error;
        console.error("Error generating reference image:", error);
        throw new Error("Failed to generate the reference image.");
    }
};

export const enhancePrompt = async (prompt: string, language: 'en' | 'id', apiKey?: string): Promise<{ videoPrompt: string, soundPrompt: string }> => {
    try {
        const finalApiKey = getApiKey(apiKey);
        const ai = new GoogleGenAI({ apiKey: finalApiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: translations[language].enhanceSystemInstruction,
                temperature: 0.8,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        videoPrompt: {
                            type: Type.STRING,
                            description: "The enhanced, cinematic video prompt."
                        },
                        soundPrompt: {
                            type: Type.STRING,
                            description: "The sound effects and ambient audio prompt."
                        }
                    },
                    required: ["videoPrompt", "soundPrompt"]
                },
            },
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);

    } catch (error: any) {
        if(error.message === 'apiKeyMissingError') throw error;
        console.error("Error enhancing prompt:", error);
        throw new Error("Failed to enhance prompt with Gemini.");
    }
};

export const generateVideo = async ({
  apiKey,
  prompt,
  model,
  aspectRatio,
  image,
  onProgress,
  ...rest
}: {
  apiKey?: string;
  prompt: string;
  model: Model;
  aspectRatio: AspectRatio;
  image: ReferenceImage | null;
  onProgress: (messageKey: string) => void;
  [key: string]: any;
}): Promise<string> => {
    
    const finalApiKey = getApiKey(apiKey);
    let referenceImage = image;

    if (model === 'veo-3.0-generate-preview' && aspectRatio === '9:16' && !image) {
        onProgress("progressVEO3TwoStep");
        
        onProgress("progressVEO3Step1");
        const imagePrompt = await createImagePromptFromVideoPrompt(prompt, apiKey);
        
        onProgress("progressVEO3Step1b");
        referenceImage = await generateReferenceImage(imagePrompt, apiKey);
        
        onProgress("progressVEO3Step2");
    }
    
    const ai = new GoogleGenAI({ apiKey: finalApiKey });

    const config: GenerateVideosRequest['config'] = { 
        numberOfVideos: 1, 
        ...rest
    };

    if (!(model === 'veo-3.0-generate-preview' && referenceImage)) {
        config.aspectRatio = aspectRatio;
    }

    const generateParams: GenerateVideosRequest = { 
        model, 
        prompt, 
        config
    };
    
    if (referenceImage) {
        generateParams.image = {
            imageBytes: referenceImage.base64,
            mimeType: referenceImage.mimeType
        };
    }

    onProgress("progressInitializing");

    let operation = await ai.models.generateVideos(generateParams);
    
    let messageIndex = 0;
    while (!operation.done) {
        onProgress(progressMessageKeys[messageIndex % progressMessageKeys.length]);
        messageIndex++;
        
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        try {
            operation = await ai.operations.getVideosOperation({ operation: operation });
        } catch(e) {
            console.error("Error polling for video operation status:", e);
            throw new Error("Failed to get video generation status. Please try again.");
        }
    }

    if (operation.error) {
        throw new Error(`Video generation failed with error: ${operation.error.message}`);
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("Video generation completed, but no download link was returned.");
    }
    
    onProgress("progressDownloading");

    const response = await fetch(`${downloadLink}&key=${finalApiKey}`);
    if (!response.ok) {
        throw new Error(`Failed to download video file: ${response.statusText}`);
    }

    const videoBlob = await response.blob();
    return URL.createObjectURL(videoBlob);
};
