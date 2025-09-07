/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality } from "@google/genai";

type ImagePart = { data: string; mimeType: string; };

const app = document.querySelector('main')!;
const imageUpload = app.querySelector<HTMLInputElement>('#image-upload')!;
const imagePreviewContainer = app.querySelector<HTMLDivElement>('#image-preview-container')!;
const imagePlaceholder = app.querySelector<HTMLDivElement>('#image-placeholder')!;
const countrySelect = app.querySelector<HTMLSelectElement>('#country-select')!;
const themeSelectorContainer = app.querySelector<HTMLDivElement>('#theme-selector-container')!;
const textOverlayControlGroup = app.querySelector<HTMLDivElement>('#text-overlay-control-group')!;
const textOverlaySelectorContainer = app.querySelector<HTMLDivElement>('#text-overlay-selector-container')!;
const elevenLabsApiKeyInput = app.querySelector<HTMLInputElement>('#elevenlabs-api-key')!;
const generateBtn = app.querySelector<HTMLButtonElement>('#generate-btn')!;
const generateVariationsBtn = app.querySelector<HTMLButtonElement>('#generate-variations-btn')!;
const carImage = app.querySelector<HTMLImageElement>('#car-image')!;
const resultText = app.querySelector<HTMLParagraphElement>('#result-text')!;
const errorMessage = app.querySelector<HTMLParagraphElement>('#error-message')!;
const loader = app.querySelector<HTMLDivElement>('#loader')!;
const variationsContainer = app.querySelector<HTMLDivElement>('#variations-container')!;
const variationsGallery = app.querySelector<HTMLDivElement>('#variations-gallery')!;
const audioPlayerContainer = app.querySelector<HTMLDivElement>('#audio-player-container')!;
const thematicAudio = app.querySelector<HTMLAudioElement>('#thematic-audio')!;

let base64Images: ImagePart[] = [];
let lastGeneratedImage: ImagePart | null = null;
let selectedTheme: string | null = null;
let selectedTextOverlay: string | null = null;

const themesByCountry: Record<string, string[]> = {
  'China': ['Great Wall', 'Chinese New Year', 'Shanghai Skyline', 'Guilin Mountains'],
  'USA': ['Route 66', 'Times Square', 'Grand Canyon', 'California Beach'],
  'Japan': ['Mt. Fuji & Cherry Blossoms', 'Shibuya Crossing', 'Kyoto Bamboo Forest', 'Dotonbori Nightlife'],
  'Germany': ['Oktoberfest', 'Brandenburg Gate', 'Neuschwanstein Castle', 'Black Forest'],
  'Italy': ['Colosseum', 'Venice Canals', 'Tuscan Countryside', 'Amalfi Coast'],
};

const textOverlaysByTheme: Record<string, Record<string, string[]>> = {
  'China': {
    'Great Wall': ["Timeless Majesty", "Dragon's Drive", "Ancient Power"],
    'Chinese New Year': ["Fortune Rides", "Red Harmony", "Festival Spirit"],
    'Shanghai Skyline': ["Future Pulse", "Neon Dreams", "Urban Legend"],
    'Guilin Mountains': ["Serene Journey", "Misty Peaks", "Nature's Echo"],
  },
  'USA': {
    'Route 66': ["Open Road", "American Legend", "Freedom's Highway"],
    'Times Square': ["City Lights", "Never Sleeps", "Iconic Drive"],
    'Grand Canyon': ["Vast Spirit", "Canyon Carver", "Horizon Bound"],
    'California Beach': ["Coastline King", "Sun Chaser", "Golden Hour"],
  },
  'Japan': {
    'Mt. Fuji & Cherry Blossoms': ["Sakura Speed", "Peak Serenity", "Elegant Power"],
    'Shibuya Crossing': ["Urban Flow", "Tokyo Rush", "Future Forward"],
    'Kyoto Bamboo Forest': ["Silent Strength", "Zen Drive", "Path of Tranquility"],
    'Dotonbori Nightlife': ["Neon Nights", "Osaka Soul", "Vibrant Pulse"],
  },
  'Germany': {
    'Oktoberfest': ["Festival Fun", "Prost Power", "Joy Ride"],
    'Brandenburg Gate': ["Berlin Bold", "Historic Drive", "United Power"],
    'Neuschwanstein Castle': ["Fairy Tale", "Castle King", "Alpine Legend"],
    'Black Forest': ["Forest Force", "Shadow Runner", "Deep Woods"],
  },
  'Italy': {
    'Colosseum': ["Roman Roads", "Eternal Power", "Gladiator Spirit"],
    'Venice Canals': ["Canal Cruiser", "Aqua Elegance", "Floating Dream"],
    'Tuscan Countryside': ["Tuscan Sun", "Vineyard Veloce", "Rolling Hills"],
    'Amalfi Coast': ["Coastal Curve", "Azure Drive", "La Dolce Vita"],
  },
};

