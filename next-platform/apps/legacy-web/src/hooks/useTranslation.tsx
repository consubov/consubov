import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SiteLanguage } from "@/lib/siteLanguage";
import { APP_TRANSLATIONS } from "@/lib/translations";
const KEY = "consubov:app-language";
const normalizeAppLanguage = (value: string | null): SiteLanguage => value === "en-US" ? "en-US" : "pt-BR";
type I18nValue = { language: SiteLanguage; setLanguage: (next: SiteLanguage) => void; t: (key: string) => string };
export const I18nContext = createContext<I18nValue>({ language: "pt-BR", setLanguage: () => {}, t: key => APP_TRANSLATIONS["pt-BR"][key] ?? key });
function initial(): SiteLanguage { try {return normalizeAppLanguage(localStorage.getItem(KEY));} catch {return "pt-BR";} }
export function AppLanguageProvider({children}:{children:ReactNode}) {
 const [language,setLocale]=useState<SiteLanguage>(initial);
 useEffect(()=>{const onStorage=(e:StorageEvent)=>{if(e.key===KEY) setLocale(normalizeAppLanguage(e.newValue));};window.addEventListener("storage",onStorage);return ()=>window.removeEventListener("storage",onStorage);},[]);
 const setLanguage=useCallback((next:SiteLanguage)=>{const value=normalizeAppLanguage(next);setLocale(value);try{localStorage.setItem(KEY,value);}catch{/* storage optional */}},[]);
 const t=useCallback((key:string)=>Object.prototype.hasOwnProperty.call(APP_TRANSLATIONS[language],key)?APP_TRANSLATIONS[language][key]:Object.prototype.hasOwnProperty.call(APP_TRANSLATIONS["pt-BR"],key)?APP_TRANSLATIONS["pt-BR"][key]:key,[language]);
 const value=useMemo(()=>({language,setLanguage,t}),[language,setLanguage,t]);
 return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export const useTranslation=()=>useContext(I18nContext);
