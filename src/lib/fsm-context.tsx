import React, { createContext, useContext, useState, ReactNode } from 'react';
import { FSMData } from './fsm-parser';

interface FSMContextType {
  fsmData: FSMData | null;
  fileName: string | null;
  setFSMData: (data: FSMData, fileName: string) => void;
  clearFSMData: () => void;
}

const FSMContext = createContext<FSMContextType | undefined>(undefined);

export function FSMProvider({ children }: { children: ReactNode }) {
  const [fsmData, setFsmDataState] = useState<FSMData | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const setFSMData = (data: FSMData, name: string) => {
    setFsmDataState(data);
    setFileName(name);
  };

  const clearFSMData = () => {
    setFsmDataState(null);
    setFileName(null);
  };

  return (
    <FSMContext.Provider value={{ fsmData, fileName, setFSMData, clearFSMData }}>
      {children}
    </FSMContext.Provider>
  );
}

export function useFSM() {
  const context = useContext(FSMContext);
  if (context === undefined) {
    throw new Error('useFSM must be used within a FSMProvider');
  }
  return context;
}