const countryToVoiceId: Record<string, string> = {
    'USA': 'pNInz6obpgDQGcFmaJgB', // Adam (American)
    'Germany': 'SOYHLrjzK2X1ezoPC6cr', // Mimi (multilingual, for German)
    'Japan': 'SOYHLrjzK2X1ezoPC6cr', // Mimi (International, for Japanese)
    'Italy': 'SOYHLrjzK2X1ezoPC6cr', // Mimi (multilingual, for Italian)
    'China': 'SOYHLrjzK2X1ezoPC6cr', // Mimi (International, for Chinese)
    'Default': 'pNInz6obpgDQGcFmaJgB'
};

// Util to convert file to base64
async function fileToGenerativePart(file: File): Promise<ImagePart> {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    mimeType: file.type,
    data: await base64EncodedDataPromise,
  };
}

function updateImagePreviews() {
    imagePreviewContainer.innerHTML = '';
    base64Images.forEach((img, index) => {
        const wrapper = document.createElement('div');
        wrapper.classList.add('preview-thumbnail-wrapper');

        const thumbnail = document.createElement('img');
        thumbnail.src = `data:${img.mimeType};base64,${img.data}`;
        thumbnail.classList.add('preview-thumbnail');
        thumbnail.alt = `Uploaded car image ${index + 1}`;

        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'X';
        removeBtn.classList.add('remove-image-btn');
        removeBtn.setAttribute('aria-label', `Remove image ${index + 1}`);
        removeBtn.onclick = () => {
            base64Images.splice(index, 1);
            updateImagePreviews(); // Re-render previews
        };

        wrapper.appendChild(thumbnail);
        wrapper.appendChild(removeBtn);
        imagePreviewContainer.appendChild(wrapper);
    });

    // Update main display
    if (base64Images.length > 0) {
        carImage.src = `data:${base64Images[0].mimeType};base64,${base64Images[0].data}`;
        carImage.alt = 'The car to be customized.';
        carImage.classList.remove('hidden');
        imagePlaceholder.classList.add('hidden');
    } else {
        carImage.src = '';
        carImage.alt = 'No base image selected.';
        carImage.classList.add('hidden');
        imagePlaceholder.classList.remove('hidden');
    }
}

function updateTextOverlays() {
    const country = countrySelect.value;
    textOverlaySelectorContainer.innerHTML = '';
    selectedTextOverlay = null;

    if (country && selectedTheme && textOverlaysByTheme[country] && textOverlaysByTheme[country][selectedTheme]) {
        const snippets = textOverlaysByTheme[country][selectedTheme];
        snippets.forEach(snippet => {
            const button = document.createElement('button');
            button.textContent = snippet;
            button.classList.add('theme-btn'); // Reuse theme button style
            button.type = 'button';
            button.addEventListener('click', () => {
                // Deselect if clicking the same button
                if (selectedTextOverlay === snippet) {
                    selectedTextOverlay = null;
                    button.classList.remove('selected');
                } else {
                    selectedTextOverlay = snippet;
                    textOverlaySelectorContainer.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('selected'));
                    button.classList.add('selected');
                }
            });
            textOverlaySelectorContainer.appendChild(button);
        });
        textOverlayControlGroup.classList.remove('hidden');
    } else {
        textOverlayControlGroup.classList.add('hidden');
    }
}


