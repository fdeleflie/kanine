
import React from 'react';

export const INITIAL_CONFIG = {
  species: ["Chien", "Chat"],
  breeds: {
    "Chien": ["Caniche", "Labrador", "Golden Retriever", "Yorkshire", "Bulldog", "Bichon", "Cocker", "Autre"],
    "Chat": ["Persan", "Main Coon", "Siamois", "Européen", "Sacré de Birmanie", "Autre"]
  },
  particularities: ["Agressif", "Anxieux", "Problèmes cardiaques", "Sénior", "Peau sensible", "Parle beaucoup"],
  services: ["Bain & Brushing", "Coupe Ciseaux", "Tonte Courte", "Tonte Longue", "Épilation", "Coupe des griffes"],
  coatTypes: ["Court", "Long", "Dur", "Frisé"],
  products: []
};

export const PAYMENT_METHODS = ["Espèces", "Carte", "Chèque", "Virement"] as const;

export const ICON_DOG = (className: string) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);
