import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import ne from './ne.json'

i18next.use(initReactI18next).init({
  resources: { en: { translation: en }, ne: { translation: ne } },
  lng: localStorage.getItem('lang') || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export function setLanguage(lang) {
  localStorage.setItem('lang', lang)
  i18next.changeLanguage(lang)
  document.documentElement.lang = lang
}

export default i18next