function updateThemes() {
    const country = countrySelect.value;
    themeSelectorContainer.innerHTML = '';
    selectedTheme = null;
    updateTextOverlays(); // Hide/clear text overlays when country changes

    if (country && themesByCountry[country]) {
        const themes = themesByCountry[country];
        themes.forEach(theme => {
            const button = document.createElement('button');
            button.textContent = theme;
            button.classList.add('theme-btn');
            button.type = 'button'; // Prevent form submission
            button.addEventListener('click', () => {
                // Deselect if clicking the same theme
                if (selectedTheme === theme) {
                    selectedTheme = null;
                    button.classList.remove('selected');
                } else {
                    selectedTheme = theme;
                    themeSelectorContainer.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('selected'));
                    button.classList.add('selected');
                }
                updateTextOverlays(); // Update text overlays based on new theme selection
            });
            themeSelectorContainer.appendChild(button);
        });
        themeSelectorContainer.classList.remove('hidden');
    } else {
        themeSelectorContainer.classList.add('hidden');
    }
}

function setState(isLoading: boolean, forVariations: boolean = false, error?: string): void {
  generateBtn.disabled = isLoading;
  generateVariationsBtn.disabled = isLoading || !lastGeneratedImage;

  const btn = forVariations ? generateVariationsBtn : generateBtn;
  const btnText = btn.querySelector<HTMLSpanElement>('.btn-text')!;
  
  if (isLoading) {
    loader.classList.remove('hidden');
    btnText.textContent = 'Generating...';
    errorMessage.textContent = '';
    resultText.textContent = '';
    imagePlaceholder.classList.add('hidden');
    carImage.classList.add('hidden');
  } else {
    loader.classList.add('hidden');
    if (lastGeneratedImage) {
        carImage.classList.remove('hidden');
    } else if (base64Images.length === 0) {
        imagePlaceholder.classList.remove('hidden');
    }
    btnText.textContent = forVariations ? 'Generate Variations' : 'Generate';
    if(error) {
        errorMessage.textContent = error;
    }
  }
}

