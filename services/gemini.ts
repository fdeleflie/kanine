
import { GoogleGenAI } from "@google/genai";
import { Client } from "../types";

export const getPetInsight = async (client: Client): Promise<string> => {
  try {
    // Initialize GoogleGenAI with the API key from environment variables.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      Agis comme un expert toiletteur. Voici les informations d'un client :
      Espèce: ${client.species}
      Race: ${client.breed}
      Particularités: ${client.particularities.join(", ")}
      Notes précédentes: ${client.notes}
      
      Donne-moi en 3 phrases maximum des conseils spécifiques pour son prochain toilettage (tempérament, soin du poil, précautions).
    `;

    // Generate content using the specified model and prompt.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Access the generated text directly from the response object.
    return response.text || "Pas d'insight disponible pour le moment.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Impossible de générer des conseils IA.";
  }
};
