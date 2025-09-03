import { GoogleGenAI, GenerateVideosRequest } from "@google/genai";
import { AspectRatio, Model, ReferenceImage } from '../types';

const progressMessageKeys = [
    "progressWarmingUp",
    "progressConceptualizing",
    "progressAssembling",
    "progressRendering",
    "progressEnhancing",
    "progressFinalTouches"
];

const ENHANCE_SYSTEM_INSTRUCTION = "You are an expert prompt engineer for a text-to-video generation model. Your task is to take a user's prompt and enhance it to be more descriptive, vivid, and cinematic. Add details about camera movement, lighting, mood, and specific visual elements. The output should be only the enhanced prompt text, without any preamble, labels, or explanation.";

const IMAGE_PROMPT_SYSTEM_INSTRUCTION = "You are an AI assistant that converts descriptive text-to-video prompts into concise, effective text-to-image prompts. Your goal is to create a prompt for a single, static image that can serve as the starting frame for the video. Extract the core subject, setting, and style. Omit any instructions about camera movement, duration, or temporal changes. Focus on a visually rich description of a single moment in time. The output must be only the image prompt text, without any preamble or explanation.";

// FIX: Removed apiKey parameter. API key is now sourced from environment variables.
const createImagePromptFromVideoPrompt = async (videoPrompt: string): Promise<string> => {
    try {
        // FIX: Initialize with API key from environment variables for security.
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Convert this video prompt to an image prompt: "${videoPrompt}"`,
            config: {
                systemInstruction: IMAGE_PROMPT_SYSTEM_INSTRUCTION,
                temperature: 0.5,
            },
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error creating image prompt:", error);
        throw new Error("Failed to create an image prompt for the video.");
    }
};

// FIX: Removed apiKey parameter. API key is now sourced from environment variables.
const generateReferenceImage = async (prompt: string): Promise<ReferenceImage> => {
    try {
        // FIX: Initialize with API key from environment variables for security.
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    } catch (error) {
        console.error("Error generating reference image:", error);
        throw new Error("Failed to generate the reference image.");
    }
};

// FIX: Removed apiKey parameter. API key is now sourced from environment variables.
export const enhancePrompt = async (prompt: string): Promise<string> => {
    try {
        // FIX: Initialize with API key from environment variables for security.
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: ENHANCE_SYSTEM_INSTRUCTION,
                temperature: 0.8,
            },
        });
        
        return response.text.trim();

    } catch (error) {
        console.error("Error enhancing prompt:", error);
        throw new Error("Failed to enhance prompt with Gemini.");
    }
};

export const generateVideo = async ({
  // FIX: Removed apiKey from parameters.
  prompt,
  model,
  aspectRatio,
  image,
  onProgress,
  ...rest
}: {
  prompt: string;
  model: Model;
  aspectRatio: AspectRatio;
  image: ReferenceImage | null;
  onProgress: (messageKey: string) => void;
  [key: string]: any;
}): Promise<string> => {
    
    let referenceImage = image;

    // New logic for VEO 3 Portrait mode without a user-provided reference image
    if (model === 'veo-3.0-generate-preview' && aspectRatio === '9:16' && !image) {
        onProgress("progressVEO3TwoStep");
        
        onProgress("progressVEO3Step1");
        // FIX: Removed apiKey from function call.
        const imagePrompt = await createImagePromptFromVideoPrompt(prompt);
        
        onProgress("progressVEO3Step1b");
        // FIX: Removed apiKey from function call.
        referenceImage = await generateReferenceImage(imagePrompt);
        
        onProgress("progressVEO3Step2");
    }
    
    // FIX: Initialize with API key from environment variables for security.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const generateParams: GenerateVideosRequest = { 
        model, 
        prompt, 
        config: { 
            numberOfVideos: 1, 
            aspectRatio,
            ...rest
        } 
    };
    
    if (referenceImage && generateParams.config) {
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
        
        // Wait for 10 seconds before polling again
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

    // FIX: Use environment variable for API key when fetching video.
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!response.ok) {
        throw new Error(`Failed to download video file: ${response.statusText}`);
    }

    const videoBlob = await response.blob();
    return URL.createObjectURL(videoBlob);
};