async function handleGenerateClick() {
  if (base64Images.length === 0) {
    errorMessage.textContent = 'Please upload at least one base image first.';
    return;
  }
  
  const country = countrySelect.value;

  if (!selectedTheme || !country) {
      errorMessage.textContent = 'Please select a country and a theme.';
      return;
  }

  elevenLabsApiKeyInput.classList.remove('input-error');
  setState(true);
  
  // Clear previous results
  variationsContainer.classList.add('hidden');
  variationsGallery.innerHTML = '';
  audioPlayerContainer.classList.add('hidden');
  thematicAudio.src = '';
  if (base64Images.length > 0) {
    carImage.src = `data:${base64Images[0].mimeType};base64,${base64Images[0].data}`;
  }
  resultText.textContent = '';
  lastGeneratedImage = null;
  generateVariationsBtn.disabled = true;

  let prompt = `Set the car in a scene characteristic of ${country}, with the theme of "${selectedTheme}". Consider the cultural and visual elements of this theme.`;
  if (selectedTextOverlay) {
    prompt += ` Additionally, elegantly render the text "${selectedTextOverlay}" onto the image. The text should be integrated naturally into the scene, matching the theme's aesthetics and looking like a professional part of the advertisement.`;
  }
  
  const imageParts = base64Images.map(img => ({
    inlineData: {
      data: img.data,
      mimeType: img.mimeType,
    },
  }));

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: {
          parts: [
            ...imageParts,
            {
              text: prompt,
            },
          ],
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    let generatedImageFound = false;
    let originalTextResponse = '';
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            const mimeType = part.inlineData.mimeType;
            carImage.src = `data:${mimeType};base64,${base64ImageBytes}`;
            lastGeneratedImage = { data: base64ImageBytes, mimeType: mimeType };
            generateVariationsBtn.disabled = false;
            generatedImageFound = true;
        } else if (part.text) {
            originalTextResponse = part.text;
        }
    }
    resultText.textContent = originalTextResponse;

    if (!generatedImageFound) {
        throw new Error("The model did not return an image. Please try again with a different prompt.");
    }
    
    // --- Audio Generation ---
    const elevenLabsApiKey = elevenLabsApiKeyInput.value.trim();
    try {
        if (!elevenLabsApiKey) {
            console.warn('ElevenLabs API key not provided. Skipping audio generation.');
        } else {
            resultText.textContent += '\nGenerating thematic audio...';
            
            const countryToLanguage: Record<string, string> = {
                'China': 'Mandarin Chinese',
                'USA': 'English',
                'Japan': 'Japanese',
                'Germany': 'German',
                'Italy': 'Italian',
            };
            const language = countryToLanguage[country] || 'English';

            const transcriptPrompt = `Create a single, short, exciting, 15-20 word voice-over script for a car commercial. The scene is in ${country} with a theme of "${selectedTheme}". The tone should be epic and inspiring. IMPORTANT: Write the script in ${language}. Do not provide multiple options, translations, or any text other than the script itself.`;
            const transcriptResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: transcriptPrompt,
            });
            const transcript = transcriptResponse.text?.trim();

            if (!transcript) throw new Error("Could not generate an audio script.");
            
            const voiceId = countryToVoiceId[country] || countryToVoiceId['Default'];
            const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
            
            const audioResponse = await fetch(elevenLabsUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': elevenLabsApiKey,
                },
                body: JSON.stringify({
                    text: transcript,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
                }),
            });

            if (!audioResponse.ok) {
                let errorDetails = `Status: ${audioResponse.status}.`;
                try {
                    const errorJson = await audioResponse.json();
                    if (errorJson.detail && typeof errorJson.detail === 'string') {
                        errorDetails += ` Message: ${errorJson.detail}`;
                    } else if (errorJson.detail && errorJson.detail.message) {
                        errorDetails += ` Message: ${errorJson.detail.message}`;
                    } else {
                        errorDetails += ` Body: ${JSON.stringify(errorJson)}`;
                    }
                } catch {
                    errorDetails += ` Body: ${await audioResponse.text()}`;
                }
                throw new Error(errorDetails);
            }

            const audioBlob = await audioResponse.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            thematicAudio.src = audioUrl;
            audioPlayerContainer.classList.remove('hidden');
            resultText.textContent = originalTextResponse; 
        }
    } catch (audioError) {
        const audioErr = audioError as Error;
        console.error("Audio Generation Failed:", audioErr.message);
        resultText.textContent = originalTextResponse + `\n\n⚠️ Audio generation failed: ${audioErr.message}`;
        if (audioErr.message.includes('Status: 401')) {
            elevenLabsApiKeyInput.classList.add('input-error');
        }
    }

  } catch (e) {
    const error = e as Error;
    console.error(error);
    setState(false, false, `An error occurred: ${error.message}`);
    if (base64Images.length > 0) {
        carImage.src = `data:${base64Images[0].mimeType};base64,${base64Images[0].data}`;
    } else {
        carImage.classList.add('hidden');
        imagePlaceholder.classList.remove('hidden');
    }
    return;
  }

  setState(false);
}

