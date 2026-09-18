import { useState } from 'react';

const STORAGE_KEY = 'jovi.student.annotation';

function readStoredAnnotation() {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) return '';
    const parsedValue = JSON.parse(rawValue);
    return typeof parsedValue?.text === 'string' ? parsedValue.text : '';
  } catch {
    return '';
  }
}

function writeStoredAnnotation(text) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ text }));
    return true;
  } catch {
    return false;
  }
}

export const STUDENT_ANNOTATION_STORAGE_KEY = STORAGE_KEY;

export function useStudentAnnotation() {
  const [annotationText, setAnnotationText] = useState(readStoredAnnotation);
  const [savedAnnotationText, setSavedAnnotationText] = useState(readStoredAnnotation);
  const [googleDocsEnabled, setGoogleDocsEnabled] = useState(false);

  const saveAnnotation = () => {
    const saved = writeStoredAnnotation(annotationText);
    if (saved) {
      setSavedAnnotationText(annotationText);
      setGoogleDocsEnabled(true);
    }
    return saved;
  };

  const discardAnnotation = () => {
    setAnnotationText(savedAnnotationText);
  };

  return {
    annotationText,
    discardAnnotation,
    googleDocsEnabled,
    saveAnnotation,
    savedAnnotationText,
    setAnnotationText
  };
}
