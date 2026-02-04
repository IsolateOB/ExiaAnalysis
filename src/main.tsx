/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { I18nProvider } from './i18n'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <I18nProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </I18nProvider>
)