async function handleGenerateVariationsClick() {
    if (!lastGeneratedImage) {
        errorMessage.textContent = 'Please generate a base customized image first.';
        return;
    }

    if (base64Images.length === 0) {
        errorMessage.textContent = 'Original car images are missing for reference. Please re-upload.';
        return;
    }

    const country = countrySelect.value;
    if (!selectedTheme || !country) {
        errorMessage.textContent = 'Please select a country and a theme for variations.';
        return;
    }

    setState(true, true);
    variationsGallery.innerHTML = '';
    variationsContainer.classList.add('hidden');
    
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const variationPromises = [];
        const NUM_VARIATIONS = 3;
        const views = [
            "dramatic front three-quarter angle",
            "sleek rear three-quarter angle",
            "full side profile"
        ];
        
        const originalImageParts = base64Images.map(img => ({
            inlineData: { data: img.data, mimeType: img.mimeType },
        }));

        for (let i = 0; i < NUM_VARIATIONS; i++) {
            const view = views[i % views.length];
            const prompt = `This is a multi-image prompt. The first image is the final customized car. The subsequent images are the original, unmodified car from various angles. Your task is to act as an expert automotive photographer. Re-create the scene from the first image, but capture the car from a new perspective: a ${view}. It is crucial to use the other images as a reference to perfectly maintain the car's original make, model, and shape. Do NOT change the car's customizations, color, or the "${selectedTheme}" theme scenery. Only change the camera angle.`;
            
            variationPromises.push(ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: {
                    parts: [
                        { inlineData: { data: lastGeneratedImage.data, mimeType: lastGeneratedImage.mimeType } },
                        ...originalImageParts,
                        { text: prompt },
                    ],
                },
                config: { responseModalities: [Modality.IMAGE] },
            }));
        }

        const results = await Promise.allSettled(variationPromises);
        const successfulVariations: ImagePart[] = [];

        results.forEach(result => {
            if (result.status === 'fulfilled') {
                const response = result.value;
                const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                if (imagePart?.inlineData) {
                    successfulVariations.push({
                        data: imagePart.inlineData.data,
                        mimeType: imagePart.inlineData.mimeType,
                    });
                }
            } else {
                console.error('A variation generation failed:', result.reason);
            }
        });

        if (successfulVariations.length === 0) {
            throw new Error('Could not generate any variations. Please try again.');
        }

        variationsContainer.classList.remove('hidden');
        successfulVariations.forEach((variation, index) => {
            const img = document.createElement('img');
            img.src = `data:${variation.mimeType};base64,${variation.data}`;
            img.alt = `Car variation ${index + 1}`;
            img.classList.add('variation-thumbnail');
            img.addEventListener('click', () => {
                carImage.src = img.src;
                lastGeneratedImage = variation; // Update last generated to the selected one for consistency
                document.querySelectorAll('.variation-thumbnail').forEach(th => th.classList.remove('selected'));
                img.classList.add('selected');
            });
            variationsGallery.appendChild(img);
        });

        // Select the first one by default
        const firstThumbnail = variationsGallery.querySelector<HTMLImageElement>('.variation-thumbnail');
        if (firstThumbnail) {
            firstThumbnail.classList.add('selected');
            carImage.src = firstThumbnail.src;
            lastGeneratedImage = successfulVariations[0];
        }

    } catch (e) {
        const error = e as Error;
        console.error(error);
        setState(false, true, `An error occurred: ${error.message}`);
        return;
    }

    setState(false, true);
}

async function handleImageUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    const files = target.files;
    if (files && files.length > 0) {
        errorMessage.textContent = '';
        setState(true); // Use loading state for file processing
        try {
            const fileProcessingPromises = Array.from(files).map(fileToGenerativePart);
            const newImages = await Promise.all(fileProcessingPromises);
            base64Images = newImages;
            
            updateImagePreviews();

            // Reset generation state
            resultText.textContent = '';
            lastGeneratedImage = null;
            generateVariationsBtn.disabled = true;
            variationsContainer.classList.add('hidden');
            variationsGallery.innerHTML = '';
        } catch (error) {
            console.error('Error reading files:', error);
            errorMessage.textContent = 'Could not read one or more of the selected image files.';
        } finally {
            setState(false);
        }
    }
}

// Initial setup
updateImagePreviews();
generateBtn.addEventListener('click', handleGenerateClick);
generateVariationsBtn.addEventListener('click', handleGenerateVariationsClick);
imageUpload.addEventListener('change', handleImageUpload);
countrySelect.addEventListener('change', updateThemes);