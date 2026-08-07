export const THEME_STORAGE_KEY = 'ag-theme'

export type Theme = 'light' | 'dark'

export const DEFAULT_THEME: Theme = 'dark'

export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})()`
