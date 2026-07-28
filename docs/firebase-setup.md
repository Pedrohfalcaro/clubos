# Configuração Firebase — ClubOS

## 1. Criar projeto
1. Acesse https://console.firebase.google.com
2. Crie um projeto (ou use um existente)
3. Adicione um app **Web** e copie as credenciais

## 2. Ativar serviços
- **Authentication** → Sign-in method → **Google** → Enable
- **Firestore Database** → Create database (modo produção)
  - Regras sugeridas (só o dono lê/escreve o próprio save):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/data/{doc} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

## 3. Domínios autorizados
Authentication → Settings → Authorized domains  
Adicione `localhost` (dev) e o domínio de produção (ex.: GitHub Pages).

## 4. Variáveis de ambiente
Copie `.env.example` → `.env` e preencha:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Reinicie o `npm run dev` após salvar o `.env`.

## Comportamento
- Login Google obrigatório no menu
- Save sincroniza na nuvem (`users/{uid}/data/save`) com debounce ~600ms
- Cache local continua existindo como espelho rápido
- No primeiro login, se existir save local e a nuvem estiver vazia, o local é enviado automaticamente
